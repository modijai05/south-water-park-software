import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { ticketConfigApi } from '@/lib/ticketApi';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import Receipt from '@/components/Receipt';
import type { TicketConfig } from '@/types';
import { useAuthStore } from '@/store/authStore';

interface Stats {
  todayEntries: number;
  totalEntries: number;
  todayPeople: number;
  totalPeople: number;
  todayAdults: number;
  totalAdults: number;
  todayKids: number;
  totalKids: number;
  // 150 tickets
  today150: number;
  total150: number;
  today150Adults: number;
  total150Adults: number;
  today150Kids: number;
  total150Kids: number;
  // 300 tickets
  today300: number;
  total300: number;
  today300Adults: number;
  total300Adults: number;
  today300Kids: number;
  total300Kids: number;
  // 450 tickets
  today450: number;
  total450: number;
  today450Adults: number;
  total450Adults: number;
  today450Kids: number;
  total450Kids: number;
  // 600 tickets
  today600: number;
  total600: number;
  today600Adults: number;
  total600Adults: number;
  today600Kids: number;
  total600Kids: number;
  // 100 tickets
  today100: number;
  total100: number;
  today100Adults: number;
  total100Adults: number;
  today100Kids: number;
  total100Kids: number;
  // Food coupon statistics for today
  todayAdultsFastFoodCoupons: number;
  todayKidsFastFoodCoupons: number;
  todayAdultsMainFoodCoupons: number;
  todayKidsMainFoodCoupons: number;
  todayTotalFastFoodCoupons: number;
  todayTotalMainFoodCoupons: number;
  todayTotalFoodCoupons: number;
  // Food coupon statistics for all time
  totalAdultsFastFoodCoupons: number;
  totalKidsFastFoodCoupons: number;
  totalAdultsMainFoodCoupons: number;
  totalKidsMainFoodCoupons: number;
  totalFastFoodCoupons: number;
  totalMainFoodCoupons: number;
  totalFoodCoupons: number;
  // Performance metrics
  averageTicketValue: number;
  peakHour: string;
  conversionRate: number;
}

