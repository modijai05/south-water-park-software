import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { ticketConfigApi } from '@/lib/ticketApi';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import Receipt from '@/components/Receipt';
import Logger from '@/lib/logger';
import type { TicketConfig, EntryRecord as Entry, Stats, CustomEventData } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { TICKET_OPTIONS } from '@/types';
import { invalidateTicketConfigCache } from '@/lib/ticketUtils';
import { unifiedDailyResetService } from '@/services/unifiedDailyResetService';
import { useDailyReset, performDailyReset, needsDailyReset } from '@/utils/dailyReset';
import { checkAndTriggerReset } from '@/utils/systemReset';
import { checkAndForceRefresh } from '@/utils/forceRefresh';
import { verifyTodayData, autoVerify } from '@/utils/verifyTodayData';
import { forceDailyResetComplete, needsForceReset } from '@/utils/forceDailyReset';

export function Staff() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);
  
  // Initialize unified daily reset service
  useEffect(() => {
    console.log('🔄 Staff Dashboard: Initializing unified daily reset service...');
    
    // Add reset listener for unified service
    const cleanupListener = unifiedDailyResetService.addResetListener(() => {
      console.log('🔄 Staff Dashboard: Unified reset event received, refreshing data...');
      fetchAllData();
    });

    // Check if reset is needed on component mount
    const today = dayjs().format('YYYY-MM-DD');
    const resetAlreadyTriggered = sessionStorage.getItem('staff-reset-triggered');
    
    // Clear session storage if it's a new day (LOCAL-based)
    const lastResetDate = sessionStorage.getItem('staff-reset-date');
    if (lastResetDate !== today) {
      sessionStorage.clear();
      sessionStorage.setItem('staff-reset-date', today);
      console.log('🔄 Staff Dashboard: New LOCAL day detected, cleared session storage:', {
        lastResetDate,
        today,
        localTime: dayjs().format('YYYY-MM-DD'),
        utcTime: dayjs().utc().format('YYYY-MM-DD')
      });
    }
    
    if (needsDailyReset()) {
      console.log('🔄 Staff Dashboard: Daily reset needed on mount');
      performDailyReset();
      fetchAllData();
    }
    
    // Only trigger system reset if not already done this session
    if (!resetAlreadyTriggered) {
      console.log('🔄 Staff Dashboard: First time setup - triggering system refresh');
      
      // Batch all reset operations together to prevent multiple triggers
      const performAllResets = async () => {
        try {
          // Check and trigger system reset for deployment changes
          const systemResetNeeded = checkAndTriggerReset();
          
          // Check and force refresh to today's data
          const forceRefreshNeeded = checkAndForceRefresh();
          
          // Mark as triggered for this session
          sessionStorage.setItem('staff-reset-triggered', 'true');
          
          console.log('🔄 Staff Dashboard: Reset operations completed', {
            systemReset: systemResetNeeded,
            forceRefresh: forceRefreshNeeded,
            localDate: today
          });
        } catch (error) {
          console.error('❌ Staff Dashboard: Reset operations failed:', error);
        }
      };
      
      // Execute all resets together
      performAllResets();
    } else {
      console.log('🔄 Staff Dashboard: Reset already triggered this session - skipping');
    }
    
    // Auto-verify today's data is correct (always run but with delay)
    setTimeout(() => {
      autoVerify();
    }, 5000); // Delay to allow resets to complete
    
    // Listen for force reset events
    const handleForceResetSuccess = (event: any) => {
      console.log('🎉 Staff Dashboard: Force reset successful:', event.detail);
      // Refresh data after successful force reset
      fetchAllData();
    };
    
    const handleForceResetFailure = (event: any) => {
      console.error('❌ Staff Dashboard: Force reset failed:', event.detail);
      // Show user notification for manual intervention
      if (typeof window !== 'undefined' && window.alert) {
        alert('⚠️ Daily reset failed! Previous day data is still showing.\n\nPlease refresh the page or contact support.\n\nYou can also try: window.forceDailyResetComplete()');
      }
    };
    
    window.addEventListener('force-daily-reset-success', handleForceResetSuccess);
    window.addEventListener('force-daily-reset-failure', handleForceResetFailure);
    
    // Cleanup
    return () => {
      cleanupListener();
      window.removeEventListener('force-daily-reset-success', handleForceResetSuccess);
      window.removeEventListener('force-daily-reset-failure', handleForceResetFailure);
    };
  }, []);
  
  // Receipt generation states
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Enhanced fetch ticket configurations with proper error handling and sync
  const fetchTicketConfigs = async (): Promise<TicketConfig[]> => {
    try {
      Logger.debug('Fetching ticket configs', {}, 'Staff');
      
      // Invalidate cache to ensure fresh data
      invalidateTicketConfigCache();
      
      // Add small delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const configs = await ticketConfigApi.getAll();
      Logger.debug('Fetched ticket configs', { count: configs.length }, 'Staff');
      Logger.debug('Current prices', configs.map(c => ({ type: c.ticketType, price: c.basePrice })), 'Staff');
      
      setTicketConfigs(configs);
      return configs;
    } catch (error) {
      Logger.error('Failed to fetch ticket configs', error, 'Staff');
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
    Logger.debug('Getting price for ticket type', { ticketType, configCount: ticketConfigs.length }, 'Staff');
    
    const config = ticketConfigs.find(c => c.ticketType === ticketType);
    if (config) {
      Logger.debug('Found config for ticket', { ticketType, basePrice: config.basePrice }, 'Staff');
      
      // Get current day name
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPricing = config.dayWisePricing?.find(dp => dp.day === today && dp.enabled);
      
      if (todayPricing) {
        const finalPrice = todayPricing.fixedAmount !== undefined 
          ? todayPricing.fixedAmount 
          : Math.round(config.basePrice * todayPricing.priceMultiplier);
        Logger.debug('Using day-wise pricing', { today, price: finalPrice }, 'Staff');
        return finalPrice;
      }
      
      // Use base price if no day-wise pricing or not enabled
      Logger.debug('Using base price', { basePrice: config.basePrice }, 'Staff');
      return config.basePrice;
    }
    
    // Fallback to static options (same as Admin Dashboard)
    const staticOption = TICKET_OPTIONS.find(t => t.value === ticketType);
    const fallbackPrice = staticOption?.price || 0;
    Logger.debug('Using fallback price', { ticketType, fallbackPrice }, 'Staff');
    return fallbackPrice;
  };

  // Main data fetching function with comprehensive sync
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Staff Dashboard: Fetching all data with comprehensive sync...');
      
      // Use comprehensive sync for better data consistency
      const syncData = await entriesApi.syncAll();
      
      if (syncData && syncData.stats) {
        setStats(syncData.stats as unknown as Stats);
        console.log('✅ Staff Dashboard: Comprehensive sync completed', {
          totalRecords: syncData.summary.totalRecords,
          todayRecords: syncData.summary.todayRecords,
          timestamp: syncData.summary.lastUpdated
        });
        
        // Fetch ticket configs separately
        await fetchTicketConfigs();
        
        // Trigger global sync event with comprehensive data
        window.dispatchEvent(new CustomEvent('staff-synced', {
          detail: {
            action: 'comprehensive-sync',
            timestamp: new Date().toISOString(),
            source: 'staff-dashboard',
            syncData: syncData
          }
        }));
      } else {
        // Fallback to individual API calls
        const [statsRes, configs] = await Promise.all([
          entriesApi.stats(),
          fetchTicketConfigs()
        ]);
        
        setStats(statsRes as unknown as Stats);
        console.log('✅ Staff Dashboard: Fallback sync completed', { stats: statsRes, configCount: configs.length });
      }
      
    } catch (error) {
      console.error('❌ Staff Dashboard: Error fetching data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Combined effect for initial data loading and real-time sync
  useEffect(() => {
    let syncInterval: number;
    let cancelled = false;
    
    const fetchInitialData = async () => {
      try {
        Logger.debug('Loading initial data', {}, 'Staff');
        
        // Fetch both stats and ticket configs in parallel
        const [statsRes, configs] = await Promise.all([
          entriesApi.stats(),
          fetchTicketConfigs()
        ]);
        
        if (!cancelled) {
          setStats(statsRes as unknown as Stats);
          // Note: setTicketConfigs is already called in fetchTicketConfigs
          Logger.debug('Initial data loaded', { stats: statsRes, configCount: configs.length }, 'Staff');
        }
      } catch (error) {
        Logger.error('Failed to load initial data', error, 'Staff');
        // Set to zero if API fails
        setStats({
          todayEntries: 0,
          totalEntries: 0,
          todayPeople: 0,
          totalPeople: 0,
          adults: { today: 0, total: 0 },
          kids: { today: 0, total: 0 },
          cash: { today: 0, total: 0 },
          upi: { today: 0, total: 0 },
          advance: { today: 0, total: 0 },
          amount: { today: 0, total: 0 },
          today150: 0,
          total150: 0,
          today150Adults: 0,
          today150Kids: 0,
          total150Adults: 0,
          total150Kids: 0,
          today300: 0,
          total300: 0,
          today300Adults: 0,
          total300Kids: 0,
          today450: 0,
          total450: 0,
          today450Adults: 0,
          total450Kids: 0,
          today600: 0,
          total600: 0,
          today600Adults: 0,
          total600Kids: 0,
          today100: 0,
          total100: 0,
          today100Adults: 0,
          today100Kids: 0,
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
          todayAdditionalDiscount: 0,
          todayTotalDiscount: 0,
          totalAdditionalDiscount: 0,
          totalTotalDiscount: 0,
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
      Logger.debug('Handling entry update - Fetching fresh MongoDB data', {}, 'Staff');
      try {
        // Force refresh from MongoDB with timestamp to prevent caching
        const timestamp = Date.now();
        const res = await entriesApi.stats(true); // Force refresh parameter
        if (!cancelled) {
          setStats(res as unknown as Stats);
          console.log('✅ Staff: MongoDB stats refreshed successfully:', res);
          
          // Trigger global sync to notify other components
          window.dispatchEvent(new CustomEvent('staff-synced', {
            detail: {
              action: 'stats-refreshed',
              timestamp: new Date().toISOString(),
              source: 'staff-dashboard',
              stats: res
            }
          }));
        }
      } catch (error) {
        console.error('❌ Staff: Failed to refresh MongoDB stats:', error);
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
      Logger.debug('Receipt event received, refreshing stats', {}, 'Staff');
      handleEntryUpdate();
    };
    
    window.addEventListener('receipt-generated', handleReceiptEvent);
    window.addEventListener('receipt-printed', handleReceiptEvent);
    window.addEventListener('payment-completed', handleReceiptEvent);
    
    // Add discount-specific event listeners for real-time sync
    const handleDiscountUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      Logger.debug('Discount update event received', customEvent.detail, 'Staff');
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
    const handleGlobalSyncTriggered = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!cancelled) {
        Logger.debug('Global sync triggered', customEvent.detail, 'Staff');
        const fetchData = async () => {
          try {
            const [s] = await Promise.all([
              entriesApi.stats()
            ]);
            if (!cancelled) {
              setStats(s as unknown as Stats);
              Logger.debug('✅ Staff: Data updated via global sync', {}, 'Staff');
            }
          } catch (error) {
            Logger.error('❌ Staff: Global sync failed:', error);
          }
        };
        fetchData();
      }
    };

    // Handle immediate sync requirements
    const handleImmediateSyncRequired = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!cancelled) {
        Logger.debug('Immediate sync required', customEvent.detail, 'Staff');
        handleGlobalSyncTriggered(customEvent);
      }
    };

    // Handle daily reset events
    const handleDailyReset = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (!cancelled) {
        Logger.debug('Daily reset triggered, refreshing data', customEvent.detail, 'Staff');
        handleGlobalSyncTriggered(customEvent);
      }
    };

    // Register listeners with unified daily reset service instead
    // The unified service handles cross-dashboard communication automatically

    // Also listen for DOM events for compatibility
    window.addEventListener('daily-reset', handleDailyReset);

    return () => {
      // Only need to remove DOM event listeners since unified service handles the rest
      window.removeEventListener('daily-reset', handleDailyReset);
    };
  }, []);
  
  // Search functionality across all users for receipt generation
  const handleSearch = async (query: string) => {
    Logger.debug('Staff: Starting cross-user search for:', { query }, 'Staff');
    Logger.debug('Staff: Current user:', { username: user?.username, role: user?.role }, 'Staff');
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      // Use searchAll to search across all users and admins
      Logger.debug('Calling cross-user search API', { query, limit: 10 }, 'Staff');
      const response = await entriesApi.searchAll({ search: query, limit: 10 });
      Logger.debug('Cross-user search response', response, 'Staff');
      Logger.debug('Response entries count', { count: response.entries?.length || 0 }, 'Staff');
      
      setSearchResults(response.entries || []);
      
      // Log details of found entries
      if (response.entries && Array.isArray(response.entries) && response.entries.length > 0) {
        Logger.info('Found entries', { count: response.entries?.length || 0 }, 'Staff');
        const safeEntries = Array.isArray(response.entries) ? response.entries : [];
        safeEntries.forEach((entry: Entry, index: number) => {
          if (!entry) return; // Guard against null/undefined entries
          const createdBy = entry.createdBy?.username || entry.createdBy?.fullName || 'Unknown';
          Logger.debug(`Entry ${index + 1}`, { name: entry.name, mobile: entry.mobile, createdBy }, 'Staff');
        });
      } else {
        Logger.debug('No entries found for search query', { query }, 'Staff');
      }
    } catch (error) {
      Logger.error('Cross-user search failed', error, 'Staff');
      setSearchResults([]);
      
      // Provide user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        alert(`Search endpoint not available.\nPlease restart the server to enable cross-user search.\nError: ${errorMessage}`);
      } else {
        alert(`Search Failed!\nError: ${errorMessage}\nPlease try again or contact support.`);
      }
    } finally {
      setIsSearching(false);
    }
  };
  
  // Enhanced receipt generation with correct pricing and professional sync
  const generateReceiptForEntry = async (entry: Entry) => {
    try {
      Logger.debug('Generating receipt for entry', { id: entry._id, ticketType: entry.ticketType }, 'Staff');
      Logger.debug('Entry ticket price', { ticketType: entry.ticketType, price: getCurrentTicketPrice(entry.ticketType) }, 'Staff');
      
      // Generate receipt number if it doesn't exist
      let receiptNumber = entry.receiptNumber;
      if (!receiptNumber) {
        try {
          Logger.debug('Generating receipt number for existing entry', {}, 'Staff');
          const receiptRes = await fetch(`/api/entries/${entry.id}/generate-receipt`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (receiptRes.ok) {
            const receiptData = await receiptRes.json();
            receiptNumber = receiptData.receiptNumber;
            Logger.debug('Receipt generated successfully', { receiptNumber }, 'Staff');
            
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
            Logger.error('Failed to generate receipt number', new Error('Failed to generate receipt number'), 'Staff');
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

  // Loading guard
  if (loading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="ml-4 text-gray-600">Loading dashboard...</p>
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
          onClick={fetchAllData}
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
