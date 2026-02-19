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
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<EntryRecord | null>(null);
  const [viewing, setViewing] = useState<EntryRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; id: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: string; value: string } | null>(null);
  const limit = 20;

  const fetchEntries = () => {
    setLoading(true);
    entriesApi.list({ search: search || undefined, page, limit }).then((res) => {
      setEntries((res.entries as EntryRecord[]) ?? []);
      setTotal(res.total ?? 0);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntries();
  }, [page, search]);

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

    return () => {
      window.removeEventListener('entry-created', handleEntryUpdate);
      window.removeEventListener('entry-updated', handleEntryUpdate);
      window.removeEventListener('entry-deleted', handleEntryUpdate);
      window.removeEventListener('dashboard-synced', handleEntryUpdate);
      window.removeEventListener('entries-refresh', handleEntryUpdate); // Remove admin sync coordinator event
    };
  }, [page, search]);

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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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

        {/* Pagination */}
        {total > limit && (
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

        {/* Entries Table */}
        <div className="modern-card">
          {loading ? (
            <p className="text-blue-800 text-center py-8">Loading entries…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-blue-200">
                    <th className="py-3 px-4 text-blue-900 font-bold">Date & Time</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Filled By</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Name</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Mobile</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Ticket</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Adults</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Kids</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Total</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Amount</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">💵 Cash</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">💳 UPI</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">🤝 Advance</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">💳 Other</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">🍔 Food Coupons</th>
                    <th className="py-3 px-4 text-blue-900 font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {entries.map((entry, idx) => (
                      <motion.tr
                        key={entry._id}
                        id={`entry-row-${entry._id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`border-b border-gray-100 hover:bg-blue-50 transition ${
                          highlightId === entry._id ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-blue-900">
                          <div>
                            <p className="font-medium">{dayjs(entry.createdAt).format('DD/MM/YY')}</p>
                            <p className="text-xs text-blue-600">{dayjs(entry.createdAt).format('hh:mm A')}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded-lg bg-gradient-to-r from-blue-100 to-blue-200 text-blue-900 font-bold text-xs border border-blue-300">
                                👤 {(entry as any).filledByFullName || (entry as any).createdBy?.fullName || (entry as any).createdBy?.username || 'Unknown'}
                              </span>
                              {(entry as any).createdBy?.username && (
                                <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-900 font-bold text-xs border border-purple-300">
                                  {(entry as any).createdBy?.username === user?.username ? '👤 You' : '👨 Staff'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {dayjs(entry.createdAt).format('DD/MM/YY hh:mm A')}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-blue-900">{safeString(entry.name)}</td>
                        <td className="py-3 px-4 text-blue-900">{safeString(entry.mobile)}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold text-xs">
                            {getTicketLabelSync(entry.ticketType as TicketType)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-blue-900">{safeString(entry.adults)}</td>
                        <td className="py-3 px-4 text-blue-900">{entry.ticketType === '150' ? '-' : safeString(entry.kids)}</td>
                        <td className="py-3 px-4 font-bold text-blue-900">{entry.ticketType === '150' ? safeString(entry.adults) : safeString(entry.totalPeople)}</td>
                        <td className="py-3 px-4 font-bold text-green-900">₹{safeString(entry.finalAmount)}</td>
                        <td className="py-3 px-4 text-blue-900 font-medium">₹{safeString(entry.cashAmount)}</td>
                        <td className="py-3 px-4 text-blue-900 font-medium">₹{safeString(entry.upiAmount)}</td>
                        <td className="py-3 px-4 text-blue-900 font-medium">₹{safeString(entry.advanceAmount)}</td>
                        <td className="py-3 px-4 text-blue-900 font-medium">₹{safeString(entry.otherAmount)}</td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            {/* Fast Food Coupons */}
                            {((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon) && (
                              <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                                <div className="text-xs font-bold text-orange-800 mb-1">🍔 Fast Food</div>
                                <div className="flex justify-between gap-2">
                                  {inlineEditing?.id === entry._id && inlineEditing?.field === 'adultsFastFoodCoupon' ? (
                                    <input
                                      type="number"
                                      value={inlineEditing.value}
                                      onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                      onBlur={handleInlineEditSubmit}
                                      onKeyPress={(e) => e.key === 'Enter' && handleInlineEditSubmit()}
                                      className="text-xs text-orange-700 border border-orange-300 rounded px-1 py-0.5 w-16"
                                      autoFocus
                                      min="0"
                                    />
                                  ) : (
                                    <span 
                                      className="text-xs text-orange-700 cursor-pointer hover:text-orange-900"
                                      onClick={() => setInlineEditing({ id: entry._id, field: 'adultsFastFoodCoupon', value: safeString((entry as any).adultsFastFoodCoupon) })}
                                    >
                                      Adults: {safeString((entry as any).adultsFastFoodCoupon)}
                                    </span>
                                  )}
                                  {inlineEditing?.id === entry._id && inlineEditing?.field === 'kidsFastFoodCoupon' ? (
                                    <input
                                      type="number"
                                      value={inlineEditing.value}
                                      onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                      onBlur={handleInlineEditSubmit}
                                      onKeyPress={(e) => e.key === 'Enter' && handleInlineEditSubmit()}
                                      className="text-xs text-orange-700 border border-orange-300 rounded px-1 py-0.5 w-16"
                                      autoFocus
                                      min="0"
                                    />
                                  ) : (
                                    <span 
                                      className="text-xs text-orange-700 cursor-pointer hover:text-orange-900"
                                      onClick={() => setInlineEditing({ id: entry._id, field: 'kidsFastFoodCoupon', value: safeString((entry as any).kidsFastFoodCoupon) })}
                                    >
                                      Kids: {safeString((entry as any).kidsFastFoodCoupon)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-orange-900 border-t border-orange-200 pt-1">
                                  Total: {safeNumber((entry as any).adultsFastFoodCoupon) + safeNumber((entry as any).kidsFastFoodCoupon)}
                                </div>
                              </div>
                            )}
                            
                            {/* Main Food Coupons */}
                            {((entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
                              <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                                <div className="text-xs font-bold text-green-800 mb-1">🍽️ Main Food</div>
                                <div className="flex justify-between gap-2">
                                  {inlineEditing?.id === entry._id && inlineEditing?.field === 'adultsMainFoodCoupon' ? (
                                    <input
                                      type="number"
                                      value={inlineEditing.value}
                                      onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                      onBlur={handleInlineEditSubmit}
                                      onKeyPress={(e) => e.key === 'Enter' && handleInlineEditSubmit()}
                                      className="text-xs text-green-700 border border-green-300 rounded px-1 py-0.5 w-16"
                                      autoFocus
                                      min="0"
                                    />
                                  ) : (
                                    <span 
                                      className="text-xs text-green-700 cursor-pointer hover:text-green-900"
                                      onClick={() => setInlineEditing({ id: entry._id, field: 'adultsMainFoodCoupon', value: safeString((entry as any).adultsMainFoodCoupon) })}
                                    >
                                      Adults: {safeString((entry as any).adultsMainFoodCoupon)}
                                    </span>
                                  )}
                                  {inlineEditing?.id === entry._id && inlineEditing?.field === 'kidsMainFoodCoupon' ? (
                                    <input
                                      type="number"
                                      value={inlineEditing.value}
                                      onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                      onBlur={handleInlineEditSubmit}
                                      onKeyPress={(e) => e.key === 'Enter' && handleInlineEditSubmit()}
                                      className="text-xs text-green-700 border border-green-300 rounded px-1 py-0.5 w-16"
                                      autoFocus
                                      min="0"
                                    />
                                  ) : (
                                    <span 
                                      className="text-xs text-green-700 cursor-pointer hover:text-green-900"
                                      onClick={() => setInlineEditing({ id: entry._id, field: 'kidsMainFoodCoupon', value: safeString((entry as any).kidsMainFoodCoupon) })}
                                    >
                                      Kids: {safeString((entry as any).kidsMainFoodCoupon)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-green-900 border-t border-green-200 pt-1">
                                  Total: {safeNumber((entry as any).adultsMainFoodCoupon) + safeNumber((entry as any).kidsMainFoodCoupon)}
                                </div>
                              </div>
                            )}
                            
                            {/* Upgrade Food Coupons */}
                            {entry.upgrades && entry.upgrades.length > 0 && (
                              entry.upgrades.map((upgrade: any, upgradeIndex: number) => (
                                (upgrade.adultsFastFoodCoupon || upgrade.kidsFastFoodCoupon || upgrade.adultsMainFoodCoupon || upgrade.kidsMainFoodCoupon) && (
                                  <div key={upgradeIndex} className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                                    <div className="text-xs font-bold text-purple-800 mb-1">+ {upgrade.ticketType === '150' ? 'Regular Entry (₹150)' : upgrade.ticketType === '300' ? '3-4 Hours Entry (₹300)' : upgrade.ticketType === '450' ? 'Fast Food + Entry (₹450)' : upgrade.ticketType === '600' ? 'Main Food + Entry (₹600)' : upgrade.ticketType === '100' ? 'Sitting Only (₹100)' : upgrade.ticketType} Food</div>
                                    {/* Upgrade Fast Food */}
                                    {(upgrade.adultsFastFoodCoupon || upgrade.kidsFastFoodCoupon) && (
                                      <div className="mb-1">
                                        <div className="text-xs font-bold text-orange-700 mb-1">🍔 Fast Food</div>
                                        <div className="flex justify-between gap-2">
                                          {upgrade.adultsFastFoodCoupon && (
                                            <span className="text-xs text-orange-600">A: {safeString(upgrade.adultsFastFoodCoupon)}</span>
                                          )}
                                          {upgrade.kidsFastFoodCoupon && (
                                            <span className="text-xs text-orange-600">K: {safeString(upgrade.kidsFastFoodCoupon)}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {/* Upgrade Main Food */}
                                    {(upgrade.adultsMainFoodCoupon || upgrade.kidsMainFoodCoupon) && (
                                      <div>
                                        <div className="text-xs font-bold text-green-700 mb-1">🍽️ Main Food</div>
                                        <div className="flex justify-between gap-2">
                                          {upgrade.adultsMainFoodCoupon && (
                                            <span className="text-xs text-green-600">A: {safeString(upgrade.adultsMainFoodCoupon)}</span>
                                          )}
                                          {upgrade.kidsMainFoodCoupon && (
                                            <span className="text-xs text-green-600">K: {safeString(upgrade.kidsMainFoodCoupon)}</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              ))
                            )}
                            
                            {/* Overall Total - Including Upgrades */}
                            {((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon || (entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon ||
                              (entry.upgrades && entry.upgrades.some((u: any) => u.adultsFastFoodCoupon || u.kidsFastFoodCoupon || u.adultsMainFoodCoupon || u.kidsMainFoodCoupon))) && (
                              <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                                <div className="text-xs font-bold text-blue-800 mb-1">🎫 Total Coupons (All)</div>
                                <div className="text-xs font-bold text-blue-900">
                                  {(() => {
                                    let mainTotal = safeNumber((entry as any).adultsFastFoodCoupon) + 
                                                   safeNumber((entry as any).kidsFastFoodCoupon) + 
                                                   safeNumber((entry as any).adultsMainFoodCoupon) + 
                                                   safeNumber((entry as any).kidsMainFoodCoupon);
                                    let upgradeTotal = 0;
                                    if (entry.upgrades) {
                                      entry.upgrades.forEach((upgrade: any) => {
                                        upgradeTotal += safeNumber(upgrade.adultsFastFoodCoupon) + 
                                                         safeNumber(upgrade.kidsFastFoodCoupon) + 
                                                         safeNumber(upgrade.adultsMainFoodCoupon) + 
                                                         safeNumber(upgrade.kidsMainFoodCoupon);
                                      });
                                    }
                                    return mainTotal + upgradeTotal;
                                  })()}
                                </div>
                              </div>
                            )}
                            
                            {/* No Coupons */}
                            {!((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon || (entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon ||
                              (entry.upgrades && entry.upgrades.some((u: any) => u.adultsFastFoodCoupon || u.kidsFastFoodCoupon || u.adultsMainFoodCoupon || u.kidsMainFoodCoupon))) && (
                              <div className="text-xs text-gray-500 italic">No coupons</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 space-x-2">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setViewing(entry)}
                            className="px-2 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs border border-blue-200 transition"
                          >
                            👁
                          </motion.button>
                          {user?.role === 'admin' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setEditing(entry)}
                              className="px-2 py-1 rounded-lg bg-green-100 hover:bg-green-200 text-green-900 font-bold text-xs border border-green-200 transition"
                            >
                              ✏️
                            </motion.button>
                          )}
                          {user?.role === 'admin' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDelete(entry._id)}
                              className="px-2 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs border border-red-200 transition"
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
                {getTicketLabelSync(entry.ticketType as TicketType)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👥 Adults</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {safeString(entry.adults)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👦 Kids</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {safeString(entry.kids)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👥 Total</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {entry.ticketType === '150' ? safeString(entry.adults) : safeString(entry.totalPeople)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💰 Base Amount</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(entry.baseAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎯 Kid Discount</label>
              <div className="py-2 px-3 rounded bg-green-50 text-green-900 font-bold">
                -₹{safeString(entry.kidDiscount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💸 Final Amount</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold text-xl">
                ₹{safeString(entry.finalAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎁 Additional Discount</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                -₹{safeString(entry.additionalDiscount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💵 Cash</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(entry.cashAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💳 UPI</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(entry.upiAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🤝 Advance</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(entry.advanceAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💳 Other</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(entry.otherAmount)}
              </div>
            </div>
          </div>

          {(entry as any).notes && (
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">📝 Notes</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {safeString((entry as any).notes)}
              </div>
            </div>
          )}

          {entry.upgrades && entry.upgrades.length > 0 && (
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎟 Upgrade Tickets</label>
              <div className="space-y-3">
                {entry.upgrades.map((upgrade: any, index: number) => (
                  <div key={index} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-blue-900">
                        Upgrade #{index + 1}: {getTicketLabelSync(upgrade.ticketType as any)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-blue-700 font-bold text-xs mb-1">Adults</label>
                        <div className="py-2 px-3 rounded bg-white text-blue-900 font-bold">
                          {safeString(upgrade.adults)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-blue-700 font-bold text-xs mb-1">Kids</label>
                        <div className="py-2 px-3 rounded bg-white text-blue-900 font-bold">
                          {safeString(upgrade.kids)}
                        </div>
                      </div>
                    </div>
                    {/* Upgrade Food Coupons */}
                    {(upgrade.adultsFastFoodCoupon || upgrade.kidsFastFoodCoupon || upgrade.adultsMainFoodCoupon || upgrade.kidsMainFoodCoupon) && (
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <label className="block text-blue-700 font-bold text-xs mb-2">🍔 Food Coupons</label>
                        <div className="grid grid-cols-2 gap-2">
                          {upgrade.adultsFastFoodCoupon && (
                            <div>
                              <label className="block text-blue-600 text-xs mb-1">Adults Fast Food</label>
                              <div className="py-1 px-2 rounded bg-orange-50 text-orange-900 font-bold text-sm">
                                {safeString(upgrade.adultsFastFoodCoupon)}
                              </div>
                            </div>
                          )}
                          {upgrade.kidsFastFoodCoupon && (
                            <div>
                              <label className="block text-blue-600 text-xs mb-1">Kids Fast Food</label>
                              <div className="py-1 px-2 rounded bg-orange-50 text-orange-900 font-bold text-sm">
                                {safeString(upgrade.kidsFastFoodCoupon)}
                              </div>
                            </div>
                          )}
                          {upgrade.adultsMainFoodCoupon && (
                            <div>
                              <label className="block text-blue-600 text-xs mb-1">Adults Main Food</label>
                              <div className="py-1 px-2 rounded bg-green-50 text-green-900 font-bold text-sm">
                                {safeString(upgrade.adultsMainFoodCoupon)}
                              </div>
                            </div>
                          )}
                          {upgrade.kidsMainFoodCoupon && (
                            <div>
                              <label className="block text-blue-600 text-xs mb-1">Kids Main Food</label>
                              <div className="py-1 px-2 rounded bg-green-50 text-green-900 font-bold text-sm">
                                {safeString(upgrade.kidsMainFoodCoupon)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Entry Food Coupons */}
          {((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon || (entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🍔 Food Coupons</label>
              <div className="grid grid-cols-2 gap-4">
                {(entry as any).adultsFastFoodCoupon && (
                  <div>
                    <label className="block text-blue-700 font-bold text-xs mb-1">Adults Fast Food</label>
                    <div className="py-2 px-3 rounded bg-orange-50 text-orange-900 font-bold">
                      {safeString((entry as any).adultsFastFoodCoupon)}
                    </div>
                  </div>
                )}
                {(entry as any).kidsFastFoodCoupon && (
                  <div>
                    <label className="block text-blue-700 font-bold text-xs mb-1">Kids Fast Food</label>
                    <div className="py-2 px-3 rounded bg-orange-50 text-orange-900 font-bold">
                      {safeString((entry as any).kidsFastFoodCoupon)}
                    </div>
                  </div>
                )}
                {(entry as any).adultsMainFoodCoupon && (
                  <div>
                    <label className="block text-blue-700 font-bold text-xs mb-1">Adults Main Food</label>
                    <div className="py-2 px-3 rounded bg-green-50 text-green-900 font-bold">
                      {safeString((entry as any).adultsMainFoodCoupon)}
                    </div>
                  </div>
                )}
                {(entry as any).kidsMainFoodCoupon && (
                  <div>
                    <label className="block text-blue-700 font-bold text-xs mb-1">Kids Main Food</label>
                    <div className="py-2 px-3 rounded bg-green-50 text-green-900 font-bold">
                      {safeString((entry as any).kidsMainFoodCoupon)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-6 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-blue-900 font-bold">
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EditEntryModal({ entry, onClose, onSaved, setToast }: { entry: EntryRecord; onClose: () => void; onSaved: (id: string) => void; setToast: (toast: { message: string; id: string } | null) => void }) {
  const { user } = useAuthStore();
  const [name, setName] = useState(entry.name);
  const [mobile, setMobile] = useState(entry.mobile);
  const [ticketType, setTicketType] = useState(entry.ticketType as unknown as string);
  const [adults, setAdults] = useState<number>(entry.adults ?? 0);
  const [kids, setKids] = useState<number>(entry.kids ?? 0);
  const [upgrades, setUpgrades] = useState(entry.upgrades ?? [] as any[]);
  const [adultsFastFoodCoupon, setAdultsFastFoodCoupon] = useState(safeString((entry as any).adultsFastFoodCoupon));
  const [kidsFastFoodCoupon, setKidsFastFoodCoupon] = useState(safeString((entry as any).kidsFastFoodCoupon));
  const [adultsMainFoodCoupon, setAdultsMainFoodCoupon] = useState(safeString((entry as any).adultsMainFoodCoupon));
  const [kidsMainFoodCoupon, setKidsMainFoodCoupon] = useState(safeString((entry as any).kidsMainFoodCoupon));
  const [additionalDiscount, setAdditionalDiscount] = useState<number>(entry.additionalDiscount ?? 0);
  const [finalAmountOverride, setFinalAmountOverride] = useState<number | null>(entry.finalAmount ?? null);
  const [cashAmount, setCashAmount] = useState<number>(entry.cashAmount ?? 0);
  const [upiAmount, setUpiAmount] = useState<number>(entry.upiAmount ?? 0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(entry.advanceAmount ?? 0);
  const [otherAmount, setOtherAmount] = useState<number>(entry.otherAmount ?? 0);
  const [notes, setNotes] = useState(entry.notes ?? '');
  const [saving, setSaving] = useState(false);

  // compute amounts using imported helper
  const computed = computeAmountsSync(ticketType as any, adults, kids, upgrades, additionalDiscount);
  const baseAmount = computed.baseAmount;
  const kidDiscount = computed.kidDiscount;
  const totalPeople = computed.totalPeople;
  const computedFinal = computed.finalAmount;
  const finalAmount = finalAmountOverride != null ? finalAmountOverride : computedFinal;

  const addUpgrade = () => {
    const prices = ['100','150','300','450','600'];
    const idx = prices.indexOf(ticketType);
    const next = prices[idx+1] ?? prices[prices.length-1];
    setUpgrades([...upgrades, { 
      ticketType: next, 
      adults: 0, 
      kids: 0,
      adultsFastFoodCoupon: '',
      kidsFastFoodCoupon: '',
      adultsMainFoodCoupon: '',
      kidsMainFoodCoupon: ''
    }]);
  };

  // Ensure all upgrades have food coupon fields
  const ensureUpgradeFoodCoupons = (upgradesList: any[]) => {
    return upgradesList.map(upgrade => ({
      ...upgrade,
      adultsFastFoodCoupon: upgrade.adultsFastFoodCoupon || '',
      kidsFastFoodCoupon: upgrade.kidsFastFoodCoupon || '',
      adultsMainFoodCoupon: upgrade.adultsMainFoodCoupon || '',
      kidsMainFoodCoupon: upgrade.kidsMainFoodCoupon || ''
    }));
  };

  // Initialize upgrades with food coupon fields
  useEffect(() => {
    if (entry.upgrades && entry.upgrades.length > 0) {
      setUpgrades(ensureUpgradeFoodCoupons(entry.upgrades));
    }
  }, [entry.upgrades]);

  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Debug: Check user authentication
      const token = localStorage.getItem('token');
      console.log('🔧 EditEntryModal: Token exists:', !!token);
      console.log('🔧 EditEntryModal: User role:', user?.role);
      
      const payload = {
        name: name.trim(),
        mobile: mobile.trim(),
        ticketType,
        adults,
        kids,
        upgrades,
        adultsFastFoodCoupon: adultsFastFoodCoupon.trim() || undefined,
        kidsFastFoodCoupon: kidsFastFoodCoupon.trim() || undefined,
        adultsMainFoodCoupon: adultsMainFoodCoupon.trim() || undefined,
        kidsMainFoodCoupon: kidsMainFoodCoupon.trim() || undefined,
        totalPeople,
        baseAmount,
        kidDiscount,
        additionalDiscount,
        finalAmount,
        cashAmount,
        upiAmount,
        advanceAmount,
        otherAmount,
        notes: notes.trim() || undefined,
      };

      console.log('🔧 EditEntryModal: Payload to send:', payload);
      console.log('🔧 EditEntryModal: Upgrades with food coupons:', upgrades);
      
      const response = await entriesApi.update(entry._id, payload);
      console.log('🔧 EditEntryModal: Update response:', response);
      
      // Show success feedback
      setToast({ message: '✅ Entry updated successfully!', id: `update-${entry._id}` });
      
      setTimeout(() => {
        const rowEl = document.getElementById(`entry-row-${entry._id}`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      
      onSaved(entry._id);
      
      window.dispatchEvent(new CustomEvent('entry-updated', { 
        detail: { 
          entryId: entry._id, 
          action: 'update',
          timestamp: new Date().toISOString()
        } 
      }));
      
    } catch (e) {
      console.error('❌ EditEntryModal: Failed to update entry:', e);
      console.error('❌ EditEntryModal: Error details:', {
        message: (e as Error).message,
        stack: (e as Error).stack
      });
      setToast({ message: `❌ Failed to update entry: ${(e as Error).message}`, id: `error-${entry._id}` });
    } finally {
      setSaving(false);
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
        className="modern-card rounded-2xl p-6 max-w-4xl w-full flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <h3 className="heading-lg text-blue-900 mb-4 flex-shrink-0">✏️ Edit Entry</h3>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-modern" />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Mobile</label>
              <input value={mobile} onChange={(e) => setMobile(e.target.value)} className="input-modern" />
            </div>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">Ticket Type</label>
            <select value={ticketType} onChange={(e) => setTicketType(e.target.value)} className="input-modern">
              {TICKET_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>₹{t.price} - {t.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Adults</label>
              <select value={String(adults)} onChange={(e) => setAdults(parseInt(e.target.value,10)||0)} className="input-modern">
                {Array.from({length: 31}).map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Kids</label>
              <select value={String(kids)} onChange={(e) => setKids(parseInt(e.target.value,10)||0)} className="input-modern">
                {Array.from({length: 31}).map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Total</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                {ticketType === '150' ? safeString(adults) : safeString(totalPeople)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">Base Amount</label>
              <div className="py-2 px-3 rounded bg-blue-50 text-blue-900 font-bold">
                ₹{safeString(baseAmount)}
              </div>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎯 Kid Discount</label>
              <div className="py-2 px-3 rounded bg-green-50 text-green-900 font-bold">
                -₹{safeString(kidDiscount)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💸 Final Amount</label>
              <input 
                type="number" 
                value={finalAmount != null ? String(finalAmount) : ''} 
                onChange={(e) => setFinalAmountOverride(e.target.value ? parseFloat(e.target.value) : null)} 
                className="input-modern" 
                placeholder={`Calculated: ₹${computedFinal}`}
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🎁 Additional Discount</label>
              <input 
                type="number" 
                value={String(additionalDiscount)} 
                onChange={(e) => setAdditionalDiscount(parseFloat(e.target.value)||0)} 
                className="input-modern" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💵 Cash</label>
              <input 
                type="number" 
                value={String(cashAmount)} 
                onChange={(e) => setCashAmount(parseFloat(e.target.value)||0)} 
                className="input-modern" 
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💳 UPI</label>
              <input 
                type="number" 
                value={String(upiAmount)} 
                onChange={(e) => setUpiAmount(parseFloat(e.target.value)||0)} 
                className="input-modern" 
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">🤝 Advance</label>
              <input 
                type="number" 
                value={String(advanceAmount)} 
                onChange={(e) => setAdvanceAmount(parseFloat(e.target.value)||0)} 
                className="input-modern" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">💳 Other</label>
              <input 
                type="number" 
                value={String(otherAmount)} 
                onChange={(e) => setOtherAmount(parseFloat(e.target.value)||0)} 
                className="input-modern" 
              />
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">📝 Notes</label>
              <input 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)} 
                className="input-modern" 
              />
            </div>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🍔 Food Coupons</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-blue-700 font-bold text-xs mb-1">Adults Fast Food</label>
                <input value={adultsFastFoodCoupon} onChange={(e)=>setAdultsFastFoodCoupon(e.target.value)} className="input-modern" placeholder="e.g., 2" />
              </div>
              <div>
                <label className="block text-blue-700 font-bold text-xs mb-1">Kids Fast Food</label>
                <input value={kidsFastFoodCoupon} onChange={(e)=>setKidsFastFoodCoupon(e.target.value)} className="input-modern" placeholder="e.g., 1" />
              </div>
              <div>
                <label className="block text-blue-700 font-bold text-xs mb-1">Adults Main Food</label>
                <input value={adultsMainFoodCoupon} onChange={(e)=>setAdultsMainFoodCoupon(e.target.value)} className="input-modern" placeholder="e.g., 2" />
              </div>
              <div>
                <label className="block text-blue-700 font-bold text-xs mb-1">Kids Main Food</label>
                <input value={kidsMainFoodCoupon} onChange={(e)=>setKidsMainFoodCoupon(e.target.value)} className="input-modern" placeholder="e.g., 1" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-blue-900 font-bold text-sm mb-2">🎟 Upgrade Tickets</label>
            <div className="space-y-3">
              {upgrades.length > 0 ? (
                upgrades.map((upgrade, index) => (
                  <div key={index} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-blue-900">
                        Upgrade #{index + 1}: {getTicketLabelSync(upgrade.ticketType as any)}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const newUpgrades = upgrades.filter((_, i) => i !== index);
                          setUpgrades(newUpgrades);
                        }}
                        className="px-3 py-1 rounded-lg bg-red-100 hover:bg-red-200 text-red-900 font-bold text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-blue-700 font-bold text-xs mb-1">Adults</label>
                        <input
                          type="number"
                          value={String(upgrade.adults)}
                          onChange={(e) => {
                            const newUpgrades = [...upgrades];
                            newUpgrades[index].adults = parseInt(e.target.value, 10) || 0;
                            setUpgrades(newUpgrades);
                          }}
                          className="input-modern"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-blue-700 font-bold text-xs mb-1">Kids</label>
                        <input
                          type="number"
                          value={String(upgrade.kids)}
                          onChange={(e) => {
                            const newUpgrades = [...upgrades];
                            newUpgrades[index].kids = parseInt(e.target.value, 10) || 0;
                            setUpgrades(newUpgrades);
                          }}
                          className="input-modern"
                          min="0"
                        />
                      </div>
                    </div>
                    {/* Food Coupons for Upgrade */}
                    <div className="mt-3 pt-3 border-t border-blue-200">
                      <label className="block text-blue-700 font-bold text-xs mb-2">🍔 Food Coupons for this Upgrade</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-blue-600 font-bold text-xs mb-1">Adults Fast Food</label>
                          <input
                            type="text"
                            value={upgrade.adultsFastFoodCoupon || ''}
                            onChange={(e) => {
                              const newUpgrades = [...upgrades];
                              newUpgrades[index].adultsFastFoodCoupon = e.target.value;
                              setUpgrades(newUpgrades);
                            }}
                            className="input-modern text-xs"
                            placeholder="e.g., 2"
                          />
                        </div>
                        <div>
                          <label className="block text-blue-600 font-bold text-xs mb-1">Kids Fast Food</label>
                          <input
                            type="text"
                            value={upgrade.kidsFastFoodCoupon || ''}
                            onChange={(e) => {
                              const newUpgrades = [...upgrades];
                              newUpgrades[index].kidsFastFoodCoupon = e.target.value;
                              setUpgrades(newUpgrades);
                            }}
                            className="input-modern text-xs"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div>
                          <label className="block text-blue-600 font-bold text-xs mb-1">Adults Main Food</label>
                          <input
                            type="text"
                            value={upgrade.adultsMainFoodCoupon || ''}
                            onChange={(e) => {
                              const newUpgrades = [...upgrades];
                              newUpgrades[index].adultsMainFoodCoupon = e.target.value;
                              setUpgrades(newUpgrades);
                            }}
                            className="input-modern text-xs"
                            placeholder="e.g., 2"
                          />
                        </div>
                        <div>
                          <label className="block text-blue-600 font-bold text-xs mb-1">Kids Main Food</label>
                          <input
                            type="text"
                            value={upgrade.kidsMainFoodCoupon || ''}
                            onChange={(e) => {
                              const newUpgrades = [...upgrades];
                              newUpgrades[index].kidsMainFoodCoupon = e.target.value;
                              setUpgrades(newUpgrades);
                            }}
                            className="input-modern text-xs"
                            placeholder="e.g., 1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500 mb-3">No upgrade tickets added</p>
                  <button
                    type="button"
                    onClick={addUpgrade}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                  >
                    Add Upgrade Ticket
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={addUpgrade}
                className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                ➕ Add Upgrade Ticket
              </button>
            </div>
          </div>

          <div className="flex gap-3 mt-6 flex-shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-blue-900 font-bold">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
