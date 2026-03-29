import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { getTicketLabel, getTicketLabelSync, computeAmounts, computeAmountsSync, TICKET_OPTIONS } from '@/lib/ticketUtils';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import type { EntryRecord, TicketType } from '@/types';

// Helper function to safely convert values to strings - v2
const safeString = (value: any): string => {
  if (value === null || value === undefined) return '0';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return String(value || '0');
};

// Helper function to safely convert values to numbers
const safeNumber = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export function AdminEntries() {
  const navigate = useNavigate();
  const { clear } = useEntryStore();
  const { user } = useAuthStore();
  const [isClient, setIsClient] = useState(false);
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchDebounce, setSearchDebounce] = useState('');
  const [entriesByDate, setEntriesByDate] = useState<Record<string, EntryRecord[]>>({});
  const [datePagination, setDatePagination] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<EntryRecord | null>(null);
  const [viewing, setViewing] = useState<EntryRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; id: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: string; value: string } | null>(null);
  const limit = 50; // Reduced for better performance
  const dateLimit = 20; // Pagination per date

  // Fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Debounced search for instant results
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Group entries by date for better organization
  const groupEntriesByDate = (entries: EntryRecord[]) => {
    const grouped: Record<string, EntryRecord[]> = {};
    entries.forEach(entry => {
      const date = dayjs(entry.createdAt).format('YYYY-MM-DD');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(entry);
    });
    return grouped;
  };

  const fetchEntries = () => {
    if (!isClient) return;
    setLoading(true);
    console.log('🔍 AdminEntries: Fetching entries with params:', { search: searchDebounce || undefined, page, limit });
    entriesApi.list({ search: searchDebounce || undefined, page, limit }).then((res) => {
      console.log('🔍 AdminEntries: API response:', { success: res.success, entriesCount: res.data?.entries?.length || 0, total: res.data?.total || 0 });
      // Debug first entry filled by fields
      if (res.data?.entries?.length > 0) {
        const firstEntry = res.data.entries[0];
        console.log('🔍 AdminEntries: First entry filledBy debug:', {
          filledBy: firstEntry.filledBy,
          filledByFullName: firstEntry.filledByFullName,
          createdBy: firstEntry.createdBy,
          user: user?.username
        });
      }
      const fetchedEntries = (res.data?.entries as EntryRecord[]) ?? [];
      setEntries(fetchedEntries);
      setTotal(res.data?.total ?? 0);
      
      // Group entries by date for better visibility
      const grouped = groupEntriesByDate(fetchedEntries);
      setEntriesByDate(grouped);
      
      // Initialize pagination for each date
      const initialPagination: Record<string, number> = {};
      Object.keys(grouped).forEach(date => {
        initialPagination[date] = 1;
      });
      setDatePagination(initialPagination);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries();
  }, [page, searchDebounce]);

  // Real-time sync: Listen for entry updates
  useEffect(() => {
    const handleEntryUpdate = () => {
      console.log('AdminEntries: Real-time sync triggered');
      fetchEntries();
    };

    // Listen for various entry events
    window.addEventListener('entry-created', handleEntryUpdate);
    window.addEventListener('entry-updated', handleEntryUpdate);
    window.addEventListener('entry-deleted', handleEntryUpdate);
    window.addEventListener('dashboard-synced', handleEntryUpdate);
    window.addEventListener('entries-refresh', handleEntryUpdate); // Listen for admin sync coordinator
    
    // Listen for receipt events from staff dashboard
    const handleReceiptEvent = (event: any) => {
      console.log('🧾 AdminEntries: Receipt event received:', event.detail);
      fetchEntries();
    };
    
    window.addEventListener('receipt-generated', handleReceiptEvent);
    window.addEventListener('receipt-printed', handleReceiptEvent);
    window.addEventListener('staff-synced', handleEntryUpdate);
    window.addEventListener('payment-completed', handleEntryUpdate);

    return () => {
      window.removeEventListener('entry-created', handleEntryUpdate);
      window.removeEventListener('entry-updated', handleEntryUpdate);
      window.removeEventListener('entry-deleted', handleEntryUpdate);
      window.removeEventListener('dashboard-synced', handleEntryUpdate);
      window.removeEventListener('entries-refresh', handleEntryUpdate); // Remove admin sync coordinator event
      window.removeEventListener('receipt-generated', handleReceiptEvent);
      window.removeEventListener('receipt-printed', handleReceiptEvent);
      window.removeEventListener('staff-synced', handleEntryUpdate);
      window.removeEventListener('payment-completed', handleEntryUpdate);
    };
  }, [page, searchDebounce]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await entriesApi.delete(id);
      
      // Trigger real-time sync event for dashboard
      window.dispatchEvent(new CustomEvent('entry-deleted', { 
        detail: { 
          entryId: id, 
          action: 'delete',
          timestamp: new Date().toISOString()
        } 
      }));
      
      fetchEntries();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleInlineEdit = async (id: string, field: string, value: string) => {
    try {
      const entry = entries.find(e => e._id === id);
      if (!entry) return;
      
      const updateData = { ...entry, [field]: value };
      await entriesApi.update(id, updateData);
      
      // Update local state
      setEntries(prev => prev.map(e => 
        e._id === id ? { ...e, [field]: value } : e
      ));
      
      setToast({ message: `✅ ${field} updated successfully!`, id: `inline-${id}-${field}` });
      setTimeout(() => setToast(null), 3000);
      
      // Trigger real-time sync
      window.dispatchEvent(new CustomEvent('entry-updated', { 
        detail: { 
          entryId: id, 
          action: 'inline-edit',
          field,
          timestamp: new Date().toISOString()
        } 
      }));
      
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleInlineEditSubmit = () => {
    if (inlineEditing) {
      handleInlineEdit(inlineEditing.id, inlineEditing.field, inlineEditing.value);
      setInlineEditing(null);
    }
  };

  // Helper functions for date-wise pagination
  const getDateEntries = (date: string, page: number = 1) => {
    const dateEntries = entriesByDate[date] || [];
    const startIndex = (page - 1) * dateLimit;
    const endIndex = startIndex + dateLimit;
    return dateEntries.slice(startIndex, endIndex);
  };

  const getTotalPagesForDate = (date: string) => {
    const dateEntries = entriesByDate[date] || [];
    return Math.ceil(dateEntries.length / dateLimit);
  };

  const handleDatePageChange = (date: string, newPage: number) => {
    setDatePagination(prev => ({
      ...prev,
      [date]: newPage
    }));
  };

  const handleClearAllEntries = async () => {
    if (!confirm('Are you sure you want to clear all entries? This action cannot be undone!')) return;
    try {
      await entriesApi.clearAll();
      
      // Trigger real-time sync event for dashboard and export
      window.dispatchEvent(new CustomEvent('entry-deleted', { 
        detail: { 
          action: 'clear-all',
          timestamp: new Date().toISOString()
        } 
      }));
      
      fetchEntries();
      setToast({ message: '✅ All entries cleared successfully!', id: 'clear-all' });
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  // Handle Escape key for inline editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inlineEditing) {
        setInlineEditing(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inlineEditing]);

  return (
    <Layout title="📋 All Entries" showAdminLink>
      <div className="space-y-6">
        <div className="modern-card">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="search"
              placeholder="Search by name, mobile, ticket type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-modern flex-1"
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                clear();
                navigate('/ticket');
              }}
              className="btn-primary"
            >
              ➕ New Entry
            </motion.button>
          </div>
        </div>

        {/* Pagination - Always show for navigation */}
        {total > 0 && (
          <div className="modern-card">
            <div className="flex justify-between items-center">
              <p className="text-blue-800">
                Showing {((page - 1) * limit) + 1}-{Math.min(page * limit, total)} of {total} entries
              </p>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ←
                </motion.button>
                <span className="px-4 py-2 rounded-lg bg-blue-50 text-blue-900 font-bold">
                  Page {page}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPage(p => Math.max(1, Math.min(Math.ceil(total / limit), p + 1)))}
                  disabled={page * limit >= total}
                  className="px-4 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  →
                </motion.button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="modern-card">
          <div className="flex flex-wrap gap-4">
            <Link to="/admin/export" className="btn-primary">
              📊 Export to Excel
            </Link>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClearAllEntries}
              className="px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition"
            >
              🗑️ Clear All Entries
            </motion.button>
          </div>
        </div>

        {/* Entries Table - Date Wise Grouped */}
        <div className="modern-card">
          {loading ? (
            <p className="text-blue-800 text-center py-8">Loading entries…</p>
          ) : Object.keys(entriesByDate).length === 0 ? (
            <p className="text-blue-800 text-center py-8">No entries found</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(entriesByDate)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, dateEntries]) => {
                  const currentPage = datePagination[date] || 1;
                  const totalPages = getTotalPagesForDate(date);
                  const paginatedEntries = getDateEntries(date, currentPage);
                  
                  return (
                    <div key={date} className="border border-blue-200 rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                      {/* Date Header */}
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-blue-900">
                          📅 {dayjs(date).format('dddd, D MMMM YYYY')}
                        </h3>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-blue-700 font-medium">
                            {dateEntries.length} entries
                          </span>
                          {/* Date-wise Pagination */}
                          {totalPages > 1 && (
                            <div className="flex gap-2 items-center">
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDatePageChange(date, Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                ←
                              </motion.button>
                              <span className="px-3 py-1 rounded bg-blue-50 text-blue-900 font-bold text-sm">
                                {currentPage}/{totalPages}
                              </span>
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDatePageChange(date, Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition"
                              >
                                →
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Entries for this date */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-blue-200">
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Time</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Filled By</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Name</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Mobile</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Ticket</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Adults</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Kids</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Total</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Amount</th>
                              <th className="py-2 px-3 text-blue-900 font-bold text-xs">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            <AnimatePresence>
                              {paginatedEntries.map((entry, idx) => (
                                <motion.tr
                                  key={entry._id}
                                  id={`entry-row-${entry._id}`}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  transition={{ delay: idx * 0.02 }}
                                  className={`border-b border-gray-100 hover:bg-blue-100 transition ${
                                    highlightId === entry._id ? 'bg-yellow-100' : ''
                                  }`}
                                >
                                  <td className="py-2 px-3 text-blue-900">
                                    <p className="font-medium text-xs">{dayjs(entry.createdAt).format('hh:mm A')}</p>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex flex-col gap-1">
                                      <span className="px-2 py-1 rounded bg-gradient-to-r from-blue-100 to-blue-200 text-blue-900 font-bold text-xs border border-blue-300">
                                        👤 {isClient ? String((entry as any).filledByFullName || (entry as any).filledBy || user?.fullName || user?.username || 'Unknown') : 'Loading...'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 font-bold text-blue-900 text-xs">{safeString(entry.name)}</td>
                                  <td className="py-2 px-3 text-blue-900 text-xs">{safeString(entry.mobile)}</td>
                                  <td className="py-2 px-3">
                                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-900 font-bold text-xs">
                                      {getTicketLabelSync(entry.ticketType as TicketType)}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-blue-900 text-xs font-bold">{safeNumber(entry.adults)}</td>
                                  <td className="py-2 px-3 text-blue-900 text-xs font-bold">{safeNumber(entry.kids)}</td>
                                  <td className="py-2 px-3 text-blue-900 text-xs font-bold">{safeNumber(entry.adults) + safeNumber(entry.kids)}</td>
                                  <td className="py-2 px-3 text-blue-900 text-xs font-bold">₹{safeNumber(entry.finalAmount)}</td>
                                  <td className="py-2 px-3 space-x-1">
                                    <motion.button
                                      whileHover={{ scale: 1.1 }}
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => setViewing(entry)}
                                      className="px-2 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs border border-blue-200 transition"
                                    >
                                      👁
                                    </motion.button>
                                    {user?.role === 'admin' && (
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setEditing(entry)}
                                        className="px-2 py-1 rounded bg-green-100 hover:bg-green-200 text-green-900 font-bold text-xs border border-green-200 transition"
                                      >
                                        ✏️
                                      </motion.button>
                                    )}
                                    {user?.role === 'admin' && (
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => handleDelete(entry._id)}
                                        className="px-2 py-1 rounded bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs border border-red-200 transition"
                                      >
                                        🗑
                                      </motion.button>
                                    )}
                                  </td>
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50"
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {viewing && (
            <ViewEntryModal
              entry={viewing}
              onClose={() => setViewing(null)}
            />
          )}

          {editing && (
            <EditEntryModal
              entry={editing}
              onClose={() => setEditing(null)}
              onSaved={(id) => {
                setEditing(null);
                fetchEntries();
                setToast({ message: '✅ Entry updated successfully!', id });
                setHighlightId(id);
                setTimeout(() => setHighlightId(null), 3000);
                setTimeout(() => setToast(null), 4000);
              }}
              setToast={(toast) => {
                setToast(toast);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function ViewEntryModal({ entry, onClose }: { entry: EntryRecord; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="modern-card rounded-2xl p-6 max-w-4xl w-full flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <h3 className="heading-lg text-blue-900 mb-4 flex-shrink-0">👁 View Entry Details</h3>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">📅 Date & Time</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {dayjs(entry.createdAt).format('DD/MM/YYYY HH:mm:ss')}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👤 Customer Name</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.name}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">📱 Mobile</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.mobile}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎫 Ticket Type</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {getTicketLabel(entry.ticketType as TicketType)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👨 Adults</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.adults}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🧒 Kids</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.kids}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👥 Total People</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.adults + entry.kids}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💰 Final Amount</label>
              <div className="py-2 px-3 rounded bg-green-50 text-green-900 font-bold text-lg">
                ₹{entry.finalAmount}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👤 Created By</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {(entry as any).filledByFullName || (entry as any).filledBy || 'Unknown'}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-blue-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold transition"
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditEntryModal({ 
  entry, 
  onClose, 
  onSaved, 
  setToast 
}: { 
  entry: EntryRecord; 
  onClose: () => void; 
  onSaved: (id: string) => void;
  setToast: (toast: { message: string; id: string } | null) => void;
}) {
  const [formData, setFormData] = useState({
    name: entry.name,
    mobile: entry.mobile,
    adults: entry.adults,
    kids: entry.kids,
    ticketType: entry.ticketType,
    finalAmount: entry.finalAmount,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await entriesApi.update(entry._id, formData);
      onSaved(entry._id);
      onClose();
    } catch (error) {
      console.error('Edit entry error:', error);
      setToast({ message: '❌ Failed to update entry', id: 'edit-error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="modern-card rounded-2xl p-6 max-w-2xl w-full"
      >
        <h3 className="heading-lg text-blue-900 mb-6">✏️ Edit Entry</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Customer Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-modern w-full"
                required
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Mobile</label>
              <input
                type="tel"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="input-modern w-full"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Adults</label>
              <input
                type="number"
                value={formData.adults}
                onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
                className="input-modern w-full"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Kids</label>
              <input
                type="number"
                value={formData.kids}
                onChange={(e) => setFormData({ ...formData, kids: parseInt(e.target.value) || 0 })}
                className="input-modern w-full"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Final Amount</label>
              <input
                type="number"
                value={formData.finalAmount}
                onChange={(e) => setFormData({ ...formData, finalAmount: parseInt(e.target.value) || 0 })}
                className="input-modern w-full"
                min="0"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-blue-200">
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="px-6 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-900 font-bold transition"
              disabled={loading}
            >
              Cancel
            </motion.button>
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