export function Staff() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);
  
  // Receipt generation states
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch ticket configurations
  const fetchTicketConfigs = async () => {
    try {
      console.log('🔄 Staff: Fetching ticket configs...');
      const configs = await ticketConfigApi.getAll();
      console.log('✅ Staff: Fetched ticket configs:', configs);
      setTicketConfigs(configs);
    } catch (error) {
      console.error('❌ Staff: Failed to fetch ticket configs:', error);
    }
  };

  // Get current ticket price from dynamic configs (with day-wise pricing)
  const getCurrentTicketPrice = (ticketType: string): number => {
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config && config.dayWisePricing.length > 0) {
      // Get current day name
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        if (todayPricing.fixedAmount !== undefined) {
          return todayPricing.fixedAmount;
        }
        return Math.round(config.basePrice * todayPricing.priceMultiplier);
      }
    }
    
    if (config) {
      return config.basePrice;
    }
    
    // Fallback to static prices
    const fallbackPrices: { [key: string]: number } = {
      '100': 100, '150': 150, '300': 350, '450': 500, '600': 700
    };
    return fallbackPrices[ticketType] || 0;
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch real stats from API
        const res = await entriesApi.stats();
        setStats(res as unknown as Stats);
        // Also fetch ticket configs
        await fetchTicketConfigs();
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        // Set to zero if API fails
        setStats({
          todayEntries: 0,
          totalEntries: 0,
          todayPeople: 0,
          totalPeople: 0,
          todayAdults: 0,
          totalAdults: 0,
          todayKids: 0,
          totalKids: 0,
          today150: 0,
          total150: 0,
          today150Adults: 0,
          total150Adults: 0,
          today150Kids: 0,
          total150Kids: 0,
          today300: 0,
          total300: 0,
          today300Adults: 0,
          total300Adults: 0,
          today300Kids: 0,
          total300Kids: 0,
          today450: 0,
          total450: 0,
          today450Adults: 0,
          total450Adults: 0,
          today450Kids: 0,
          total450Kids: 0,
          today600: 0,
          total600: 0,
          today600Adults: 0,
          total600Adults: 0,
          today600Kids: 0,
          total600Kids: 0,
          today100: 0,
          total100: 0,
          today100Adults: 0,
          total100Adults: 0,
          today100Kids: 0,
          total100Kids: 0,
          todayAdultsFastFoodCoupons: 0,
          todayKidsFastFoodCoupons: 0,
          todayAdultsMainFoodCoupons: 0,
          todayKidsMainFoodCoupons: 0,
          todayTotalFastFoodCoupons: 0,
          todayTotalMainFoodCoupons: 0,
          todayTotalFoodCoupons: 0,
          totalAdultsFastFoodCoupons: 0,
          totalKidsFastFoodCoupons: 0,
          totalAdultsMainFoodCoupons: 0,
          totalKidsMainFoodCoupons: 0,
          totalFastFoodCoupons: 0,
          totalMainFoodCoupons: 0,
          totalFoodCoupons: 0,
          averageTicketValue: 0,
          peakHour: 'N/A',
          conversionRate: 0,
        } as Stats);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    
    // Refresh stats every 30 seconds for real-time updates
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time sync: Listen for entry updates with enhanced cross-dashboard syncing
  useEffect(() => {
    let syncInterval: number;
    let cancelled = false;
    
    const handleEntryUpdate = () => {
      // Refresh stats when an entry is updated
      const fetchStats = async () => {
        try {
          const res = await entriesApi.stats();
          if (!cancelled) {
            setStats(res as unknown as Stats);
            
            // Trigger global sync events for cross-dashboard communication
            window.dispatchEvent(new CustomEvent('staff-synced', {
              detail: { 
                timestamp: new Date().toISOString(), 
                stats: res,
                source: 'staff-dashboard'
              }
            }));
            
            // Also trigger admin sync event to ensure admin dashboard updates
            window.dispatchEvent(new CustomEvent('dashboard-synced', {
              detail: { 
                timestamp: new Date().toISOString(), 
                stats: res,
                source: 'staff-dashboard-sync'
              }
            }));
          }
        } catch (error) {
          console.error('Failed to refresh staff stats:', error);
        }
      };

      fetchStats();
    };

    // Specific handler for ticket config updates
    const handleTicketConfigUpdate = async () => {
      console.log('🔄 Staff: Ticket config updated, refreshing configs...');
      try {
        const configs = await ticketConfigApi.getAll();
        if (!cancelled) {
          setTicketConfigs(configs);
          console.log('✅ Staff: Ticket configs refreshed successfully');
        }
      } catch (error) {
        console.error('❌ Staff: Failed to refresh ticket configs:', error);
      }
    };

    // Optimized event listeners with throttling
    let lastUpdateTime = 0;
    const throttledHandleEntryUpdate = () => {
      const now = Date.now();
      // Throttle to prevent excessive calls
      if (now - lastUpdateTime < 1000) return;
      lastUpdateTime = now;
      handleEntryUpdate();
    };

    window.addEventListener('entry-updated', throttledHandleEntryUpdate);
    window.addEventListener('entry-created', throttledHandleEntryUpdate);
    window.addEventListener('entry-deleted', throttledHandleEntryUpdate);
    window.addEventListener('dashboard-synced', throttledHandleEntryUpdate);
    window.addEventListener('admin-synced', throttledHandleEntryUpdate);
    window.addEventListener('staff-synced', throttledHandleEntryUpdate);
    window.addEventListener('ticket-config-updated', handleTicketConfigUpdate);
    
    // Reduced sync frequency - refresh every 60 seconds instead of 30
    syncInterval = setInterval(() => {
      if (!cancelled) {
        handleEntryUpdate();
      }
    }, 60000) as unknown as number;
    
    // Cleanup event listeners and intervals on unmount
    return () => {
      cancelled = true;
      window.removeEventListener('entry-updated', throttledHandleEntryUpdate);
      window.removeEventListener('entry-created', throttledHandleEntryUpdate);
      window.removeEventListener('entry-deleted', throttledHandleEntryUpdate);
      window.removeEventListener('dashboard-synced', throttledHandleEntryUpdate);
      window.removeEventListener('admin-synced', throttledHandleEntryUpdate);
      window.removeEventListener('staff-synced', throttledHandleEntryUpdate);
      window.removeEventListener('ticket-config-updated', handleTicketConfigUpdate);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, []);
  
  // Search functionality across all users for receipt generation
  const handleSearch = async (query: string) => {
    console.log('🔍 Staff: Starting cross-user search for:', query);
    console.log('🔍 Staff: Current user:', user?.username, 'Role:', user?.role);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Use searchAll to search across all users and admins
      console.log('🔍 Staff: Calling cross-user search API...');
      const response = await entriesApi.searchAll({ search: query, limit: 10 });
      console.log('🔍 Staff: Cross-user search response:', response);
      console.log('🔍 Staff: Response entries count:', response.entries?.length || 0);
      
      setSearchResults(response.entries || []);
      
      // Log details of found entries
      if (response.entries && response.entries.length > 0) {
        console.log('🔍 Staff: Found entries:');
        response.entries.forEach((entry: any, index: number) => {
          const createdBy = (entry as any).createdBy?.username || (entry as any).createdBy?.fullName || 'Unknown';
          console.log(`  ${index + 1}. ${entry.name} (${entry.mobile}) - Created by: ${createdBy}`);
        });
      } else {
        console.log('🔍 Staff: No entries found for search query:', query);
      }
    } catch (error) {
      console.error('🔍 Staff: Cross-user search failed:', error);
      setSearchResults([]);
      
      // Provide user-friendly error message
      const errorMessage = error.message || 'Unknown error';
      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        alert(`❌ Search endpoint not available.\nPlease restart the server to enable cross-user search.\nError: ${errorMessage}`);
      } else {
        alert(`❌ Search Failed!\nError: ${errorMessage}\nPlease try again or contact support.`);
      }
    } finally {
      setIsSearching(false);
    }
  };
  
  // Generate receipt for existing entry
  const generateReceiptForEntry = async (entry: any) => {
    try {
      // Generate receipt number if it doesn't exist
      let receiptNumber = entry.receiptNumber;
      if (!receiptNumber) {
        try {
          console.log('🔍 Staff: Generating receipt number for existing entry...');
          const receiptRes = await fetch(`/api/entries/${entry.id}/generate-receipt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (receiptRes.ok) {
            const receiptData = await receiptRes.json();
            receiptNumber = receiptData.receiptNumber;
            console.log('🔍 Staff: Receipt number generated:', receiptNumber);
          } else {
            console.error('🔍 Staff: Failed to generate receipt number, response:', receiptRes.status);
            // Generate fallback receipt number locally
            const today = new Date();
            const dateStr = today.getFullYear().toString() +
                            (today.getMonth() + 1).toString().padStart(2, '0') +
                            today.getDate().toString().padStart(2, '0');
            const timestamp = today.getTime().toString().slice(-4);
            receiptNumber = `SWP-${dateStr}-${timestamp}`;
            console.log('🔍 Staff: Using fallback receipt number:', receiptNumber);
          }
        } catch (error) {
          console.error('🔍 Staff: Error generating receipt number:', error);
          // Generate fallback receipt number locally
          const today = new Date();
          const dateStr = today.getFullYear().toString() +
                          (today.getMonth() + 1).toString().padStart(2, '0') +
                          today.getDate().toString().padStart(2, '0');
          const timestamp = today.getTime().toString().slice(-4);
          receiptNumber = `SWP-${dateStr}-${timestamp}`;
          console.log('🔍 Staff: Using fallback receipt number:', receiptNumber);
        }
      }
      
      // Prepare receipt data directly from the existing entry
      const receiptPayload = {
        receiptNumber,
        ...entry,
        // Add staff generation note with timestamp
        notes: `${entry.notes || ''} [Receipt printed by ${user?.username || 'Staff'} on ${new Date().toLocaleString()}]`
      };
      
      setReceiptData(receiptPayload);
      setShowReceipt(true);
      
      console.log('✅ Staff: Receipt generated successfully');
      
    } catch (error) {
      console.error('❌ Staff: Failed to generate receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    }
  };

  return (
    <Layout title="Dashboard">
      {/* Sync Status Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-4 right-4 z-40 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        Live Sync Active
      </motion.div>

      {/* Welcome Message */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="heading-md mb-2">
          Welcome back, staff! Here's your personal performance dashboard.
        </h2>
        <p className="text-secondary text-lg">
          Track your individual visitor statistics and ticket sales in real-time.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
        {/* Today's Entries */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-blue-800">Today's Entries</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </motion.div>
          </div>
          <div className="text-4xl font-black text-blue-900">
            {loading ? (
              <div className="loading-skeleton h-10 w-20"></div>
            ) : (
              <AnimatedCounter value={stats?.todayEntries ?? 0} />
            )}
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Your entries today
          </div>
        </motion.div>

        {/* Today's People */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.2 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-blue-800">Today's People</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: -5 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </motion.div>
          </div>
          <div className="text-4xl font-black text-blue-900">
            {loading ? (
              <div className="loading-skeleton h-10 w-20"></div>
            ) : (
              <AnimatedCounter value={stats?.todayPeople ?? 0} />
            )}
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Your visitors today
          </div>
        </motion.div>

        {/* 150 Tickets Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.3 }}
          className="stat-card bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-cyan-800">₹{getCurrentTicketPrice('150')} Tickets Summary</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-white text-lg font-bold">₹{getCurrentTicketPrice('150')}</span>
            </motion.div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Persons:</span>
              <span className="font-bold text-cyan-900">{stats?.today150Adults ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm text-cyan-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
            </svg>
            Total people in 150 tickets today
          </div>
        </motion.div>

        {/* Adults Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.4 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-blue-800">Adults Today</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </motion.div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹300:</span>
              <span className="font-bold text-blue-900">{stats?.today300Adults ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹500:</span>
              <span className="font-bold text-blue-900">{stats?.today450Adults ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹600:</span>
              <span className="font-bold text-blue-900">{stats?.today600Adults ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹100:</span>
              <span className="font-bold text-blue-900">{stats?.today100Adults ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
            Adults by ticket type
          </div>
        </motion.div>

        {/* Kids Breakdown */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.5 }}
          className="stat-card"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-blue-800">Kids Today</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-blue-300 to-blue-400 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: -5 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </motion.div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹300:</span>
              <span className="font-bold text-blue-900">{stats?.today300Kids ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹500:</span>
              <span className="font-bold text-blue-900">{stats?.today450Kids ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹600:</span>
              <span className="font-bold text-blue-900">{stats?.today600Kids ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">₹100:</span>
              <span className="font-bold text-blue-900">{stats?.today100Kids ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Kids by ticket type
          </div>
        </motion.div>

        {/* Food Coupons Summary */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.7 }}
          className="stat-card bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-orange-800">🍔 Food Coupons Today</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-white text-lg font-bold">🍽️</span>
            </motion.div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Fast Food:</span>
              <span className="font-bold text-orange-900">{stats?.todayTotalFastFoodCoupons ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Main Food:</span>
              <span className="font-bold text-orange-900">{stats?.todayTotalMainFoodCoupons ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm font-bold">
              <span className="text-gray-700">Total Coupons:</span>
              <span className="text-orange-900">{stats?.todayTotalFoodCoupons ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm text-orange-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            Today's food coupons
          </div>
        </motion.div>

        {/* Performance Metrics */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.8 }}
          className="stat-card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-purple-800">📊 Performance</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <span className="text-white text-lg font-bold">📈</span>
            </motion.div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Peak Hour:</span>
              <span className="font-bold text-purple-900">{stats?.peakHour || 'N/A'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Conversion:</span>
              <span className="font-bold text-purple-900">{((stats?.conversionRate || 0) * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="mt-2 flex items-center text-sm text-purple-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Your performance metrics
          </div>
        </motion.div>

        {/* All-Time Entries */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.9 }}
          className="stat-card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-green-800">All-Time Entries</span>
            <motion.div 
              className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.3 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </motion.div>
          </div>
          <div className="text-4xl font-black text-green-900">
            {loading ? (
              <div className="loading-skeleton h-10 w-20"></div>
            ) : (
              <AnimatedCounter value={stats?.totalEntries ?? 0} />
            )}
          </div>
          <div className="mt-2 flex items-center text-sm text-green-600">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Your total entries
          </div>
        </motion.div>
      </div>

      {/* Ticket Generation Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="mt-8"
      >
        <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-blue-900">🧾 Generate Receipt for Existing Entry</h3>
          </div>
          
          {/* Search Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">🔍 Find Existing Customer (Name or Mobile)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  placeholder="Search existing customers..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                🗑️ Clear
              </button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 bg-white border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                {searchResults.map((result, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                    onClick={() => generateReceiptForEntry(result)}
                  >
                    <div className="text-sm font-medium text-gray-900">{result.name}</div>
                    <div className="text-xs text-gray-500">{result.mobile} • {new Date(result.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-blue-600 mt-1">
                      Created by: {(result as any).filledByFullName || (result as any).createdBy?.fullName || (result as any).createdBy?.username || 'Unknown'}
                      {(result as any).createdBy?.username !== user?.username && (result as any).createdBy?.username && (
                        <span className="ml-2 text-orange-600 font-medium">(Other Staff)</span>
                      )}
                    </div>
                    <div className="text-xs text-green-600 mt-1">Click to generate receipt</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-xs text-gray-500">
              💡 Search across all users and admins. Click on any customer to generate their receipt.
            </div>
          </div>
        </div>
      </motion.div>

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt
          data={receiptData}
          onClose={() => {
            setShowReceipt(false);
            setReceiptData(null);
          }}
        />
      )}

      </Layout>
  );
}
