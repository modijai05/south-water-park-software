import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { getTicketLabel, computeAmounts, TICKET_OPTIONS } from '@/lib/ticketUtils';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import type { EntryRecord, TicketType } from '@/types';

// Helper function to safely convert values to strings
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
  const [allEntries, setAllEntries] = useState<EntryRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [editing, setEditing] = useState<EntryRecord | null>(null);
  const [viewing, setViewing] = useState<EntryRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; id: string; type?: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  
  // Performance optimizations
  const debouncedSearch = useDebounce(search, 300);
  const lastFetchTime = useRef<number>(0);

  // Fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simple fetch function - fetch ALL original MongoDB data
  const fetchEntries = useCallback(async () => {
    if (!isClient) return;
    
    setLoading(true);
    console.log('🔍 Fetching ALL original MongoDB entries...');
    
    try {
      // Fetch ALL entries without any limits to get original data
      const res = await entriesApi.list({ page: 1, limit: 50000 });
      
      const fetchedEntries = (res.data?.entries as EntryRecord[]) ?? [];
      const totalEntries = res.data?.total ?? 0;
      
      console.log('🔍 Fetched ALL original entries:', fetchedEntries.length, 'of', totalEntries);
      console.log('🔍 Sample entry data:', fetchedEntries[0]);
      
      setAllEntries(fetchedEntries);
      setTotal(totalEntries);
      setEntries(fetchedEntries);
      
    } catch (error) {
      console.error('🔍 Failed to fetch entries:', error);
      setToast({ 
        message: '⚠️ Failed to load entries. Please refresh the page.', 
        id: 'fetch-error',
        type: 'error'
      });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [isClient]);

  // Filter entries based on search
  const filteredEntries = useMemo(() => {
    if (!search.trim()) return allEntries;
    
    const searchTerm = search.toLowerCase().trim();
    return allEntries.filter(entry => 
      entry.name?.toLowerCase().includes(searchTerm) ||
      entry.mobile?.toLowerCase().includes(searchTerm) ||
      entry.filledByFullName?.toLowerCase().includes(searchTerm) ||
      entry.ticketType?.toLowerCase().includes(searchTerm)
    );
  }, [allEntries, search]);

  // Initial load
  useEffect(() => {
    console.log('🔍 Component mounted, fetching entries...');
    fetchEntries();
  }, [fetchEntries]);

  // Handle search with debounced value
  useEffect(() => {
    if (debouncedSearch !== search) {
      return;
    }
    
    // Apply search filter
    if (search.trim() === '') {
      setEntries(allEntries);
    } else {
      setEntries(filteredEntries);
    }
  }, [debouncedSearch, search, allEntries, filteredEntries]);

  // Delete entry function
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await entriesApi.delete(id);
      setAllEntries(prev => prev.filter(entry => entry._id !== id));
      setEntries(prev => prev.filter(entry => entry._id !== id));
      setTotal(prev => prev - 1);
      
      setToast({ 
        message: '✅ Entry deleted successfully', 
        id: 'delete-success',
        type: 'success'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Delete error:', error);
      setToast({ 
        message: '❌ Failed to delete entry', 
        id: 'delete-error',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Clear all entries function
  const handleClearAllEntries = async () => {
    if (!confirm('Are you sure you want to clear ALL entries? This action cannot be undone!')) return;
    
    try {
      await entriesApi.clearAll();
      setAllEntries([]);
      setEntries([]);
      setTotal(0);
      
      setToast({ 
        message: '✅ All entries cleared successfully', 
        id: 'clear-success',
        type: 'success'
      });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Clear all error:', error);
      setToast({ 
        message: '❌ Failed to clear entries', 
        id: 'clear-error',
        type: 'error'
      });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Refresh entries
  const handleRefresh = () => {
    fetchEntries();
  };

  if (!isClient) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Entries Management</h1>
            <p className="text-gray-600 mt-1">View and manage all customer entries</p>
          </div>
          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition"
              disabled={loading}
            >
              🔄 Refresh
            </motion.button>
            <Link to="/entries/new">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition"
              >
                ➕ New Entry
              </motion.button>
            </Link>
            {user?.role === 'admin' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleClearAllEntries}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition"
              >
                🗑️ Clear All
              </motion.button>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{allEntries.length}</div>
              <div className="text-sm text-gray-600">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{filteredEntries.length}</div>
              <div className="text-sm text-gray-600">Filtered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {allEntries.filter(e => dayjs(e.createdAt).isSame(dayjs(), 'day')).length}
              </div>
              <div className="text-sm text-gray-600">Today</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                ₹{allEntries.reduce((sum, e) => sum + safeNumber(e.finalAmount), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, mobile, ticket type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSearch('')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Professional Excel-like Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {initialLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading entries...</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Table Header */}
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '120px' }}>
                      Date & Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '140px' }}>
                      Filled By
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '150px' }}>
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '120px' }}>
                      Mobile
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '100px' }}>
                      Ticket Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '60px' }}>
                      Adults
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '60px' }}>
                      Kids
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '60px' }}>
                      Total
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Cash
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      UPI
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Advance
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Other
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '120px' }}>
                      Food Coupons
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider" style={{ width: '100px' }}>
                      Actions
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="bg-white divide-y divide-gray-200">
                  {entries.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                        {search ? 'No entries found matching your search' : 'No entries found'}
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, index) => (
                      <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div>
                            <div className="font-medium">{dayjs(entry.createdAt).format('DD/MM/YY')}</div>
                            <div className="text-xs text-gray-500">{dayjs(entry.createdAt).format('hh:mm A')}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div className="font-medium">{safeString(entry.filledByFullName || 'Unknown')}</div>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100">
                          {safeString(entry.name)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div className="font-mono">{safeString(entry.mobile)}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                            ₹{getTicketLabel(entry.ticketType as TicketType)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          {safeString(entry.adults)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          {entry.ticketType === '150' ? '-' : safeString(entry.kids)}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-center border-r border-gray-100">
                          {entry.ticketType === '150' ? safeString(entry.adults) : safeString(entry.totalPeople)}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600 text-center border-r border-gray-100">
                          ₹{safeString(entry.finalAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          ₹{safeString(entry.cashAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          ₹{safeString(entry.upiAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          ₹{safeString(entry.advanceAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center border-r border-gray-100">
                          ₹{safeString(entry.otherAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div className="space-y-1">
                            {((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon) && (
                              <div className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs">
                                🍔 FF: A:{safeString((entry as any).adultsFastFoodCoupon)} K:{safeString((entry as any).kidsFastFoodCoupon)}
                              </div>
                            )}
                            {((entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
                              <div className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                🍽️ MF: A:{safeString((entry as any).adultsMainFoodCoupon)} K:{safeString((entry as any).kidsMainFoodCoupon)}
                              </div>
                            )}
                            {!((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon || (entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
                              <div className="text-xs text-gray-500 italic">No coupons</div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="flex gap-1 justify-center">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => setViewing(entry)}
                              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-medium transition"
                              title="View entry"
                            >
                              👁
                            </motion.button>
                            {user?.role === 'admin' && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setEditing(entry)}
                                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium transition"
                                title="Edit entry"
                              >
                                ✏️
                              </motion.button>
                            )}
                            {user?.role === 'admin' && (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleDelete(entry._id)}
                                className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs font-medium transition"
                                title="Delete entry"
                              >
                                🗑️
                              </motion.button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Toast Notifications */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
                toast.type === 'success' ? 'bg-green-500 text-white' :
                toast.type === 'error' ? 'bg-red-500 text-white' :
                toast.type === 'warning' ? 'bg-yellow-500 text-white' :
                'bg-blue-500 text-white'
              }`}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* View/Edit Modals */}
        {(viewing || editing) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {editing ? 'Edit Entry' : 'View Entry'}
                </h2>
                <button
                  onClick={() => {
                    setViewing(null);
                    setEditing(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      type="text"
                      value={editing ? editing.name : (viewing?.name || '')}
                      onChange={(e) => editing && setEditing({...editing, name: e.target.value})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
                    <input
                      type="text"
                      value={editing ? editing.mobile : (viewing?.mobile || '')}
                      onChange={(e) => editing && setEditing({...editing, mobile: e.target.value})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adults</label>
                    <input
                      type="number"
                      value={editing ? editing.adults : (viewing?.adults?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, adults: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kids</label>
                    <input
                      type="number"
                      value={editing ? editing.kids : (viewing?.kids?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, kids: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type</label>
                    <select
                      value={editing ? editing.ticketType : (viewing?.ticketType || '150')}
                      onChange={(e) => editing && setEditing({...editing, ticketType: e.target.value as TicketType})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    >
                      {TICKET_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cash</label>
                    <input
                      type="number"
                      value={editing ? editing.cashAmount?.toString() : (viewing?.cashAmount?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, cashAmount: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UPI</label>
                    <input
                      type="number"
                      value={editing ? editing.upiAmount?.toString() : (viewing?.upiAmount?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, upiAmount: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Advance</label>
                    <input
                      type="number"
                      value={editing ? editing.advanceAmount?.toString() : (viewing?.advanceAmount?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, advanceAmount: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Other</label>
                    <input
                      type="number"
                      value={editing ? editing.otherAmount?.toString() : (viewing?.otherAmount?.toString() || '')}
                      onChange={(e) => editing && setEditing({...editing, otherAmount: parseInt(e.target.value) || 0})}
                      disabled={!editing}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setViewing(null);
                    setEditing(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                {editing && (
                  <button
                    onClick={async () => {
                      try {
                        await entriesApi.update(editing._id, editing);
                        setAllEntries(prev => prev.map(e => e._id === editing._id ? editing : e));
                        setEntries(prev => prev.map(e => e._id === editing._id ? editing : e));
                        setEditing(null);
                        setToast({ 
                          message: '✅ Entry updated successfully', 
                          id: 'update-success',
                          type: 'success'
                        });
                        setTimeout(() => setToast(null), 3000);
                      } catch (error) {
                        console.error('Update error:', error);
                        setToast({ 
                          message: '❌ Failed to update entry', 
                          id: 'update-error',
                          type: 'error'
                        });
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    Save Changes
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
