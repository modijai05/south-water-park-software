import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { getTicketLabel, getTicketLabelSync, computeAmounts, TICKET_OPTIONS } from '@/lib/ticketUtils';
import { useEntryStore } from '@/store/entryStore';
import { useAuthStore } from '@/store/authStore';
import { useDebounce } from '@/hooks/useDebounce';
import { globalSyncService } from '@/services/globalSyncService';
import { getEffectiveEntryDate, getFormattedEntryDate, getFormattedEntryTime, prepareEntryForAPI, formatDateTimeForInput, convertDateTimeLocalToISO, isEntryToday, isEntryYesterday } from '@/utils/dateUtils';
import { setPreventForceReset } from '@/utils/forceDailyReset';
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
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [editing, setEditing] = useState<EntryRecord | null>(null);
  const [viewing, setViewing] = useState<EntryRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{ message: string; id: string; type?: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  
  // Performance optimizations
  const debouncedSearch = useDebounce(search, 300);
  const lastFetchTime = useRef<number>(0);

  // Fix hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Simple fetch function - fetch ALL original MongoDB data
  const fetchEntries = useCallback(async (forceRefresh = false) => {
    if (!isClient) return;
    
    setLoading(true);
    const refreshMsg = forceRefresh ? 'Forcing refresh of' : 'Fetching';
    console.log(` ${refreshMsg} ALL original MongoDB entries...`);
    
    try {
      // Fetch ALL entries without any limits to get original data
      // Add cache-busting timestamp when forcing refresh
      const cacheBuster = forceRefresh ? `&_cb=${Date.now()}` : '';
      const res = await entriesApi.list({ page: 1, limit: 50000 });
      
      // If forcing refresh, also make a second call to ensure fresh data
      let fetchedEntries = (res.data?.entries as EntryRecord[]) ?? [];
      if (forceRefresh) {
        console.log('Force refresh detected, making additional fresh data call...');
        try {
          const freshRes = await entriesApi.list({ page: 1, limit: 50000 });
          fetchedEntries = (freshRes.data?.entries as EntryRecord[]) ?? [];
          console.log('Fresh data received:', fetchedEntries.length);
        } catch (freshError) {
          console.warn('Fresh data fetch failed, using original data:', freshError);
        }
      }
      
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

  // Add a manual trigger for filter recalculation
  const [, setFilterTrigger] = useState(0);
  
  // Filter entries based on search and date
  const filteredEntries = useMemo(() => {
    let filtered = allEntries;
    
    console.log('DEBUG: filteredEntries useMemo running:', {
      allEntriesCount: allEntries.length,
      dateFilter,
      search
    });
    
    // CRITICAL FIX: Sort entries by effective date first (newest first)
    filtered = [...filtered].sort((a, b) => {
      const dateA = getEffectiveEntryDate(a);
      const dateB = getEffectiveEntryDate(b);
      
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      
      // Sort by date descending (newest first), then by receipt number as tiebreaker
      const dateComparison = dayjs(dateB).valueOf() - dayjs(dateA).valueOf();
      if (dateComparison !== 0) return dateComparison;
      
      // Tiebreaker: sort by receipt number if available
      const receiptA = a.receiptNumber || '';
      const receiptB = b.receiptNumber || '';
      return receiptB.localeCompare(receiptA);
    });
    
    // Apply date filter
    if (dateFilter === 'today') {
      filtered = filtered.filter(entry => {
        const isToday = dayjs(getEffectiveEntryDate(entry)).isSame(dayjs(), 'day');
        return isToday;
      });
      console.log('DEBUG: Today filter applied:', {
        beforeCount: allEntries.length,
        afterCount: filtered.length,
        today: dayjs().format('YYYY-MM-DD')
      });
    } else if (dateFilter === 'yesterday') {
      filtered = filtered.filter(entry => {
        const isYesterday = dayjs(getEffectiveEntryDate(entry)).isSame(dayjs().subtract(1, 'day'), 'day');
        return isYesterday;
      });
      console.log('DEBUG: Yesterday filter applied:', {
        beforeCount: allEntries.length,
        afterCount: filtered.length,
        yesterday: dayjs().subtract(1, 'day').format('YYYY-MM-DD')
      });
    }
    
    // Apply search filter
    if (search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      const beforeSearchCount = filtered.length;
      filtered = filtered.filter(entry => 
        entry.name?.toLowerCase().includes(searchTerm) ||
        entry.mobile?.toLowerCase().includes(searchTerm) ||
        entry.filledByFullName?.toLowerCase().includes(searchTerm) ||
        entry.ticketType?.toLowerCase().includes(searchTerm) ||
        entry.additionalDiscount?.toString().includes(searchTerm)
      );
      console.log('DEBUG: Search filter applied:', {
        searchTerm,
        beforeCount: beforeSearchCount,
        afterCount: filtered.length
      });
    }
    
    console.log('DEBUG: Final filteredEntries result:', {
      finalCount: filtered.length,
      dateFilter,
      search,
      firstEntry: filtered[0] ? {
        id: filtered[0]._id,
        effectiveDate: getEffectiveEntryDate(filtered[0]),
        formattedDate: getFormattedEntryDate(filtered[0])
      } : null
    });
    
    return filtered;
  }, [allEntries, search, dateFilter]);

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
    
    // Apply filters - filteredEntries already includes both date and search filtering
    setEntries(filteredEntries);
  }, [debouncedSearch, search, filteredEntries]);

  // Handle date filter changes
  useEffect(() => {
    setEntries(filteredEntries);
  }, [dateFilter, filteredEntries]);

  // Listen for discount-related events to refresh entries
  useEffect(() => {
    console.log('🔍 AdminEntries: Setting up comprehensive sync event listeners');
    
    const handleDiscountUpdated = (event: any) => {
      console.log('💰 AdminEntries: Discount updated event received, refreshing entries...', event.detail);
      fetchEntries();
    };
    
    const handleAdditionalDiscountUpdated = (event: any) => {
      console.log('🎫 AdminEntries: Additional discount updated event received, refreshing entries...', event.detail);
      fetchEntries();
    };
    
    const handlePaymentCompleted = (event: any) => {
      console.log('💳 AdminEntries: Payment completed event received, refreshing entries...', event.detail);
      fetchEntries();
    };
    
    const handleImmediateSync = (event: any) => {
      console.log('⚡ AdminEntries: Immediate sync event received, refreshing entries...', event.detail);
      fetchEntries();
    };
    
    const handleDiscountsSync = () => {
      console.log('🎟️ AdminEntries: Discounts sync event received, refreshing entries...');
      fetchEntries();
    };
    
    const handleEntryCreated = (event: any) => {
      console.log('📊 AdminEntries: Entry created event received, refreshing entries...', event.detail);
      fetchEntries();
    };
    
    // NEW: Handle date filter refresh events
    const handleDateFilterNeedsRefresh = (event: any) => {
      console.log('AdminEntries: Date filter refresh event received:', event.detail);
      fetchEntries(true); // Force complete refresh to re-apply all filters
    };
    
    // Add window event listeners
    window.addEventListener('discount-updated', handleDiscountUpdated as EventListener);
    window.addEventListener('additional-discount-updated', handleAdditionalDiscountUpdated as EventListener);
    window.addEventListener('payment-completed', handlePaymentCompleted as EventListener);
    window.addEventListener('immediate-sync', handleImmediateSync as EventListener);
    window.addEventListener('discounts-sync', handleDiscountsSync as EventListener);
    window.addEventListener('entry-created', handleEntryCreated as EventListener);
    window.addEventListener('date-filter-needs-refresh', handleDateFilterNeedsRefresh as EventListener);
    
    // Add global sync service listeners
    globalSyncService.addEventListener('discount-updated', handleDiscountUpdated);
    globalSyncService.addEventListener('additional-discount-updated', handleAdditionalDiscountUpdated);
    globalSyncService.addEventListener('payment-completed', handlePaymentCompleted);
    globalSyncService.addEventListener('immediate-sync', handleImmediateSync);
    globalSyncService.addEventListener('discounts-sync', handleDiscountsSync);
    globalSyncService.addEventListener('entry-created', handleEntryCreated);
    globalSyncService.addEventListener('date-filter-needs-refresh', handleDateFilterNeedsRefresh);
    
    return () => {
      console.log('🧹 AdminEntries: Cleaning up comprehensive sync event listeners');
      
      // Remove window event listeners
      window.removeEventListener('discount-updated', handleDiscountUpdated as EventListener);
      window.removeEventListener('additional-discount-updated', handleAdditionalDiscountUpdated as EventListener);
      window.removeEventListener('payment-completed', handlePaymentCompleted as EventListener);
      window.removeEventListener('immediate-sync', handleImmediateSync as EventListener);
      window.removeEventListener('discounts-sync', handleDiscountsSync as EventListener);
      window.removeEventListener('entry-created', handleEntryCreated as EventListener);
      window.removeEventListener('date-filter-needs-refresh', handleDateFilterNeedsRefresh as EventListener);
      
      // Remove global sync service listeners
      globalSyncService.removeEventListener('discount-updated', handleDiscountUpdated);
      globalSyncService.removeEventListener('additional-discount-updated', handleAdditionalDiscountUpdated);
      globalSyncService.removeEventListener('payment-completed', handlePaymentCompleted);
      globalSyncService.removeEventListener('immediate-sync', handleImmediateSync);
      globalSyncService.removeEventListener('discounts-sync', handleDiscountsSync);
      globalSyncService.removeEventListener('entry-created', handleEntryCreated);
      globalSyncService.removeEventListener('date-filter-needs-refresh', handleDateFilterNeedsRefresh);
    };
  }, [fetchEntries]);

  // Delete entry function
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await entriesApi.delete(id);
      setAllEntries(prev => prev.filter(entry => entry._id !== id));
      setEntries(prev => prev.filter(entry => entry._id !== id));
      setTotal(prev => prev - 1);
      
      // Dispatch event for dashboard sync
      window.dispatchEvent(new CustomEvent('entry-deleted', {
        detail: { entryId: id, timestamp: new Date().toISOString() }
      }));
      
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
      
      // Dispatch event for dashboard sync
      window.dispatchEvent(new CustomEvent('entries-changed', {
        detail: { action: 'clear-all', timestamp: new Date().toISOString() }
      }));
      
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
  const handleRefresh = async () => {
    await fetchEntries();
    
    // Dispatch event for dashboard sync
    window.dispatchEvent(new CustomEvent('entries-changed', {
      detail: { action: 'refresh', timestamp: new Date().toISOString() }
    }));
  };

  // Handle new entry navigation
  const handleNewEntry = () => {
    console.log('🎫 Navigating to ticket form...');
    navigate('/ticket');
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
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNewEntry}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition"
              disabled={loading}
            >
              ➕ New Entry
            </motion.button>
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {dateFilter === 'today' ? '📅 Today\'s' : dateFilter === 'yesterday' ? '📅 Yesterday\'s' : '📅 All Time'} Entries
            </h3>
            <div className="text-sm text-gray-600">
              {search && `Searching: "${search}"`}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 lg:grid-cols-7 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{entries.length}</div>
              <div className="text-sm text-gray-600">Filtered</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{allEntries.length}</div>
              <div className="text-sm text-gray-600">Total Entries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {entries.reduce((sum, e) => sum + safeNumber(e.finalAmount), 0)}
              </div>
              <div className="text-sm text-gray-600">Filtered Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {entries.reduce((sum, e) => sum + (e.additionalDiscount || 0) + (e.kidDiscount || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Total Discount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-600">
                {entries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Add. Discount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {entries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">Kid Discount</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {entries.reduce((sum, e) => sum + (e.ticketType === '150' ? safeNumber(e.adults) : safeNumber(e.totalPeople)), 0)}
              </div>
              <div className="text-sm text-gray-600">Total People</div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          {/* Date Filter Tabs */}
          <div className="flex gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => setDateFilter('today')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                dateFilter === 'today'
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              📅 Today
              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                {allEntries.filter(e => isEntryToday(e)).length}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                dateFilter === 'yesterday'
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              📅 Yesterday
              <span className="ml-2 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                {allEntries.filter(e => isEntryYesterday(e)).length}
              </span>
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
                dateFilter === 'all'
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              📅 All Time
              <span className="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                {allEntries.length}
              </span>
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, mobile, ticket type, discount..."
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
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '150px' }}>
                      Upgrades
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
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Discount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200" style={{ width: '80px' }}>
                      Kid Discount
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
                      <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                        {search ? 
                          `No entries found matching "${search}" in ${dateFilter === 'today' ? 'today' : dateFilter === 'yesterday' ? 'yesterday' : 'all time'} entries` :
                          `No entries found for ${dateFilter === 'today' ? 'today' : dateFilter === 'yesterday' ? 'yesterday' : 'all time'}`
                        }
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry, index) => (
                      <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                          <div>
                            <div className="font-medium">
                              {getFormattedEntryDate(entry)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {getFormattedEntryTime(entry)}
                            </div>
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
                            ₹{getTicketLabelSync(entry.ticketType as TicketType)}
                          </div>
                          {entry.upgrades && entry.upgrades.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {entry.upgrades.map((u, i) => (
                                <div key={i} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">
                                  +₹{getTicketLabelSync(u.ticketType as TicketType)} (A:{u.adults} K:{u.kids})
                                </div>
                              ))}
                            </div>
                          )}
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
                        <td className="px-4 py-3 text-sm font-bold text-red-600 text-center border-r border-gray-100">
                          ₹{entry.additionalDiscount ? safeString(entry.additionalDiscount) : '0'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-indigo-600 text-center border-r border-gray-100">
                          ₹{entry.kidDiscount ? safeString(entry.kidDiscount) : '0'}
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
              
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">👤 Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={editing ? editing.name : (viewing?.name || '')}
                        onChange={(e) => editing && setEditing({...editing, name: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                      <input
                        type="text"
                        value={editing ? editing.mobile : (viewing?.mobile || '')}
                        onChange={(e) => editing && setEditing({...editing, mobile: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Ticket Information */}
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">🎫 Ticket Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adults *</label>
                      <input
                        type="number"
                        value={editing ? editing.adults : (viewing?.adults?.toString() || '')}
                        onChange={(e) => {
                      if (editing) {
                        const newAdults = parseInt(e.target.value) || 0;
                        const newTotalPeople = editing.ticketType === '150' 
                          ? newAdults 
                          : newAdults + (editing.kids || 0);
                        setEditing({...editing, adults: newAdults, totalPeople: newTotalPeople});
                      }
                    }}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kids</label>
                      <input
                        type="number"
                        value={editing ? editing.kids : (viewing?.kids?.toString() || '')}
                        onChange={(e) => {
                      if (editing) {
                        const newKids = parseInt(e.target.value) || 0;
                        const newTotalPeople = editing.ticketType === '150' 
                          ? editing.adults || 0
                          : (editing.adults || 0) + newKids;
                        setEditing({...editing, kids: newKids, totalPeople: newTotalPeople});
                      }
                    }}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total People *</label>
                      <input
                        type="number"
                        value={editing ? editing.totalPeople : (viewing?.totalPeople?.toString() || '')}
                        onChange={(e) => editing && setEditing({...editing, totalPeople: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        placeholder="Total number of people"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Type *</label>
                      <select
                        value={editing ? editing.ticketType : (viewing?.ticketType || '150')}
                        onChange={(e) => {
                      if (editing) {
                        const newTicketType = e.target.value as TicketType;
                        const newTotalPeople = newTicketType === '150' 
                          ? (editing.adults || 0)
                          : (editing.adults || 0) + (editing.kids || 0);
                        setEditing({...editing, ticketType: newTicketType, totalPeople: newTotalPeople});
                      }
                    }}
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
                  
                  {/* Upgrades */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">🔄 Upgrades</label>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => {
                            const newUpgrades = [...(editing?.upgrades || [])];
                            newUpgrades.push({
                              ticketType: '300' as TicketType,
                              adults: 0,
                              kids: 0,
                              adultsFastFoodCoupon: '',
                              kidsFastFoodCoupon: '',
                              adultsMainFoodCoupon: '',
                              kidsMainFoodCoupon: ''
                            });
                            setEditing({...editing, upgrades: newUpgrades});
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition"
                        >
                          ➕ Add Upgrade
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {(editing || viewing)?.upgrades?.map((upgrade, index) => (
                        <div key={index} className="space-y-2">
                          <div className="grid grid-cols-4 gap-2 p-3 bg-white rounded border border-gray-200">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Ticket Type</label>
                              <select
                                value={upgrade.ticketType}
                                onChange={(e) => {
                                  if (!editing) return;
                                  const newUpgrades = [...(editing?.upgrades || [])];
                                  newUpgrades[index] = {...upgrade, ticketType: e.target.value as TicketType};
                                  setEditing({...editing, upgrades: newUpgrades});
                                }}
                                disabled={!editing}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              >
                                {TICKET_OPTIONS.map(option => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Adults</label>
                              <input
                                type="number"
                                value={upgrade.adults}
                                onChange={(e) => {
                                  if (!editing) return;
                                  const newUpgrades = [...(editing?.upgrades || [])];
                                  newUpgrades[index] = {...upgrade, adults: parseInt(e.target.value) || 0};
                                  setEditing({...editing, upgrades: newUpgrades});
                                }}
                                disabled={!editing}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Kids</label>
                              <input
                                type="number"
                                value={upgrade.kids}
                                onChange={(e) => {
                                  if (!editing) return;
                                  const newUpgrades = [...(editing?.upgrades || [])];
                                  newUpgrades[index] = {...upgrade, kids: parseInt(e.target.value) || 0};
                                  setEditing({...editing, upgrades: newUpgrades});
                                }}
                                disabled={!editing}
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const newUpgrades = [...(editing?.upgrades || [])];
                                  newUpgrades.splice(index, 1);
                                  setEditing({...editing, upgrades: newUpgrades});
                                }}
                                disabled={!editing}
                                className="w-full px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition"
                              >
                                🗑️ Remove
                              </button>
                            </div>
                          </div>
                          {/* Food coupons for this upgrade */}
                          {(upgrade.ticketType === '450' || upgrade.ticketType === '600') && (
                            <div className="ml-4 p-3 bg-green-50 rounded border border-green-200">
                              <label className="block text-xs font-medium text-gray-700 mb-2">🍔 Food Coupons for Upgrade {index + 1}</label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Adults FF</label>
                                  <input
                                    type="text"
                                    value={upgrade.adultsFastFoodCoupon || ''}
                                    onChange={(e) => {
                                      if (!editing) return;
                                      const newUpgrades = [...(editing?.upgrades || [])];
                                      newUpgrades[index] = {...upgrade, adultsFastFoodCoupon: e.target.value};
                                      setEditing({...editing, upgrades: newUpgrades});
                                    }}
                                    disabled={!editing}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    placeholder="A1-A5"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Kids FF</label>
                                  <input
                                    type="text"
                                    value={upgrade.kidsFastFoodCoupon || ''}
                                    onChange={(e) => {
                                      if (!editing) return;
                                      const newUpgrades = [...(editing?.upgrades || [])];
                                      newUpgrades[index] = {...upgrade, kidsFastFoodCoupon: e.target.value};
                                      setEditing({...editing, upgrades: newUpgrades});
                                    }}
                                    disabled={!editing}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    placeholder="K1-K3"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Adults MF</label>
                                  <input
                                    type="text"
                                    value={upgrade.adultsMainFoodCoupon || ''}
                                    onChange={(e) => {
                                      if (!editing) return;
                                      const newUpgrades = [...(editing?.upgrades || [])];
                                      newUpgrades[index] = {...upgrade, adultsMainFoodCoupon: e.target.value};
                                      setEditing({...editing, upgrades: newUpgrades});
                                    }}
                                    disabled={!editing}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    placeholder="A6-A10"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">Kids MF</label>
                                  <input
                                    type="text"
                                    value={upgrade.kidsMainFoodCoupon || ''}
                                    onChange={(e) => {
                                      if (!editing) return;
                                      const newUpgrades = [...(editing?.upgrades || [])];
                                      newUpgrades[index] = {...upgrade, kidsMainFoodCoupon: e.target.value};
                                      setEditing({...editing, upgrades: newUpgrades});
                                    }}
                                    disabled={!editing}
                                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    placeholder="K4-K6"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )) || (
                        <div className="text-sm text-gray-500 italic p-3 bg-gray-100 rounded">
                          No upgrades added
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Food Coupons */}
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">🍔 Food Coupons</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adults Fast Food Coupon</label>
                      <input
                        type="text"
                        value={editing ? (editing as any).adultsFastFoodCoupon : (viewing as any)?.adultsFastFoodCoupon || ''}
                        onChange={(e) => editing && setEditing({...editing, adultsFastFoodCoupon: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kids Fast Food Coupon</label>
                      <input
                        type="text"
                        value={editing ? (editing as any).kidsFastFoodCoupon : (viewing as any)?.kidsFastFoodCoupon || ''}
                        onChange={(e) => editing && setEditing({...editing, kidsFastFoodCoupon: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adults Main Food Coupon</label>
                      <input
                        type="text"
                        value={editing ? (editing as any).adultsMainFoodCoupon : (viewing as any)?.adultsMainFoodCoupon || ''}
                        onChange={(e) => editing && setEditing({...editing, adultsMainFoodCoupon: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">💰 Payment Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.baseAmount?.toString() : (viewing?.baseAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, baseAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Final Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.finalAmount?.toString() : (viewing?.finalAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, finalAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.cashAmount?.toString() : (viewing?.cashAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, cashAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">UPI Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.upiAmount?.toString() : (viewing?.upiAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, upiAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Advance Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.advanceAmount?.toString() : (viewing?.advanceAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, advanceAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Other Amount</label>
                      <input
                        type="number"
                        value={editing ? editing.otherAmount?.toString() : (viewing?.otherAmount?.toString() || '0')}
                        onChange={(e) => editing && setEditing({...editing, otherAmount: parseInt(e.target.value) || 0})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                  
                  {/* Discount */}
                  <div className="mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Discount</label>
                        <input
                          type="number"
                          value={editing ? editing.additionalDiscount?.toString() : (viewing?.additionalDiscount?.toString() || '0')}
                          onChange={(e) => editing && setEditing({...editing, additionalDiscount: parseInt(e.target.value) || 0})}
                          disabled={!editing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kid Discount</label>
                        <input
                          type="number"
                          value={editing ? editing.kidDiscount?.toString() : (viewing?.kidDiscount?.toString() || '0')}
                          onChange={(e) => editing && setEditing({...editing, kidDiscount: parseInt(e.target.value) || 0})}
                          disabled={!editing}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Information */}
                <div className="bg-purple-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📋 System Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Number</label>
                      <input
                        type="text"
                        value={editing ? (editing as any).receiptNumber : (viewing as any)?.receiptNumber || ''}
                        onChange={(e) => editing && setEditing({...editing, receiptNumber: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Entry Date</label>
                      <input
                        type="datetime-local"
                        value={editing ? formatDateTimeForInput(editing) : formatDateTimeForInput(viewing)}
                        onChange={(e) => {
                          if (editing) {
                            const newDate = e.target.value;
                            console.log('Date changed:', newDate);
                            
                            // CRITICAL FIX: Convert datetime-local string to Date object
                            // datetime-local format: 'YYYY-MM-DDTHH:mm' represents local time
                            const dateObject = new Date(newDate);
                            console.log('CRITICAL DEBUG: Date conversion:', {
                                datetimeLocal: newDate,
                                dateObject: dateObject,
                                isValid: !isNaN(dateObject.getTime()),
                                isoString: dateObject.toISOString(),
                                localString: dateObject.toString(),
                                utcString: dateObject.toUTCString()
                            });
                            
                            // Validate the date before setting
                            if (!isNaN(dateObject.getTime())) {
                                setEditing({...editing, entryDate: dateObject});
                            } else {
                                console.error('Invalid date created from input:', newDate);
                                // Don't update if date is invalid
                            }
                          }
                        }}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Created By</label>
                      <input
                        type="text"
                        value={
                        editing 
                          ? (editing as any).createdBy?.username || ''
                          : (viewing as any)?.createdBy?.username || ''
                      }
                        onChange={(e) => editing && setEditing({...editing, createdBy: {...(editing as any).createdBy, username: e.target.value}})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Filled By</label>
                      <input
                        type="text"
                        value={editing ? editing.filledByFullName : (viewing?.filledByFullName || '')}
                        onChange={(e) => editing && setEditing({...editing, filledByFullName: e.target.value})}
                        disabled={!editing}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="bg-indigo-50 rounded-lg p-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">📝 Notes</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                    <textarea
                      rows={3}
                      value={editing ? (editing as any).notes : (viewing as any)?.notes || ''}
                      onChange={(e) => editing && setEditing({...editing, notes: e.target.value})}
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
                      if (isUpdating) {
                        console.log('Update already in progress, skipping...');
                        return;
                      }
                      
                      try {
                        setIsUpdating(true);
                        console.log('🔧 AdminEntries: Starting entry update with current data:', {
                          id: editing._id,
                          currentEntryDate: editing.entryDate,
                          currentCreatedAt: editing.createdAt,
                          currentAdults: editing.adults,
                          currentKids: editing.kids,
                          currentTotalPeople: editing.totalPeople
                        });
                        
                        // Prevent force resets during manual date updates
                        setPreventForceReset(true, 'Manual date update in progress');
                        
                        const preparedEntry = prepareEntryForAPI(editing);
                        
                        // COMPREHENSIVE DEBUGGING: Track every step
                        console.log('🔍 FRONTEND DEBUG: Entry before preparation:', {
                          id: editing._id,
                          entryDate: editing.entryDate,
                          entryDateType: typeof editing.entryDate,
                          entryDateValid: editing.entryDate instanceof Date
                        });
                        
                        console.log('🔍 FRONTEND DEBUG: Prepared entry for API:', preparedEntry);
                        console.log('🔍 FRONTEND DEBUG: Data being sent to backend:', {
                          id: editing._id,
                          originalEntryDate: editing.entryDate,
                          preparedEntryDate: preparedEntry.entryDate,
                          preparedEntryDateType: typeof preparedEntry.entryDate,
                          allPreparedData: JSON.stringify(preparedEntry, null, 2)
                        });
                        
                        console.log('🚀 FRONTEND DEBUG: Making API call to update entry...');
                        const updateResult = await entriesApi.update(editing._id, preparedEntry);
                        console.log('🔍 FRONTEND DEBUG: API response received:', updateResult);
                        console.log('AdminEntries: Update API result:', updateResult);
                        
                        // Re-enable force resets after update
                        setTimeout(() => {
                          setPreventForceReset(false, 'Manual date update completed');
                          setIsUpdating(false);
                        }, 3000); // Reduced to 3 seconds for better UX
                        
                        // Don't update local state immediately - let the complete refresh handle it
                        // This prevents conflicts between local state and fresh data
                        
                        // SIMPLIFIED FIX: Refresh data and handle filter switching in one go
                        setTimeout(async () => {
                          console.log('DATE UPDATE: Refreshing data after update...');
                          
                          try {
                            // Get fresh data
                            const freshRes = await entriesApi.list({ page: 1, limit: 50000 });
                            const freshEntries = (freshRes.data?.entries as EntryRecord[]) ?? [];
                            
                            // Find the updated entry
                            const updatedEntry = freshEntries.find(e => e._id === editing._id);
                            
                            if (updatedEntry) {
                              console.log('DATE UPDATE: Updated entry found:', {
                                entryId: updatedEntry._id,
                                entryDate: updatedEntry.entryDate,
                                effectiveDate: getEffectiveEntryDate(updatedEntry)
                              });
                              
                              // Determine if filter needs to switch
                              const effectiveDate = getEffectiveEntryDate(updatedEntry);
                              const isToday = dayjs(effectiveDate).isSame(dayjs(), 'day');
                              const isYesterday = dayjs(effectiveDate).isSame(dayjs().subtract(1, 'day'), 'day');
                              
                              // Update master data first
                              setAllEntries(freshEntries);
                              
                              // Switch filter if needed
                              if (isToday && dateFilter !== 'today') {
                                console.log('🔄 Auto-switching to Today filter');
                                setDateFilter('today');
                              } else if (isYesterday && dateFilter !== 'yesterday') {
                                console.log('🔄 Auto-switching to Yesterday filter');
                                setDateFilter('yesterday');
                              } else {
                                console.log('📊 Staying on current filter:', dateFilter);
                                // Trigger filter re-application if staying on same filter
                                setEntries(prev => {
                                  // Re-apply current filter to fresh data
                                  if (dateFilter === 'today') {
                                    return freshEntries.filter(entry => 
                                      dayjs(getEffectiveEntryDate(entry)).isSame(dayjs(), 'day')
                                    );
                                  } else if (dateFilter === 'yesterday') {
                                    return freshEntries.filter(entry => 
                                      dayjs(getEffectiveEntryDate(entry)).isSame(dayjs().subtract(1, 'day'), 'day')
                                    );
                                  }
                                  return freshEntries;
                                });
                              }
                            } else {
                              console.warn('DATE UPDATE: Updated entry not found in fresh data');
                              setAllEntries(freshEntries);
                            }
                          } catch (error) {
                            console.error('DATE UPDATE: Failed to refresh data:', error);
                          }
                        }, 500); // Shorter delay for better UX
                        
                        // Dispatch event for dashboard sync
                        window.dispatchEvent(new CustomEvent('entry-updated', {
                          detail: { 
                            entryId: editing._id, 
                            action: 'update',
                            timestamp: new Date().toISOString()
                          }
                        }));
                        
                        setEditing(null);
                        setToast({ 
                          message: '✅ Entry updated successfully', 
                          id: 'update-success',
                          type: 'success'
                        });
                        setTimeout(() => setToast(null), 3000);
                      } catch (error) {
                        console.error('🚨 Update error:', error);
                        setIsUpdating(false);
                        
                        let errorMessage = '❌ Failed to update entry';
                        
                        if (error.message.includes('Session expired')) {
                          errorMessage = '🔐 Session expired, please login again';
                        } else if (error.message.includes('Network')) {
                          errorMessage = '🌐 Network error, please check your connection';
                        } else if (error.message.includes('Authentication failed')) {
                          errorMessage = '🔒 Authentication error, please try again';
                        } else {
                          errorMessage = `❌ Update failed: ${error.message}`;
                        }
                        
                        setToast({ 
                          message: errorMessage, 
                          id: 'update-error',
                          type: 'error'
                        });
                        setTimeout(() => setToast(null), 5000);
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
