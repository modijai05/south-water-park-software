import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { getTicketLabel, getTicketLabelSync, computeAmounts, computeAmountsSync, TICKET_OPTIONS } from '@/lib/ticketUtils';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/hooks/useDebounce';
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
  const [allEntries, setAllEntries] = useState<EntryRecord[]>([]); // Cache for all entries
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false); // Only for first load
  const [editing, setEditing] = useState<EntryRecord | null>(null);
  const [viewing, setViewing] = useState<EntryRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; id: string } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: string; value: string } | null>(null);
  const limit = 50; // Reduced for better performance
  
  // Performance optimizations
  const debouncedSearch = useDebounce(search, 300);
  const searchCache = useRef<Map<string, EntryRecord[]>>(new Map());
  const lastFetchTime = useRef<number>(0);
  
  // Date-wise pagination state
  const [dateGroups, setDateGroups] = useState<{ today: EntryRecord[], yesterday: EntryRecord[], older: EntryRecord[] }>({
    today: [],
    yesterday: [], 
    older: []
  });
  const [activeDateGroup, setActiveDateGroup] = useState<'today' | 'yesterday' | 'older'>('today');
  const [olderPage, setOlderPage] = useState(1);

  // Fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Group entries by date for optimized display
  const groupEntriesByDate = useCallback((entries: EntryRecord[]) => {
    const now = dayjs();
    const today = now.startOf('day');
    const yesterday = today.subtract(1, 'day');
    
    const groups = {
      today: [] as EntryRecord[],
      yesterday: [] as EntryRecord[],
      older: [] as EntryRecord[]
    };
    
    entries.forEach(entry => {
      const entryDate = dayjs(entry.createdAt).startOf('day');
      if (entryDate.isSame(today, 'day')) {
        groups.today.push(entry);
      } else if (entryDate.isSame(yesterday, 'day')) {
        groups.yesterday.push(entry);
      } else {
        groups.older.push(entry);
      }
    });
    
    return groups;
  }, []);
  
  // In-memory search filtering for instant results
  const filterEntries = useCallback((entries: EntryRecord[], searchTerm: string) => {
    if (!searchTerm.trim()) return entries;
    
    const term = searchTerm.toLowerCase();
    return entries.filter(entry => 
      entry.name?.toLowerCase().includes(term) ||
      entry.mobile?.toLowerCase().includes(term) ||
      entry.ticketType?.toLowerCase().includes(term) ||
      entry.receiptNumber?.toLowerCase().includes(term) ||
      entry.filledByFullName?.toLowerCase().includes(term) ||
      (entry.createdBy as any)?.username?.toLowerCase().includes(term)
    );
  }, []);
  
  // Memoized filtered entries for instant search
  const filteredEntries = useMemo(() => {
    if (!search.trim()) {
      return allEntries; // Return all entries if no search
    }
    
    // Check cache first
    const cacheKey = search.toLowerCase();
    if (searchCache.current.has(cacheKey)) {
      return searchCache.current.get(cacheKey)!;
    }
    
    // Filter and cache
    const filtered = filterEntries(allEntries, search);
    searchCache.current.set(cacheKey, filtered);
    
    // Clear cache if it gets too large
    if (searchCache.current.size > 50) {
      const firstKey = searchCache.current.keys().next().value;
      searchCache.current.delete(firstKey);
    }
    
    return filtered;
  }, [allEntries, search, filterEntries]);
  
  // Get current entries based on active date group and pagination
  const currentEntries = useMemo(() => {
    let sourceEntries = filteredEntries;
    
    // Apply date-wise filtering
    if (activeDateGroup === 'today') {
      sourceEntries = dateGroups.today;
    } else if (activeDateGroup === 'yesterday') {
      sourceEntries = dateGroups.yesterday;
    } else {
      // Older entries with pagination
      const startIndex = (olderPage - 1) * limit;
      const endIndex = startIndex + limit;
      sourceEntries = dateGroups.older.slice(startIndex, endIndex);
    }
    
    // Apply search filtering if search exists
    if (search.trim()) {
      return filterEntries(sourceEntries, search);
    }
    
    return sourceEntries;
  }, [filteredEntries, activeDateGroup, dateGroups, olderPage, limit, search, filterEntries]);
  
  // Update date groups when all entries change
  useEffect(() => {
    const groups = groupEntriesByDate(allEntries);
    setDateGroups(groups);
  }, [allEntries, groupEntriesByDate]);
  
  // Optimized fetch with caching
  const fetchEntries = useCallback(async (forceRefresh = false) => {
    if (!isClient) return;
    
    const now = Date.now();
    const cacheDuration = 30000; // 30 seconds cache
    
    // Use cached data if available and not force refresh
    if (!forceRefresh && allEntries.length > 0 && (now - lastFetchTime.current) < cacheDuration) {
      console.log('🔍 Using cached entries');
      return;
    }
    
    setInitialLoading(allEntries.length === 0); // Only show loading on first fetch
    setLoading(true);
    console.log('🔍 AdminEntries: Fetching entries with params:', { search: debouncedSearch || undefined, page, limit });
    
    try {
      const res = await entriesApi.list({ search: undefined, page: 1, limit: 1000 }); // Fetch more for caching
      
      console.log('🔍 AdminEntries: API response:', { success: res.success, entriesCount: res.data?.entries?.length || 0, total: res.data?.total || 0 });
      
      const fetchedEntries = (res.data?.entries as EntryRecord[]) ?? [];
      setAllEntries(fetchedEntries);
      setTotal(res.data?.total ?? 0);
      lastFetchTime.current = now;
      
        // Debug first entry filled by fields
        if (fetchedEntries.length > 0) {
          const firstEntry = fetchedEntries[0];
          console.log('🔍 AdminEntries: First entry filledBy debug:', {
            filledByFullName: firstEntry.filledByFullName,
            createdBy: firstEntry.createdBy,
            user: user?.username
          });
        }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [isClient, debouncedSearch, page, limit, allEntries.length, user?.username]);
  
  // Initial load
  useEffect(() => {
    fetchEntries();
  }, []);
  
  // Handle search with debounced value
  useEffect(() => {
    if (debouncedSearch !== search) {
      // Search changed, but debounced value hasn't caught up yet
      return;
    }
    
    // Clear search cache when search changes
    if (search.trim() === '') {
      searchCache.current.clear();
    }
    
    // For search, we use in-memory filtering, no API call needed
    console.log('🔍 Using in-memory search for:', search);
  }, [debouncedSearch, search]);

  // Virtualization setup for large lists
  const parentRef = useRef<HTMLDivElement>(null);
  
  const rowVirtualizer = useVirtualizer({
    count: currentEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated row height
    overscan: 5, // Render 5 extra rows above/below viewport
  });
  useEffect(() => {
    const handleEntryUpdate = () => {
      console.log('AdminEntries: Real-time sync triggered');
      fetchEntries(true); // Force refresh on updates
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
      fetchEntries(true);
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
  }, [fetchEntries]);

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
      
      fetchEntries(true); // Force refresh after delete
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleInlineEdit = async (id: string, field: string, value: string) => {
    try {
      const entry = allEntries.find(e => e._id === id);
      if (!entry) return;
      
      const updateData = { ...entry, [field]: value };
      await entriesApi.update(id, updateData);
      
      // Update local state instantly
      setAllEntries(prev => prev.map(e => 
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

        {/* Date-wise Navigation */}
        <div className="modern-card">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveDateGroup('today')}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  activeDateGroup === 'today' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
                }`}
              >
                📅 Today ({dateGroups.today.length})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveDateGroup('yesterday')}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  activeDateGroup === 'yesterday' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
                }`}
              >
                📅 Yesterday ({dateGroups.yesterday.length})
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveDateGroup('older')}
                className={`px-4 py-2 rounded-lg font-bold transition ${
                  activeDateGroup === 'older' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-blue-100 hover:bg-blue-200 text-blue-900'
                }`}
              >
                📅 Older ({dateGroups.older.length})
              </motion.button>
            </div>
            
            {/* Older entries pagination */}
            {activeDateGroup === 'older' && dateGroups.older.length > limit && (
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOlderPage(p => Math.max(1, p - 1))}
                  disabled={olderPage === 1}
                  className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  ←
                </motion.button>
                <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-900 font-bold text-sm">
                  {olderPage}
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setOlderPage(p => Math.min(Math.ceil(dateGroups.older.length / limit), p + 1))}
                  disabled={olderPage * limit >= dateGroups.older.length}
                  className="px-3 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  →
                </motion.button>
              </div>
            )}
          </div>
        </div>

        {/* Search Results Info */}
        {search.trim() && (
          <div className="modern-card bg-blue-50">
            <p className="text-blue-800 text-center">
              🔍 Found {currentEntries.length} entries matching "{search}"
              {search.trim() && allEntries.length > 0 && (
                <span className="text-blue-600">
                  {' '}from {allEntries.length} total entries
                </span>
              )}
            </p>
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

        {/* Entries Table with Virtualization */}
        <div className="modern-card">
          {initialLoading ? (
            // Skeleton loader for first load only
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-4 bg-blue-200 rounded w-1/4 mb-4"></div>
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-blue-100 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div 
              ref={parentRef}
              className="overflow-x-auto"
              style={{ height: '600px', overflow: 'auto' }}
            >
              {/* Table Header */}
              <div className="sticky top-0 bg-white z-10">
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
                </table>
              </div>
              
              {/* Virtualized Table Body */}
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative'
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                  const entry = currentEntries[virtualItem.index];
                  if (!entry) return null;
                  
                  return (
                    <div
                      key={virtualItem.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`
                      }}
                    >
                      <table className="w-full text-left text-sm">
                        <tbody>
                          <tr className="border-b border-gray-100 hover:bg-blue-50 transition">
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
                                    👤 {isClient ? (entry.filledByFullName || user?.fullName || user?.username || 'Unknown') : 'Loading...'}
                                  </span>
                                  {entry.createdBy && (
                                    <span className="px-2 py-1 rounded-lg bg-purple-100 text-purple-900 font-bold text-xs border border-purple-300">
                                      {(entry.createdBy as any).username === user?.username ? '👤 You' : '👨 Staff'}
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
                                      <span className="text-xs text-orange-700">
                                        A: {safeString((entry as any).adultsFastFoodCoupon)}
                                      </span>
                                      <span className="text-xs text-orange-700">
                                        K: {safeString((entry as any).kidsFastFoodCoupon)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Main Food Coupons */}
                                {((entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
                                  <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                                    <div className="text-xs font-bold text-green-800 mb-1">🍽️ Main Food</div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-xs text-green-700">
                                        A: {safeString((entry as any).adultsMainFoodCoupon)}
                                      </span>
                                      <span className="text-xs text-green-700">
                                        K: {safeString((entry as any).kidsMainFoodCoupon)}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                
                                {/* No Coupons */}
                                {!((entry as any).adultsFastFoodCoupon || (entry as any).kidsFastFoodCoupon || (entry as any).adultsMainFoodCoupon || (entry as any).kidsMainFoodCoupon) && (
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
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
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
  const [entryDate, setEntryDate] = useState(entry.createdAt ? dayjs(entry.createdAt).format('YYYY-MM-DDTHH:mm') : '');
  const [filledBy, setFilledBy] = useState((entry as any).filledBy || '');
  const [filledByFullName, setFilledByFullName] = useState((entry as any).filledByFullName || '');
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
        createdAt: entryDate ? new Date(entryDate).toISOString() : undefined,
        filledBy: filledBy.trim() || undefined,
        filledByFullName: filledByFullName.trim() || undefined,
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
            <label className="block text-blue-900 font-bold text-sm mb-2">📅 Entry Date & Time</label>
            <input 
              type="datetime-local" 
              value={entryDate} 
              onChange={(e) => setEntryDate(e.target.value)} 
              className="input-modern"
            />
            <p className="text-xs text-gray-500 mt-1">
              Original: {dayjs(entry.createdAt).format('DD/MM/YYYY hh:mm A')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👤 Filled By (Username)</label>
              <input 
                type="text" 
                value={filledBy} 
                onChange={(e) => setFilledBy(e.target.value)} 
                className="input-modern"
                placeholder="Enter username"
              />
              <p className="text-xs text-gray-500 mt-1">
                Original: {(entry as any).filledBy || 'Not set'}
              </p>
            </div>
            <div>
              <label className="block text-blue-900 font-bold text-sm mb-2">👤 Filled By (Full Name)</label>
              <input 
                type="text" 
                value={filledByFullName} 
                onChange={(e) => setFilledByFullName(e.target.value)} 
                className="input-modern"
                placeholder="Enter full name"
              />
              <p className="text-xs text-gray-500 mt-1">
                Original: {(entry as any).filledByFullName || 'Not set'}
              </p>
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
