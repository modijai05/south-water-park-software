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
import { TICKET_OPTIONS } from '@/types';
import { invalidateTicketConfigCache } from '@/lib/ticketUtils';
import { globalSyncService } from '@/services/globalSyncService';

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

  // Enhanced fetch ticket configurations with proper error handling and sync
  const fetchTicketConfigs = async (): Promise<TicketConfig[]> => {
    try {
      console.log('🔄 Staff: Fetching ticket configs...');
      
      // Invalidate cache to ensure fresh data
      invalidateTicketConfigCache();
      
      // Add small delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const configs = await ticketConfigApi.getAll();
      console.log('✅ Staff: Fetched ticket configs:', configs);
      console.log('🎫 Staff: Current prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
      
      setTicketConfigs(configs);
      return configs;
    } catch (error) {
      console.error('❌ Staff: Failed to fetch ticket configs:', error);
      // Return fallback configs to prevent UI errors
      const fallbackConfigs = TICKET_OPTIONS.map(option => ({
        ticketType: option.value,
        basePrice: option.price,
        label: option.label.replace(/^₹\d+\s*–\s*/, ''),
        hasKids: option.hasKids,
        description: option.label,
        dayWisePricing: [],
        isActive: true,
        foodIncluded: option.label.includes('Food')
      }));
      setTicketConfigs(fallbackConfigs);
      return fallbackConfigs;
    }
  };

  // Enhanced getCurrentTicketPrice with better logging and fallback handling
  const getCurrentTicketPrice = (ticketType: string): number => {
    console.log('🎫 Staff: Getting price for ticket type:', ticketType, 'Available configs:', ticketConfigs.length);
    
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config) {
      console.log('🎫 Staff: Found config for', ticketType, 'basePrice:', config.basePrice);
      
      // Get current day name
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing?.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        const finalPrice = todayPricing.fixedAmount !== undefined 
          ? todayPricing.fixedAmount 
          : Math.round(config.basePrice * todayPricing.priceMultiplier);
        console.log('🎫 Staff: Using day-wise pricing for', today, 'price:', finalPrice);
        return finalPrice;
      }
      
      // Use base price if no day-wise pricing or not enabled
      console.log('🎫 Staff: Using base price:', config.basePrice);
      return config.basePrice;
    }
    
    // Fallback to static options (same as Admin Dashboard)
    const staticOption = TICKET_OPTIONS.find(t => t.value === ticketType);
    const fallbackPrice = staticOption?.price || 0;
    console.log('🎫 Staff: Using fallback price for', ticketType, ':', fallbackPrice);
    return fallbackPrice;
  };

  // Enhanced sync function to force refresh all data
  const forceRefreshAllData = async () => {
    console.log('🔄 Staff: Force refreshing all data...');
    try {
      // Invalidate cache first
      invalidateTicketConfigCache();
      
      // Add delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch everything fresh
      const [statsRes, configs] = await Promise.all([
        entriesApi.stats(),
        fetchTicketConfigs()
      ]);
      
      setStats(statsRes as unknown as Stats);
      console.log('🎫 Staff: Force refreshed - New prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
      console.log('📊 Staff: Force refreshed - New stats:', statsRes);
      
      // Trigger global sync event
      window.dispatchEvent(new CustomEvent('staff-synced', {
        detail: {
          action: 'force-refresh',
          timestamp: new Date().toISOString(),
          source: 'staff-dashboard',
          ticketConfigs: configs,
          stats: statsRes
        }
      }));
      
    } catch (error) {
      console.error('❌ Staff: Failed to force refresh data:', error);
    }
  };

  // Combined effect for initial data loading and real-time sync
  useEffect(() => {
    let syncInterval: number;
    let cancelled = false;
    
    const fetchInitialData = async () => {
      try {
        console.log('🚀 Staff: Loading initial data...');
        
        // Fetch both stats and ticket configs in parallel
        const [statsRes, configs] = await Promise.all([
          entriesApi.stats(),
          fetchTicketConfigs()
        ]);
        
        if (!cancelled) {
          setStats(statsRes as unknown as Stats);
          // Note: setTicketConfigs is already called in fetchTicketConfigs
          console.log('✅ Staff: Initial data loaded - Stats:', statsRes, 'Configs:', configs.length);
        }
      } catch (error) {
        console.error('❌ Staff: Failed to load initial data:', error);
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

    // Load initial data
    fetchInitialData();
    
    // Handle entry updates
    const handleEntryUpdate = async () => {
      console.log('🔄 Staff: Handling entry update...');
      try {
        const res = await entriesApi.stats();
        if (!cancelled) {
          setStats(res as unknown as Stats);
          console.log('✅ Staff: Stats refreshed successfully');
        }
      } catch (error) {
        console.error('❌ Staff: Failed to refresh stats:', error);
      }
    };

    // Handle ticket config updates with immediate price refresh
    const handleTicketConfigUpdate = async () => {
      console.log('🔄 Staff: Ticket config updated event received, refreshing configs...');
      try {
        // Invalidate shared cache first to ensure fresh data
        invalidateTicketConfigCache();
        
        // Add small delay to ensure cache is cleared
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Force refresh both configs and stats for complete sync
        const [statsRes, configs] = await Promise.all([
          entriesApi.stats(),
          fetchTicketConfigs()
        ]);
        
        if (!cancelled) {
          setStats(statsRes as unknown as Stats);
          console.log('🔄 Staff: Refreshed stats and ticket configs');
          console.log('🎫 Staff: Updated prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
          console.log('✅ Staff: Complete data refresh successful');
          
          // Trigger comprehensive sync events
          window.dispatchEvent(new CustomEvent('staff-synced', {
            detail: {
              action: 'ticket-config-update',
              entryId: 'all',
              timestamp: new Date().toISOString(),
              source: 'staff-dashboard',
              ticketConfigs: configs,
              stats: statsRes
            }
          }));
          
          window.dispatchEvent(new CustomEvent('global-sync', {
            detail: {
              action: 'ticket-config-update',
              timestamp: new Date().toISOString(),
              source: 'staff-dashboard'
            }
          }));
        }
      } catch (error) {
        console.error('❌ Staff: Failed to refresh ticket configs:', error);
      }
    };

    // Optimized event listeners with reduced throttling for real-time sync
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
      console.log('🚀 Staff: Immediate sync triggered for entry change');
      handleEntryUpdate();
    };

    // Set up event listeners for comprehensive real-time sync
    window.addEventListener('entry-updated', throttledHandleEntryUpdate);
    window.addEventListener('entry-created', immediateHandleEntryUpdate); // Immediate sync for new entries
    window.addEventListener('entry-deleted', immediateHandleEntryUpdate); // Immediate sync for deletions
    window.addEventListener('dashboard-synced', throttledHandleEntryUpdate);
    window.addEventListener('admin-synced', throttledHandleEntryUpdate);
    window.addEventListener('staff-synced', throttledHandleEntryUpdate);
    window.addEventListener('ticket-config-updated', handleTicketConfigUpdate);
    
    // Listen for receipt-related events from admin dashboard
    const handleReceiptEvent = () => {
      console.log('🧾 Staff: Receipt event received, refreshing stats...');
      handleEntryUpdate();
    };
    
    window.addEventListener('receipt-generated', handleReceiptEvent);
    window.addEventListener('receipt-printed', handleReceiptEvent);
    window.addEventListener('payment-completed', handleReceiptEvent);
    
    // Add discount-specific event listeners for real-time sync
    const handleDiscountUpdate = (event: any) => {
      console.log('💰 Staff: Discount update event received:', event.detail);
      handleEntryUpdate();
    };
    
    window.addEventListener('discount-updated', handleDiscountUpdate);
    window.addEventListener('additional-discount-updated', handleDiscountUpdate);
    
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
      window.removeEventListener('entry-created', immediateHandleEntryUpdate);
      window.removeEventListener('entry-deleted', immediateHandleEntryUpdate);
      window.removeEventListener('dashboard-synced', throttledHandleEntryUpdate);
      window.removeEventListener('admin-synced', throttledHandleEntryUpdate);
      window.removeEventListener('staff-synced', throttledHandleEntryUpdate);
      window.removeEventListener('ticket-config-updated', handleTicketConfigUpdate);
      window.removeEventListener('receipt-generated', handleReceiptEvent);
      window.removeEventListener('receipt-printed', handleReceiptEvent);
      window.removeEventListener('payment-completed', handleReceiptEvent);
      window.removeEventListener('discount-updated', handleDiscountUpdate);
      window.removeEventListener('additional-discount-updated', handleDiscountUpdate);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, []);

  // Global Sync Service Integration
  useEffect(() => {
    let cancelled = false;

    // Handle global sync events from sync service
    const handleGlobalSyncTriggered = (data: any) => {
      if (!cancelled) {
        console.log('🌐 Staff: Global sync triggered:', data);
        const fetchData = async () => {
          try {
            const [s] = await Promise.all([
              entriesApi.stats()
            ]);
            if (!cancelled) {
              setStats(s.data as unknown as Stats);
              console.log('✅ Staff: Data updated via global sync');
            }
          } catch (error) {
            console.error('❌ Staff: Global sync failed:', error);
          }
        };
        fetchData();
      }
    };

    // Handle immediate sync requirements
    const handleImmediateSyncRequired = (data: any) => {
      if (!cancelled) {
        console.log('🚀 Staff: Immediate sync required:', data);
        handleGlobalSyncTriggered(data);
      }
    };

    // Handle daily reset events
    const handleDailyReset = (data: any) => {
      if (!cancelled) {
        console.log('🌅 Staff: Daily reset triggered, refreshing data');
        handleGlobalSyncTriggered({ ...data, reason: 'daily-reset' });
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
  
  // Enhanced receipt generation with correct pricing and professional sync
  const generateReceiptForEntry = async (entry: any) => {
    try {
      console.log('🧾 Staff: Generating receipt for entry:', entry.id);
      console.log('🎫 Staff: Entry ticket type:', entry.ticketType, 'Current price:', getCurrentTicketPrice(entry.ticketType));
      
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
            
            // Trigger receipt-generated event for real-time sync
            window.dispatchEvent(new CustomEvent('receipt-generated', {
              detail: {
                entryId: entry.id,
                receiptNumber: receiptNumber,
                generatedBy: user?.username || 'Staff',
                timestamp: new Date().toISOString(),
                source: 'staff-dashboard',
                ticketType: entry.ticketType,
                ticketPrice: getCurrentTicketPrice(entry.ticketType)
              }
            }));
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
      
      // Enhanced receipt data with correct pricing information
      const currentTicketPrice = getCurrentTicketPrice(entry.ticketType);
      const receiptPayload = {
        receiptNumber,
        ...entry,
        // Ensure correct pricing is included
        baseAmount: entry.baseAmount || (currentTicketPrice * (entry.adults || 1)),
        finalAmount: entry.finalAmount || (currentTicketPrice * (entry.adults || 1)),
        // Add current ticket price for display
        currentTicketPrice: currentTicketPrice,
        ticketTypeLabel: getTicketTypeName(entry.ticketType),
        // Add staff generation note with timestamp
        notes: `${entry.notes || ''} [Receipt printed by ${user?.username || 'Staff'} on ${new Date().toLocaleString()}]`
      };
      
      console.log('🧾 Staff: Enhanced receipt payload prepared:', {
        receiptNumber,
        ticketType: entry.ticketType,
        currentPrice: currentTicketPrice,
        baseAmount: receiptPayload.baseAmount,
        finalAmount: receiptPayload.finalAmount
      });
      
      setReceiptData(receiptPayload);
      setShowReceipt(true);
      
      // Trigger receipt-printed event for real-time sync with admin dashboard
      window.dispatchEvent(new CustomEvent('receipt-printed', {
        detail: {
          entryId: entry.id,
          receiptNumber: receiptNumber,
          printedBy: user?.username || 'Staff',
          timestamp: new Date().toISOString(),
          source: 'staff-dashboard',
          ticketType: entry.ticketType,
          ticketPrice: currentTicketPrice,
          entryData: {
            name: entry.name,
            mobile: entry.mobile,
            ticketType: entry.ticketType,
            ticketTypeLabel: getTicketTypeName(entry.ticketType),
            finalAmount: receiptPayload.finalAmount,
            currentPrice: currentTicketPrice
          }
        }
      }));
      
      // Also trigger general dashboard sync to refresh stats
      window.dispatchEvent(new CustomEvent('staff-synced', {
        detail: {
          action: 'receipt-printed',
          entryId: entry.id,
          timestamp: new Date().toISOString(),
          source: 'staff-receipt-generation',
          ticketType: entry.ticketType,
          ticketPrice: currentTicketPrice
        }
      }));
      
      console.log('✅ Staff: Enhanced receipt generated successfully and sync events dispatched');
      
    } catch (error) {
      console.error('❌ Staff: Failed to generate receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    }
  };
  
  // Helper function to get ticket type name (consistent with Receipt component)
  const getTicketTypeName = (type: string) => {
    const ticketNames: { [key: string]: string } = {
      '150': 'Regular Entry (₹150)',
      '300': '3-4 Hours Entry (₹300)',
      '450': 'Fast Food + Entry (₹450)',
      '600': 'Full Day Entry (₹600)',
      '100': 'Kids Special (₹100)'
    };
    return ticketNames[type] || type;
  };

  return (
    <Layout title="Dashboard">
      {/* Sync Status Indicator with Refresh Button */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2"
        >
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          Live Sync Active
        </motion.div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={forceRefreshAllData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2 transition-colors"
          title="Refresh all data and pricing"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </motion.button>
      </div>

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
              whileTap={{ scale: 0.9 }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </motion.div>
          </div>
          <div className="text-3xl font-bold text-gray-900">
            {loading ? (
              <div className="loading-skeleton h-10 w-20"></div>
            ) : stats?.todayEntries === 0 ? (
              <span className="text-gray-400">No entries</span>
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
              <span className="text-gray-600">Adults:</span>
              <span className="font-bold text-cyan-900">{stats?.today150Adults ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Kids:</span>
              <span className="font-bold text-cyan-900">{stats?.today150Kids ?? 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-bold text-cyan-900">{stats?.today150 ?? 0}</span>
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
