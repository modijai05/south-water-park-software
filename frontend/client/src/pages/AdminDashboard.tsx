import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { computeAmounts, TICKET_OPTIONS, isSunday } from '@/lib/ticketUtils';
import { ticketConfigApi } from '@/lib/ticketApi';
import { entriesApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { invalidateTicketConfigCache } from '@/lib/ticketUtils';
import { useAuthStore } from '@/store/authStore';
import type { TicketConfig } from '@/types';
import { globalSyncService } from '@/services/globalSyncService';

// Helper functions for data transformation
const generateQuarterlyData = (monthlyData: any[]) => {
  // Guard against undefined/null data
  if (!monthlyData || !Array.isArray(monthlyData)) {
    return [];
  }
  
  const quarters = {
    'Q1': { entries: 0, revenue: 0 },
    'Q2': { entries: 0, revenue: 0 },
    'Q3': { entries: 0, revenue: 0 },
    'Q4': { entries: 0, revenue: 0 }
  };

  monthlyData.forEach((item, index) => {
    const quarter = Math.floor(index / 3) + 1;
    const quarterKey = `Q${quarter}` as keyof typeof quarters;
    if (quarters[quarterKey]) {
      quarters[quarterKey].entries += item.count || 0;
      quarters[quarterKey].revenue += item.amount || 0;
    }
  });

  return Object.entries(quarters).map(([quarter, data]) => ({
    quarter,
    entries: data.entries,
    revenue: data.revenue
  }));
};

const generateYearlyData = (monthlyData: any[]) => {
  // Guard against undefined/null data
  if (!monthlyData || !Array.isArray(monthlyData)) {
    return [];
  }
  
  const years: { [key: string]: { entries: number; revenue: number } } = {};

  monthlyData.forEach(item => {
    const year = new Date(item._id).getFullYear().toString();
    if (!years[year]) {
      years[year] = { entries: 0, revenue: 0 };
    }
    years[year].entries += item.count || 0;
    years[year].revenue += item.amount || 0;
  });

  return Object.entries(years).map(([year, data]) => ({
    year,
    entries: data.entries,
    revenue: data.revenue
  }));
};

interface Stats {
  todayEntries: number;
  totalEntries: number;
  todayPeople: number;
  totalPeople: number;
  todayAdults: number;
  totalAdults: number;
  todayKids: number;
  totalKids: number;
  todayCash: number;
  todayUpi: number;
  todayAdvance: number;
  todayAmount: number;
  totalAmount: number;
  totalCash: number;
  totalUpi: number;
  totalAdvance: number;
  // Upgrade statistics
  totalUpgrades: number;
  todayUpgrades: number;
  // Discount statistics
  todayAdditionalDiscount: number;
  todayTotalDiscount: number;
  totalAdditionalDiscount: number;
  totalTotalDiscount: number;
  averageTicketValue: number;
  peakHour: string;
  busiestDay: string;
  uniqueCustomers: number;
  returningCustomers: number;
  conversionRate: number;
  // Ticket type statistics
  today150: number;
  today300: number;
  today450: number;
  today600: number;
  today100: number;
  total150: number;
  total300: number;
  total450: number;
  total600: number;
  total100: number;
  // Per-ticket-type adult and kid counts
  today150Adults: number;
  today150Kids: number;
  today300Adults: number;
  today300Kids: number;
  today450Adults: number;
  today450Kids: number;
  today600Adults: number;
  today600Kids: number;
  today100Adults: number;
  today100Kids: number;
  total150Adults: number;
  total150Kids: number;
  total300Adults: number;
  total300Kids: number;
  total450Adults: number;
  total450Kids: number;
  total600Adults: number;
  total600Kids: number;
  total100Adults: number;
  total100Kids: number;
  // Food coupon statistics
  todayAdultsFastFoodCoupons: number;
  todayKidsFastFoodCoupons: number;
  todayAdultsMainFoodCoupons: number;
  todayKidsMainFoodCoupons: number;
  todayTotalFastFoodCoupons: number;
  todayTotalMainFoodCoupons: number;
  todayTotalFoodCoupons: number;
  totalAdultsFastFoodCoupons: number;
  totalKidsFastFoodCoupons: number;
  totalAdultsMainFoodCoupons: number;
  totalKidsMainFoodCoupons: number;
  totalFastFoodCoupons: number;
  totalMainFoodCoupons: number;
  totalFoodCoupons: number;
  // Performance metrics
  lastUpdated: string;
  dataFreshness: string;
  source: string;
  syncStatus: string;
}

interface Charts {
  last7Days: { _id: string; count: number; amount: number }[];
  ticketDistribution: { _id: string; count: number }[];
  upgradeDistribution: { _id: string; count: number }[];
  comparisonData: { name: string; value: number }[];
  monthly: { _id: string; count: number; amount: number }[];
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);

  // Fetch ticket configurations
  const fetchTicketConfigs = async () => {
    try {
      console.log('Dashboard: Fetching ticket configs...');
      
      // Invalidate cache to ensure fresh data
      invalidateTicketConfigCache();
      
      const configs = await ticketConfigApi.getAll();
      console.log('Dashboard: Fetched ticket configs:', configs);
      setTicketConfigs(configs);
      return configs;
    } catch (error) {
      console.error('❌ Dashboard: Failed to fetch ticket configs:', error);
      return [];
    }
  };

  // Enhanced sync function to force refresh all data
  const forceRefreshAllData = async () => {
    console.log('Admin: Force refreshing all data...');
    try {
      // Invalidate cache first
      invalidateTicketConfigCache();
      
      // Add delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 1000));
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch everything fresh
      const [statsRes, chartsRes, configs] = await Promise.all([
        entriesApi.stats(),
        entriesApi.charts(),
        fetchTicketConfigs()
      ]);
      
      setStats(statsRes as unknown as Stats);
      setCharts(chartsRes as unknown as Charts);
      console.log('Admin: Force refreshed - New prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
      console.log('Admin: Force refreshed - New stats:', statsRes);
      console.log('Admin: Force refreshed - New charts:', chartsRes);
      
      // Trigger global sync event
      window.dispatchEvent(new CustomEvent('admin-synced', {
        detail: {
          action: 'force-refresh',
          timestamp: new Date().toISOString(),
          source: 'admin-dashboard',
          ticketConfigs: configs,
          stats: statsRes,
          charts: chartsRes
        }
      }));
      
    } catch (error) {
      console.error('Admin: Failed to force refresh data:', error);
    }
  };

  // Get current ticket price from dynamic configs (with day-wise pricing) - FIXED
  const getCurrentTicketPrice = (ticketType: string): number => {
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config) {
      // Get current day name
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing?.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        if (todayPricing.fixedAmount !== undefined) {
          return todayPricing.fixedAmount;
        }
        return Math.round(config.basePrice * todayPricing.priceMultiplier);
      }
      // Use base price if no day-wise pricing or not enabled
      return config.basePrice;
    }
    
    // Fallback to static options
    const staticOption = TICKET_OPTIONS.find(t => t.value === ticketType);
    return staticOption?.price || 0;
  };

  // Get current ticket label from dynamic configs
  const getCurrentTicketLabel = (ticketType: string): string => {
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config) {
      return config.label;
    }
    // Fallback to static options
    const staticOption = TICKET_OPTIONS.find(t => t.value === ticketType);
    return staticOption?.label || ticketType;
  };

  useEffect(() => {
    let cancelled = false;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Dashboard: Fetching data...');
        
        // Fetch ticket configs along with other data
        const [s, c] = await Promise.all([
          entriesApi.stats(true), // Force refresh from MongoDB
          entriesApi.charts(),
          fetchTicketConfigs()
        ]);
        
        if (!cancelled) {
          console.log('Dashboard: Raw MongoDB stats data:', s);
          console.log('Dashboard: Charts data:', c);
          
          // Use backend stats directly - backend now handles all calculations correctly
          setStats(s as unknown as Stats);
          setCharts(c as unknown as Charts);
          
          // Fetch recent entries
          try {
            const recentData = await entriesApi.list({ limit: 5, page: 1 });
            const entries = (recentData.data?.entries as any[]) ?? [];
            
            // Sort by createdAt descending (most recent first) and take top 5
            const sortedEntries = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            const finalEntries = sortedEntries.slice(0, 5);
            setRecentEntries(finalEntries);
          } catch (recentError) {
            console.error('❌ Dashboard: Failed to fetch recent entries:', recentError);
            setRecentEntries([]);
          }
          
          setLoading(false);
          console.log('Dashboard: Data fetched and corrected successfully');
        }
      } catch (error) {
        console.error('❌ Dashboard: Failed to fetch data:', error);
        if (!cancelled) {
          setError('Failed to load dashboard data');
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Enhanced real-time sync with comprehensive sync service integration
  useEffect(() => {
    let cancelled = false;
    
    // Enhanced comprehensive sync handler
    const handleComprehensiveSync = (event: any) => {
      if (!cancelled) {
        console.log('🔄 Dashboard: Comprehensive sync triggered:', event.detail);
        const fetchData = async () => {
          try {
            console.log('🔄 Dashboard: Fetching comprehensive sync data...');
            
            // Use comprehensive sync for better data integrity
            const syncData = await entriesApi.syncAll();
            
            if (!cancelled && syncData && syncData.stats) {
              console.log('📊 Dashboard: Comprehensive sync stats received:', syncData.stats);
              console.log('📈 Dashboard: Sync metadata:', syncData.metadata);
              
              // Update stats from comprehensive sync
              setStats(syncData.stats as unknown as Stats);
              
              // Update recent entries from sync data
              if (syncData.recentEntries && Array.isArray(syncData.recentEntries)) {
                const finalEntries = syncData.recentEntries.slice(0, 5);
                setRecentEntries(finalEntries);
              }
              
              // Fetch charts separately
              const chartsData = await entriesApi.charts();
              if (chartsData) {
                setCharts(chartsData as unknown as Charts);
              }
              
              // Log sync integrity
              console.log('✅ Dashboard: Comprehensive sync completed successfully');
              console.log('🔍 Dashboard: Data integrity:', (syncData.metadata as any)?.dataIntegrity || 'unknown');
              console.log('📊 Dashboard: Sync status:', syncData.metadata?.syncStatus);
              
              // Dispatch comprehensive sync event for other components
              window.dispatchEvent(new CustomEvent('dashboard-comprehensive-synced', {
                detail: { 
                  timestamp: new Date().toISOString(), 
                  syncData: syncData,
                  source: 'admin-dashboard',
                  integrity: (syncData.metadata as any)?.dataIntegrity || 'unknown'
                }
              }));
            }
          } catch (error) {
            console.error('❌ Dashboard: Comprehensive sync failed:', error);
            // Fallback to regular sync
            handleEntryUpdate();
          }
        };

        fetchData();
      }
    };
    
    const handleEntryUpdate = () => {
      if (!cancelled) {
        console.log('🔄 Dashboard: Entry update sync triggered...');
        const fetchData = async () => {
          try {
            console.log('🔄 Dashboard: Fetching updated data...');
            const [s, c] = await Promise.all([
              entriesApi.stats(), 
              entriesApi.charts(),
              fetchTicketConfigs() // Also refresh ticket configs to ensure pricing sync
            ]);
            if (!cancelled) {
              console.log('📊 Dashboard: Updated stats received:', s);
              console.log('📈 Dashboard: Updated charts received:', c);
              
              // Log specific discount data for debugging
              console.log('💰 Dashboard: Additional Discount Data - Today:', (s as any)?.todayAdditionalDiscount, 'Total:', (s as any)?.totalAdditionalDiscount);
              console.log('💰 Dashboard: Total Discount Data - Today:', (s as any)?.todayTotalDiscount, 'All-Time:', (s as any)?.totalTotalDiscount);
              
              setStats(s as unknown as Stats);
              setCharts(c as unknown as Charts);
              
              // Refresh recent entries
              try {
                const recentData = await entriesApi.list({ limit: 5, page: 1 });
                const entries = (recentData.data?.entries as any[]) ?? [];
                const sortedEntries = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                const finalEntries = sortedEntries.slice(0, 5);
                setRecentEntries(finalEntries);
              } catch (recentError) {
                console.error('❌ Dashboard: Failed to refresh recent entries:', recentError);
              }
              
              console.log('✅ Dashboard: Data updated successfully');
              console.log('🍔 Dashboard: Food coupons data - todayTotal:', (s as any)?.todayTotalFoodCoupons, 'totalFoodCoupons:', (s as any)?.totalFoodCoupons);
              console.log('💰 Dashboard: Additional discount data - todayAdditionalDiscount:', (s as any)?.todayAdditionalDiscount, 'totalAdditionalDiscount:', (s as any)?.totalAdditionalDiscount);
              
              // Dispatch sync event for other components
              window.dispatchEvent(new CustomEvent('dashboard-synced', {
                detail: { 
                  timestamp: new Date().toISOString(), 
                  stats: s, 
                  charts: c,
                  discounts: {
                    todayAdditionalDiscount: (s as any)?.todayAdditionalDiscount,
                    totalAdditionalDiscount: (s as any)?.totalAdditionalDiscount,
                    todayTotalDiscount: (s as any)?.todayTotalDiscount,
                    totalTotalDiscount: (s as any)?.totalTotalDiscount
                  }
                }
              }));
            }
          } catch (error) {
            console.error('❌ Dashboard: Failed to refresh data:', error);
          }
        };

        fetchData();
      }
    };

    // Optimized event listeners with comprehensive sync support
    let lastUpdateTime = 0;
    const throttledHandleEntryUpdate = () => {
      const now = Date.now();
      // Reduced throttle to 100ms for more responsive updates
      if (now - lastUpdateTime < 100) return;
      lastUpdateTime = now;
      handleEntryUpdate();
    };

    // Immediate handler for critical events (no throttling)
    const immediateHandleEntryUpdate = () => {
      console.log('🚀 Admin: Immediate sync triggered for entry change');
      handleEntryUpdate();
    };

    // Listen for comprehensive sync events
    window.addEventListener('comprehensive-sync-complete', handleComprehensiveSync);
    window.addEventListener('dashboard-refresh-required', handleComprehensiveSync);

    // Listen for all update events including staff dashboard events
    window.addEventListener('entry-updated', throttledHandleEntryUpdate);
    window.addEventListener('entry-created', immediateHandleEntryUpdate); // Immediate sync for new entries
    window.addEventListener('entry-deleted', immediateHandleEntryUpdate); // Immediate sync for deletions
    window.addEventListener('user-updated', throttledHandleEntryUpdate);
    window.addEventListener('payment-completed', throttledHandleEntryUpdate);
    window.addEventListener('staff-synced', throttledHandleEntryUpdate); // Listen to staff dashboard events
    window.addEventListener('ticket-config-updated', throttledHandleEntryUpdate); // Listen to ticket config updates
    
    // Listen for receipt events from staff dashboard
    const handleReceiptEvent = (event: any) => {
      console.log('🧾 AdminDashboard: Receipt event received:', event.detail);
      handleEntryUpdate();
    };
    
    window.addEventListener('receipt-generated', handleReceiptEvent);
    window.addEventListener('receipt-printed', handleReceiptEvent);
    
    // Add specific discount update listener
    const handleDiscountUpdate = (event: any) => {
      console.log('💰 AdminDashboard: Discount update event received:', event.detail);
      handleEntryUpdate();
    };
    
    window.addEventListener('discount-updated', handleDiscountUpdate);
    window.addEventListener('additional-discount-updated', handleDiscountUpdate);
    
    // Add specific ticket config refresh listener
    const handleTicketConfigRefresh = async () => {
      console.log('🔄 AdminDashboard: Refreshing ticket configs after update');
      try {
        // Invalidate shared cache first to ensure fresh data
        invalidateTicketConfigCache();
        
        // Add small delay to ensure cache is cleared
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const configs = await ticketConfigApi.getAll();
        setTicketConfigs(configs || []);
        console.log('🎫 AdminDashboard: Ticket configs refreshed, new prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
      } catch (error) {
        console.error('Failed to refresh ticket configs:', error);
      }
    };
    
    window.addEventListener('ticket-config-updated', handleTicketConfigRefresh);
    
    return () => {
      cancelled = true;
      window.removeEventListener('comprehensive-sync-complete', handleComprehensiveSync);
      window.removeEventListener('dashboard-refresh-required', handleComprehensiveSync);
      window.removeEventListener('entry-updated', throttledHandleEntryUpdate);
      window.removeEventListener('entry-created', immediateHandleEntryUpdate);
      window.removeEventListener('entry-deleted', immediateHandleEntryUpdate);
      window.removeEventListener('user-updated', throttledHandleEntryUpdate);
      window.removeEventListener('payment-completed', throttledHandleEntryUpdate);
      window.removeEventListener('staff-synced', throttledHandleEntryUpdate); // Remove staff event listener
      window.removeEventListener('ticket-config-updated', throttledHandleEntryUpdate); // Remove ticket config listener
      window.removeEventListener('ticket-config-updated', handleTicketConfigRefresh); // Remove refresh listener
      window.removeEventListener('receipt-generated', handleReceiptEvent);
      window.removeEventListener('receipt-printed', handleReceiptEvent);
      window.removeEventListener('discount-updated', handleDiscountUpdate);
      window.removeEventListener('additional-discount-updated', handleDiscountUpdate);
    };
  }, []);

  // Listen for global sync events
  useEffect(() => {
    let cancelled = false;
    
    const handleGlobalSync = async (event: Event) => {
      if (cancelled) return;
      
      console.log('🌐 Dashboard: Received global sync event:', event.type);
      const fetchData = async () => {
        try {
          console.log('🔄 Dashboard: Fetching updated data...');
          const [s, c] = await Promise.all([
            entriesApi.stats(), 
            entriesApi.charts(),
            fetchTicketConfigs() // Ensure ticket configs are also refreshed
          ]);
          if (!cancelled) {
            console.log('📊 Dashboard: New stats - todayAdvance:', (s as any)?.todayAdvance, 'totalAdvance:', (s as any)?.totalAdvance);
            console.log('🍔 Dashboard: Food coupons - todayTotal:', (s as any)?.todayTotalFoodCoupons, 'totalFoodCoupons:', (s as any)?.totalFoodCoupons);
            setStats(s as unknown as Stats);
            setCharts(c as unknown as Charts);
            console.log('✅ Dashboard: Data updated via global sync');
          }
        } catch (error) {
          console.error('❌ Dashboard: Global sync failed:', error);
        }
      };

      fetchData();
    };

    window.addEventListener('global-sync', handleGlobalSync);
    window.addEventListener('dashboard-sync-required', handleGlobalSync);
    window.addEventListener('staff-synced', handleGlobalSync); // Listen to staff sync events
    window.addEventListener('dashboard-refresh', handleGlobalSync); // Listen for admin sync coordinator

    return () => {
      window.removeEventListener('global-sync', handleGlobalSync);
      window.removeEventListener('dashboard-sync-required', handleGlobalSync);
      window.removeEventListener('staff-synced', handleGlobalSync); // Remove staff event listener
      window.removeEventListener('dashboard-refresh', handleGlobalSync); // Remove admin sync coordinator event
    };
  }, []);

  // Global Sync Service Integration
  useEffect(() => {
    let cancelled = false;

    // Handle global sync events from the sync service
    const handleGlobalSyncTriggered = (data: any) => {
      if (!cancelled) {
        console.log('🌐 AdminDashboard: Global sync triggered:', data);
        const fetchData = async () => {
          try {
            const [s, c] = await Promise.all([
              entriesApi.stats(), 
              entriesApi.charts(),
              fetchTicketConfigs()
            ]);
            if (!cancelled) {
              setStats(s as unknown as Stats);
              setCharts(c as unknown as Charts);
              console.log('✅ AdminDashboard: Data updated via global sync');
            }
          } catch (error) {
            console.error('❌ AdminDashboard: Global sync failed:', error);
          }
        };
        fetchData();
      }
    };

    // Handle immediate sync requirements
    const handleImmediateSyncRequired = (data: any) => {
      if (!cancelled) {
        console.log('🚀 AdminDashboard: Immediate sync required:', data);
        handleGlobalSyncTriggered(data);
      }
    };

    // Handle daily reset events
    const handleDailyReset = (data: any) => {
      if (!cancelled) {
        console.log('🌅 AdminDashboard: Daily reset triggered, forcing complete data refresh');
        
        // Clear all localStorage cache
        localStorage.clear();
        
        // Force refresh by adding force=true parameter
        const fetchData = async () => {
          try {
            console.log('🔄 Dashboard: Fetching updated data with complete cache clear and force reset...');
            const [s, c] = await Promise.all([
              entriesApi.stats(true), // Force refresh
              ticketConfigApi.getAll()
            ]);
            
            if (!cancelled) {
              setStats(s as unknown as Stats); // Proper casting for Stats interface
              setTicketConfigs(c); // c is TicketConfig[]
              setError(null);
              console.log('📊 Dashboard: Raw stats data after complete cache clear:', s);
              console.log('✅ Dashboard: Complete cache clear successful - today should be 0');
              
              // PROFESSIONAL FIX: Force reset API call if today stats not reset
              if (s.todayEntries === 0 && (s.today150 > 0 || s.today300 > 0 || s.today450 > 0 || s.today600 > 0 || s.today100 > 0)) {
                console.log('🚨 PROFESSIONAL FIX: Today entries = 0 but ticket types > 0, forcing reset...');
                try {
                  const resetStats = await entriesApi.stats(true);
                  if (resetStats) {
                    console.log('✅ PROFESSIONAL FIX: Force reset successful, updating stats...');
                    setStats(resetStats as unknown as Stats);
                  }
                } catch (resetError) {
                  console.error('❌ PROFESSIONAL FIX: Force reset failed:', resetError);
                }
              }
            }
          } catch (error) {
            if (!cancelled) {
              console.error('❌ Dashboard: Failed to refresh data after cache clear:', error);
              setError(error instanceof Error ? error.message : 'Failed to refresh data');
            }
          }
        };

        fetchData();
      }
    };

    // Register listeners with global sync service
    globalSyncService.addEventListener('global-sync-triggered', handleGlobalSyncTriggered);
    globalSyncService.addEventListener('immediate-sync-required', handleImmediateSyncRequired);
    globalSyncService.addEventListener('daily-reset-complete', handleDailyReset);

    // Also listen for DOM events for compatibility
    window.addEventListener('daily-reset', handleDailyReset);

    return () => {
      globalSyncService.removeEventListener('global-sync-triggered', handleGlobalSyncTriggered);
      globalSyncService.removeEventListener('immediate-sync-required', handleImmediateSyncRequired);
      globalSyncService.removeEventListener('daily-reset-complete', handleDailyReset);
      window.removeEventListener('daily-reset', handleDailyReset);
    };
  }, []);

  const safeCharts = charts || { last7Days: [], ticketDistribution: [], upgradeDistribution: [], comparisonData: [], monthly: [] };

  // Loading guard
  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </Layout>
    );
  }

  // Data validation guard
  if (!stats) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-600">No data available. Please refresh.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Dashboard">
      {/* Admin Refresh Button */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          Admin Live Sync
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={forceRefreshAllData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2 transition-colors"
          title="Refresh all admin data and pricing"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh All
        </motion.button>
      </div>

      <div className="space-y-8">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-red-600 font-medium">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {!loading && !error && stats ? (
          <>
          <div className="space-y-8">
            {/* Sunday Pricing Banner */}
            {isSunday() && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-orange-400 to-red-500 text-white p-4 rounded-xl border-2 border-orange-600 shadow-lg"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-lg">🎉 Sunday Special! ₹50 Extra on All Tickets (Except ₹150 & ₹100)</span>
                  <svg className="w-6 h-6 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </motion.div>
            )}

            {/* Welcome Message */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h2 className="heading-md text-blue-900">
                Welcome back, {user?.fullName || user?.username || 'Admin'}! Here's your complete management overview.
              </h2>
            </motion.div>

            {/* Today's Statistics */}
            <div className="relative mb-12">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 rounded-3xl"></div>

              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="text-center mb-12"
                >
                  <div className="inline-flex items-center justify-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 19h.01" />
                      </svg>
                    </div>
                    <h3 className="text-5xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Today's Performance
                    </h3>
                    <div className="w-32 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mx-auto rounded-full"></div>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Real-time overview of today's business metrics and financial performance</p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                  {/* Today's Entries */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(59, 130, 246, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-blue-100 hover:border-blue-200 transition-all duration-300"
                  >
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Entries</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.todayEntries ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-blue-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Live tracking</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's People */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(16, 185, 129, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-emerald-100 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total People</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats || stats.todayEntries === 0 ? (
                              <span className="text-gray-400">No entries</span>
                            ) : (
                              <AnimatedCounter value={stats?.todayPeople ?? 0} />
                            )}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v2m0 0v2m0-2h-2m-5.356 1.857a3 3 0 00-5.356 1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v2m0 0h3m3 0h3" />
                        </svg>
                        <span className="font-medium">Visitors</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's Adults */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:border-purple-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Adults</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.todayAdults ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7 7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-purple-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7 7z" />
                        </svg>
                        <span className="font-medium">Adult guests</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's Kids */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(251, 146, 60, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-orange-100 hover:border-orange-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Kids</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.todayKids ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-orange-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <span className="font-medium">Child guests</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Ticket Types Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 mt-6 sm:mt-8">
                  {/* Today's 150 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.5, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(6, 182, 212, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-cyan-100 hover:border-cyan-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('150')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.today150 ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('150')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">People:</span>
                          <span className="font-semibold text-cyan-700"><AnimatedCounter value={stats?.today150Adults ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-cyan-700"><AnimatedCounter value={stats?.today150Kids ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold text-cyan-700"><AnimatedCounter value={stats?.today150 ?? 0} /></span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-cyan-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                        </svg>
                        <span className="font-medium">Special tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's 300 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.55, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:border-purple-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('300')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.today300 ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('300')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-purple-700"><AnimatedCounter value={stats?.today300Adults ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-purple-700"><AnimatedCounter value={stats?.today300Kids ?? 0} /></span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-purple-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">3-4hr tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's 450 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(251, 146, 60, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-orange-100 hover:border-orange-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('450')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.today450 ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('450')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-orange-700"><AnimatedCounter value={stats?.today450Adults ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-orange-700"><AnimatedCounter value={stats?.today450Kids ?? 0} /></span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-orange-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-medium">Fast food tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's 600 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.65, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(34, 197, 94, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-emerald-100 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('600')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.today600 ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('600')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-emerald-700"><AnimatedCounter value={stats?.today600Adults ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-emerald-700"><AnimatedCounter value={stats?.today600Kids ?? 0} /></span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-medium">Main food tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's 100 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(99, 102, 241, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 hover:border-indigo-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('100')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            <AnimatedCounter value={stats?.today100 ?? 0} />
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('100')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-indigo-700"><AnimatedCounter value={stats?.today100Adults ?? 0} /></span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-indigo-700"><AnimatedCounter value={stats?.today100Kids ?? 0} /></span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-indigo-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v2m0-2v2m0-2h-2m-5.356 1.857a3 3 0 00-5.356 1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v2m0-2h3m3 0h3" />
                        </svg>
                        <span className="font-medium">Sitting only</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* Revenue and Payment Row */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-8">
                  {/* Today's Total Amount */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.6, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(34, 197, 94, 0.15)"
                    }}
                    className="group relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-emerald-100 mb-1">Total Revenue</p>
                          <p className="text-4xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.todayAmount ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Today's earnings</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's Cash */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(59, 130, 246, 0.15)"
                    }}
                    className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-lg font-bold text-blue-100 mb-1">💵 Today's Cash</p>
                          <p className="text-4xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.todayCash ?? 0} />}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-blue-100 mt-3">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Cash payments received today</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's UPI */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)"
                    }}
                    className="group relative bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-lg font-bold text-purple-100 mb-1">📱 Today's UPI</p>
                          <p className="text-4xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.todayUpi ?? 0} />}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-purple-100 mt-3">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">UPI payments received today</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's Advance Money */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.85, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(16, 185, 129, 0.15)"
                    }}
                    className="group relative bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-lg font-bold text-emerald-100 mb-1">🤝 Today's Advance</p>
                          <p className="text-4xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.todayAdvance ?? 0} />}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-emerald-100 mt-3">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Advance payments received today</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Today's Additional Discount Statistics */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(251, 146, 60, 0.15)"
                    }}
                    className="group relative bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-base font-bold text-amber-100 mb-1">💰 Today's Additional Discounts</p>
                          <p className="text-3xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.todayAdditionalDiscount ?? 0} />}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-amber-100 mt-3">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Additional discounts given today</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            {/* All-Time Statistics */}
            <div className="relative mb-12">
              {/* Background decoration */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 via-transparent to-blue-50/50 rounded-3xl"></div>

              <div className="relative">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                  className="text-center mb-12"
                >
                  <div className="inline-flex items-center justify-center mb-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 19h.01" />
                      </svg>
                    </div>
                    <h3 className="text-5xl font-black bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
                      All-Time Performance
                    </h3>
                    <div className="w-32 h-1 bg-gradient-to-r from-emerald-400 to-blue-400 mx-auto rounded-full"></div>
                  </div>
                  <p className="text-gray-600 text-sm font-medium">Comprehensive overview of all-time business metrics and financial performance</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* All Time Entries */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(16, 185, 129, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-emerald-100 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Entries</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.totalEntries ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">All records</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time People */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.9, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(20, 184, 166, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-teal-100 hover:border-teal-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total People</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats || stats.totalEntries === 0 ? (
                              <span className="text-gray-400">No entries</span>
                            ) : (
                              <AnimatedCounter value={stats.totalPeople ?? 0} />
                            )}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-teal-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v2m0 0v2m0-2h-2m-5.356 1.857a3 3 0 00-5.356 1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v2m0 0h3m3 0h3" />
                        </svg>
                        <span className="font-medium">Total visitors</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time Adults */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.0, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:border-purple-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Adults</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.totalAdults ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7 7z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-purple-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7 7z" />
                        </svg>
                        <span className="font-medium">Adult guests</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time Kids */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.1, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(251, 146, 60, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-orange-100 hover:border-orange-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Total Kids</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.totalKids ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-orange-600">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        <span className="font-medium">Child guests</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* All-Time Ticket Types Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5 gap-4 sm:gap-6 lg:gap-8 mt-6 sm:mt-8">
                  {/* All Time 150 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.2, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(244, 63, 94, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-rose-100 hover:border-rose-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('150')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.total150 ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('150')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">People:</span>
                          <span className="font-semibold text-rose-700">{!stats ? '0' : <AnimatedCounter value={stats.total150Adults ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-rose-700">{!stats ? '0' : <AnimatedCounter value={stats.total150Kids ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Total:</span>
                          <span className="font-semibold text-rose-700">{!stats ? '0' : <AnimatedCounter value={stats.total150 ?? 0} />}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-rose-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                        </svg>
                        <span className="font-medium">All special tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time 300 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.25, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-purple-100 hover:border-purple-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('300')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.total300 ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('300')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-purple-700">{!stats ? '0' : <AnimatedCounter value={stats.total300Adults ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-purple-700">{!stats ? '0' : <AnimatedCounter value={stats.total300Kids ?? 0} />}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-purple-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">All 3-4hr tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time 450 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.3, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(251, 146, 60, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-orange-100 hover:border-orange-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('450')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.total450 ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('450')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-orange-700">{!stats ? '0' : <AnimatedCounter value={stats.total450Adults ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-orange-700">{!stats ? '0' : <AnimatedCounter value={stats.total450Kids ?? 0} />}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-orange-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-medium">All fast food tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time 600 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.35, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(34, 197, 94, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-emerald-100 hover:border-emerald-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('600')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.total600 ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('600')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-emerald-700">{!stats ? '0' : <AnimatedCounter value={stats.total600Adults ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-emerald-700">{!stats ? '0' : <AnimatedCounter value={stats.total600Kids ?? 0} />}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="font-medium">All main food tickets</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All Time 100 Tickets */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.4, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(99, 102, 241, 0.15)"
                    }}
                    className="group relative bg-white rounded-2xl p-6 shadow-lg border border-indigo-100 hover:border-indigo-200 transition-all duration-300"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">₹{getCurrentTicketPrice('100')} Tickets</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {!stats ? '0' : <AnimatedCounter value={stats.total100 ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <span className="text-white text-xl font-bold">₹{getCurrentTicketPrice('100')}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Adults:</span>
                          <span className="font-semibold text-indigo-700">{!stats ? '0' : <AnimatedCounter value={stats.total100Adults ?? 0} />}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Kids:</span>
                          <span className="font-semibold text-indigo-700">{!stats ? '0' : <AnimatedCounter value={stats.total100Kids ?? 0} />}</span>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-indigo-600 mt-3">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v2m0-2v2m0-2h-2m-5.356 1.857a3 3 0 00-5.356 1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v2m0-2h3m3 0h3" />
                        </svg>
                        <span className="font-medium">All sitting only</span>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* All-Time Revenue and Payment Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-8">
                  {/* All Time Total Amount */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.3, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 25px 50px rgba(16, 185, 129, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl p-8 shadow-2xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-emerald-100 mb-1">Total Revenue</p>
                          <p className="text-5xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.totalAmount ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">All-time earnings</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All-Time Cash */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.4, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 25px 50px rgba(14, 165, 233, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-sky-500 to-blue-600 rounded-3xl p-8 shadow-2xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-sky-100 mb-1">All-Time Cash</p>
                          <p className="text-5xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.totalCash ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-sky-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Physical transactions</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All-Time UPI */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.5, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 25px 50px rgba(139, 92, 246, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl p-8 shadow-2xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-violet-100 mb-1">All-Time UPI</p>
                          <p className="text-5xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.totalUpi ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-violet-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Digital transactions</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All-Time Advance Money */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.45, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(16, 185, 129, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-sm font-medium text-emerald-100 mb-1">All-Time Advance</p>
                          <p className="text-5xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.totalAdvance ?? 0} />}
                          </p>
                        </div>
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 16h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-emerald-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Total advance payments</span>
                      </div>
                    </div>
                  </motion.div>

                  {/* All-Time Additional Discount Statistics */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.5, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 20px 40px rgba(139, 92, 246, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl p-6 shadow-xl text-white"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-base font-bold text-purple-100 mb-1">🏆 All-Time Additional Discounts</p>
                          <p className="text-3xl font-extrabold text-white">
                            ₹{!stats ? '0' : <AnimatedCounter value={stats.totalAdditionalDiscount ?? 0} />}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08.402-2.599 1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-xs text-purple-100 mt-3">
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="font-medium">Additional discounts all time</span>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>

            <div className="h-12"></div>

            {/* Comprehensive Analytics Dashboard */}
            <div className="modern-card mb-8">
              <h3 className="heading-lg text-purple-700 mb-6">📊 Complete Analytics Overview</h3>
              
              {/* Payment Analytics Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Today's Payment Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200"
                >
                  <h4 className="text-lg font-bold text-blue-900 mb-4">💳 Today's Payment Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-700">Cash Payments:</span>
                      <span className="font-bold text-blue-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayCash || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-700">UPI Payments:</span>
                      <span className="font-bold text-blue-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayUpi || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-700">Advance Payments:</span>
                      <span className="font-bold text-blue-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayAdvance || 0} />}</span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-blue-900">Total Revenue:</span>
                        <span className="font-bold text-xl text-blue-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayAmount || 0} />}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* All-Time Payment Breakdown */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200"
                >
                  <h4 className="text-lg font-bold text-purple-900 mb-4">🏆 All-Time Payment Breakdown</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-purple-700">Cash Collections:</span>
                      <span className="font-bold text-purple-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalCash || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-purple-700">UPI Collections:</span>
                      <span className="font-bold text-purple-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalUpi || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-purple-700">Advance Collections:</span>
                      <span className="font-bold text-purple-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalAdvance || 0} />}</span>
                    </div>
                    <div className="border-t border-purple-200 pt-2 mt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-purple-900">Total Revenue:</span>
                        <span className="font-bold text-xl text-purple-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalAmount || 0} />}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Discount Analytics */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200"
                >
                  <h4 className="text-lg font-bold text-amber-900 mb-4">💰 Discount Analytics</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-amber-700">Today's Discounts:</span>
                      <span className="font-bold text-amber-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayTotalDiscount || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-amber-700">Additional Today:</span>
                      <span className="font-bold text-amber-900">₹{!stats ? '0' : <AnimatedCounter value={stats.todayAdditionalDiscount || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-amber-700">All-Time Discounts:</span>
                      <span className="font-bold text-amber-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalTotalDiscount || 0} />}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-amber-700">Additional All-Time:</span>
                      <span className="font-bold text-amber-900">₹{!stats ? '0' : <AnimatedCounter value={stats.totalAdditionalDiscount || 0} />}</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Average Ticket Value */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border-2 border-emerald-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-emerald-900">📈 Average Ticket Value</span>
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">
                    ₹{!stats ? '0' : <AnimatedCounter value={Math.round(stats.averageTicketValue || 0)} />}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">Per customer average</p>
                </motion.div>

                {/* Peak Hour */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 border-2 border-rose-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-rose-900">⏰ Peak Hour</span>
                    <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-rose-900">
                    {!stats ? '--:--' : stats.peakHour || '12:00'}
                  </p>
                  <p className="text-xs text-rose-600 mt-1">Busiest time today</p>
                </motion.div>

                {/* Conversion Rate */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border-2 border-indigo-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-indigo-900">🎯 Conversion Rate</span>
                    <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">
                    {!stats ? '0%' : <AnimatedCounter value={Math.round((stats.conversionRate || 0) * 100)} />}%</p>
                  <p className="text-xs text-indigo-600 mt-1">Visitor conversion</p>
                </motion.div>

                {/* Upgrade Rate */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-4 border-2 border-cyan-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-cyan-900">⬆️ Upgrade Rate</span>
                    <div className="w-8 h-8 bg-cyan-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-cyan-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.todayUpgrades || 0} />}
                  </p>
                  <p className="text-xs text-cyan-600 mt-1">Today's upgrades</p>
                </motion.div>
              </div>
            </div>

            <div className="h-12"></div>

            {/* Today's Food Coupon Stats */}
            <div className="modern-card mb-8">
              <h3 className="heading-lg text-blue-700 mb-6">🎯 Today's Food Coupons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Fast Food Coupons Today */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border-2 border-orange-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-orange-900">🍟 Fast Food Coupons</span>
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.todayTotalFastFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">Total fast food coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Adults: {!stats ? '0' : <AnimatedCounter value={stats.todayAdultsFastFoodCoupons || 0} />}</div>
                    <div>Kids: {!stats ? '0' : <AnimatedCounter value={stats.todayKidsFastFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* Main Food Coupons Today */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-900">🍽️ Main Food Coupons</span>
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.todayTotalMainFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Total main food coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Adults: {!stats ? '0' : <AnimatedCounter value={stats.todayAdultsMainFoodCoupons || 0} />}</div>
                    <div>Kids: {!stats ? '0' : <AnimatedCounter value={stats.todayKidsMainFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* Total Food Coupons Today */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-900">🎫 Total Food Coupons</span>
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.todayTotalFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">All food coupons today</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Fast Food: {!stats ? '0' : <AnimatedCounter value={stats.todayTotalFastFoodCoupons || 0} />}</div>
                    <div>Main Food: {!stats ? '0' : <AnimatedCounter value={stats.todayTotalMainFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* Coupon Usage Rate */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-900">📊 Coupon Usage Rate</span>
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {!stats || stats.todayEntries === 0 || !stats.todayPeople ? '0%' : `${Math.round(((stats.todayTotalFoodCoupons || 0) / stats.todayPeople) * 100)}%`}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">People with coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Coupons: {!stats || stats.todayEntries === 0 ? '0' : <AnimatedCounter value={stats.todayTotalFoodCoupons || 0} />}</div>
                    <div>People: {!stats || stats.todayEntries === 0 ? '0' : <AnimatedCounter value={stats.todayPeople || 0} />}</div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="h-12"></div>

            {/* All-Time Food Coupon Stats */}
            <div className="modern-card mb-8">
              <h3 className="heading-lg text-purple-700 mb-6">🏆 All-Time Food Coupons</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Fast Food Coupons All-Time */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border-2 border-orange-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-orange-900">🍟 Fast Food Coupons</span>
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-orange-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.totalFastFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">Total fast food coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Adults: {!stats ? '0' : <AnimatedCounter value={stats.totalAdultsFastFoodCoupons || 0} />}</div>
                    <div>Kids: {!stats ? '0' : <AnimatedCounter value={stats.totalKidsFastFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* Main Food Coupons All-Time */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-900">🍽️ Main Food Coupons</span>
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.totalMainFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-green-600 mt-1">Total main food coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Adults: {!stats ? '0' : <AnimatedCounter value={stats.totalAdultsMainFoodCoupons || 0} />}</div>
                    <div>Kids: {!stats ? '0' : <AnimatedCounter value={stats.totalKidsMainFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* Total Food Coupons All-Time */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-purple-900">🎫 Total Food Coupons</span>
                    <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {!stats ? '0' : <AnimatedCounter value={stats.totalFoodCoupons || 0} />}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">All food coupons all-time</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Fast Food: {!stats ? '0' : <AnimatedCounter value={stats.totalFastFoodCoupons || 0} />}</div>
                    <div>Main Food: {!stats ? '0' : <AnimatedCounter value={stats.totalMainFoodCoupons || 0} />}</div>
                  </div>
                </motion.div>

                {/* All-Time Coupon Usage Rate */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-blue-900">📊 All-Time Coupon Rate</span>
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {!stats || stats.totalEntries === 0 || !stats.totalPeople ? '0%' : `${Math.round(((stats.totalFoodCoupons || 0) / stats.totalPeople) * 100)}%`}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">People with coupons</p>
                  <div className="mt-2 text-xs text-blue-700">
                    <div>Coupons: {!stats || stats.totalEntries === 0 ? '0' : <AnimatedCounter value={stats.totalFoodCoupons || 0} />}</div>
                    <div>People: {!stats || stats.totalEntries === 0 ? '0' : <AnimatedCounter value={stats.totalPeople || 0} />}</div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="h-12"></div>

          <div className="modern-card mb-8">
          <h3 className="heading-lg text-indigo-900 mb-6">📈 Advanced Analytics & Insights</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Ticket Type Demand Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl p-6 border-2 border-indigo-200"
            >
              <h4 className="heading-md text-indigo-800 mb-4">🎫 Ticket Type Demand Analysis & Upgrade Insights</h4>
              
              {/* Upgrade Statistics Summary */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-indigo-700">Total Upgrades</p>
                      <p className="text-2xl font-bold text-indigo-900">{stats?.totalUpgrades || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 002-2M9 17l5-5 5-5z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-purple-700">Today's Upgrades</p>
                      <p className="text-2xl font-bold text-purple-900">{stats?.todayUpgrades || 0}</p>
                    </div>
                    <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={safeCharts.comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} tickets`, 'Count']} />
                  <Legend />
                  <Bar dataKey="value" fill="#6366f1" name="Tickets Sold" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Weekly Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl p-6 border-2 border-emerald-200"
            >
              <h4 className="heading-md text-emerald-800 mb-4">📊 Weekly Performance</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={safeCharts.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'count' ? `${value} entries` : `₹${value}`,
                    name === 'count' ? 'Entries' : 'Revenue'
                  ]} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#10b981" name="Entries" strokeWidth={2} />
                  <Line type="monotone" dataKey="amount" stroke="#f59e0b" name="Revenue" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Monthly Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl p-6 border-2 border-purple-200"
            >
              <h4 className="heading-md text-purple-800 mb-4">📅 Monthly Trends</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={safeCharts.monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'count' ? `${value} entries` : `₹${value}`,
                    name === 'count' ? 'Entries' : 'Revenue'
                  ]} />
                  <Legend />
                  <Bar dataKey="count" fill="#8b5cf6" name="Entries" />
                  <Bar dataKey="amount" fill="#ec4899" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Quarterly Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl p-6 border-2 border-orange-200"
            >
              <h4 className="heading-md text-orange-800 mb-4">🏆 Quarterly Performance</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={generateQuarterlyData(safeCharts.monthly)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [
                    name === 'entries' ? `${value} entries` : `₹${value}`,
                    name === 'entries' ? 'Entries' : 'Revenue'
                  ]} />
                  <Legend />
                  <Bar dataKey="entries" fill="#f97316" name="Entries" />
                  <Bar dataKey="revenue" fill="#fb923c" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Yearly Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl p-6 border-2 border-blue-200"
          >
            <h4 className="heading-md text-blue-800 mb-4">📈 Yearly Overview</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={generateYearlyData(safeCharts.monthly)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis />
                <Tooltip formatter={(value, name) => [
                  name === 'entries' ? `${value} entries` : `₹${value}`,
                  name === 'entries' ? 'Entries' : 'Revenue'
                ]} />
                <Legend />
                <Line type="monotone" dataKey="entries" stroke="#3b82f6" name="Entries" strokeWidth={3} />
                <Line type="monotone" dataKey="revenue" stroke="#06b6d4" name="Revenue" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Limited Recent Entries Section */}
        <div className="modern-card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="heading-lg text-blue-900">📋 Recent Entries</h3>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Showing {Math.min(recentEntries.length, 5)} of {recentEntries.length} entries
              </span>
              <Link 
                to="/entries" 
                className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
              >
                View All
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adults</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kids</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Array.isArray(recentEntries) && recentEntries.length > 0 ? (
                  recentEntries.slice(0, 5).map((entry, index) => (
                    <tr key={entry._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {dayjs(entry.createdAt).format('hh:mm A')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {entry.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.adults}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.ticketType === '150' ? '-' : entry.kids}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-green-600">
                        ₹{entry.finalAmount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex flex-col gap-1">
                          {entry.cashAmount > 0 && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Cash: ₹{entry.cashAmount}
                            </span>
                          )}
                          {entry.upiAmount > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              UPI: ₹{entry.upiAmount}
                            </span>
                          )}
                          {entry.otherAmount > 0 && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Other: ₹{entry.otherAmount}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No recent entries</p>
                        <p className="text-sm mt-1">Entries will appear here as they are created</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <Link
            to="/ticket"
            className="btn-primary"
          >
            🎫 New Ticket Entry
          </Link>
          <Link
            to="/admin/entries"
            className="btn-secondary"
          >
            📋 Ticket Entries
          </Link>
          <Link
            to="/admin/users"
            className="btn-secondary"
          >
            👥 Manage Users
          </Link>
          <Link
            to="/admin/export"
            className="btn-secondary"
          >
            📦 Export
          </Link>
          <Link
            to="/admin/analytics"
            className="btn-secondary"
          >
            📊 Analytics
          </Link>
        </motion.div>
        </>
        ) : null}
      </div>
    </Layout>
  );
}
