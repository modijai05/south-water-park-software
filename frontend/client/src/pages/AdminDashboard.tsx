import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { DiscountAnalytics } from '@/components/DiscountAnalytics';
import { computeAmounts, TICKET_OPTIONS, isSunday } from '@/lib/ticketUtils';
import { ticketConfigApi } from '@/lib/ticketApi';
import { entriesApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { invalidateTicketConfigCache } from '@/lib/ticketUtils';
import { useAuthStore } from '@/store/authStore';
import type { TicketConfig, Stats } from '@/types';
import { globalSyncService } from '@/services/globalSyncService';
import { unifiedDailyResetService } from '@/services/unifiedDailyResetService';
import { useDailyReset, performDailyReset, needsDailyReset } from '@/utils/dailyReset';
import { checkAndTriggerReset } from '@/utils/systemReset';
import { checkAndForceRefresh } from '@/utils/forceRefresh';
import { verifyTodayData, autoVerify } from '@/utils/verifyTodayData';
import { forceDailyResetComplete, needsForceReset } from '@/utils/forceDailyReset';
import { getEffectiveEntryDate } from '@/utils/dateUtils';
import utc from 'dayjs/plugin/utc';

// Enable UTC plugin
dayjs.extend(utc);

// Helper function to count coupons from range strings
const countCouponsFromRange = (couponRange: string | number | null | undefined): number => {
  if (!couponRange && couponRange !== 0) return 0;
  if (typeof couponRange === 'number') return couponRange;
  if (typeof couponRange === 'string') {
    const match = couponRange.match(/(\d+)-(\d+)/);
    if (match) {
      return parseInt(match[2]) - parseInt(match[1]) + 1;
    }
    // If it's a simple number as string
    const num = parseInt(couponRange);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

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

  
interface Charts {
  hourlyChart: { _id: string; count: number; amount: number }[];
  ticketDistribution: { _id: string; count: number; amount: number }[];
  hourlyComparison: { hour: string; entries: number; revenue: number }[];
  monthly: { _id: string; count: number; amount: number }[];
  summary: {
    totalEntries: number;
    totalRevenue: number;
    date: string;
    lastUpdated: string;
  };
}

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<Stats | null>(null);
  const [charts, setCharts] = useState<Charts | null>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [lastResetInfo, setLastResetInfo] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [ticketConfigs, setTicketConfigs] = useState<TicketConfig[]>([]);
  const [dataSyncStatus, setDataSyncStatus] = useState<'loading' | 'syncing' | 'ready' | 'error'>('loading');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    allTimeEntries: 0,
    allTimeRevenue: 0,
    todayEntries: 0,
    todayRevenue: 0,
    lastSyncTime: null as string | null
  });
  
  // Intelligent sync state management with coordination
  const [syncState, setSyncState] = useState({
    isAutoSyncing: false,
    lastSyncAttempt: 0,
    syncInProgress: false, // Prevent concurrent syncs
    errorCount: 0,
    backgroundSyncEnabled: true,
    syncInterval: 30000, // 30 seconds
    lastSyncTime: null as string | null
  });

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
      console.error('Dashboard: Failed to fetch ticket configs:', error);
      // Return fallback configs to prevent UI errors
      const fallbackConfigs = TICKET_OPTIONS.map(option => ({
        ticketType: option.value,
        label: option.label,
        basePrice: option.price,
        adultPrice: option.price,
        kidPrice: Math.round(option.price * 0.5),
        adultFastFoodPrice: 150,
        kidFastFoodPrice: 100,
        adultMainFoodPrice: 250,
        kidMainFoodPrice: 200,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      setTicketConfigs(fallbackConfigs);
      return fallbackConfigs;
    }
  };

  // Main data fetching function
  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use intelligent background sync for all data fetching
      await intelligentBackgroundSync(true);
      
    } catch (error) {
      console.error('AdminDashboard: Error fetching data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Initialize unified daily reset service
  useEffect(() => {
    console.log('🔄 Admin Dashboard: Initializing unified daily reset service...');
    
    // Add reset listener for unified service
    const cleanupListener = unifiedDailyResetService.addResetListener(() => {
      console.log('🔄 Admin Dashboard: Unified reset event received, refreshing data...');
      fetchAllData();
    });

    // Check if reset is needed on component mount
    const today = dayjs().format('YYYY-MM-DD');
    const resetAlreadyTriggered = sessionStorage.getItem('admin-reset-triggered');
    
    // Clear session storage if it's a new day (LOCAL-based)
    const lastResetDate = sessionStorage.getItem('admin-reset-date');
    if (lastResetDate !== today) {
      sessionStorage.clear();
      sessionStorage.setItem('admin-reset-date', today);
      console.log('🔄 Admin Dashboard: New LOCAL day detected, cleared session storage:', {
        lastResetDate,
        today,
        localTime: dayjs().format('YYYY-MM-DD'),
        utcTime: dayjs().utc().format('YYYY-MM-DD')
      });
    }
    
    if (needsDailyReset()) {
      console.log('🔄 Admin Dashboard: Daily reset needed on mount');
      performDailyReset();
      fetchAllData();
    }
    
    // Only trigger system reset if not already done this session
    if (!resetAlreadyTriggered) {
      console.log('🔄 Admin Dashboard: First time setup - triggering system refresh');
      
      // Batch all reset operations together to prevent multiple triggers
      const performAllResets = async () => {
        try {
          // Check and trigger system reset for deployment changes
          const systemResetNeeded = checkAndTriggerReset();
          
          // Check and force refresh to today's data
          const forceRefreshNeeded = checkAndForceRefresh();
          
          // Mark as triggered for this session
          sessionStorage.setItem('admin-reset-triggered', 'true');
          
          console.log('🔄 Admin Dashboard: Reset operations completed', {
            systemReset: systemResetNeeded,
            forceRefresh: forceRefreshNeeded,
            localDate: today
          });
        } catch (error) {
          console.error('❌ Admin Dashboard: Reset operations failed:', error);
        }
      };
      
      // Execute all resets together
      performAllResets();
    } else {
      console.log('🔄 Admin Dashboard: Reset already triggered this session - skipping');
    }
    
    // Auto-verify today's data is correct (always run but with delay)
    setTimeout(() => {
      autoVerify();
    }, 5000); // Delay to allow resets to complete
    
    // Listen for force reset events
    const handleForceResetSuccess = (event: any) => {
      console.log('🎉 Admin Dashboard: Force reset successful:', event.detail);
      // Refresh data after successful force reset
      fetchAllData();
    };
    
    window.addEventListener('force-daily-reset-success', handleForceResetSuccess);
    
    // Cleanup
    return () => {
      cleanupListener();
      window.removeEventListener('force-daily-reset-success', handleForceResetSuccess);
    };
  }, []);

  // Enhanced sync function to force refresh all data
  const forceRefreshAllData = async () => {
    console.log('Admin: Force refreshing all data...');
    try {
      // Invalidate cache first
      invalidateTicketConfigCache();
      
      // Add delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fetch everything fresh
      const [statsRes, chartsRes, configs] = await Promise.all([
        entriesApi.stats(),
        entriesApi.todayCharts(),
        fetchTicketConfigs()
      ]);
      
      // Extract the actual data from the stats response
      const statsData = statsRes; // API returns data directly
      setStats(statsData as unknown as Stats);
      setCharts(chartsRes as unknown as Charts);
      console.log('Admin: Force refreshed - New prices:', configs.map(c => ({ type: c.ticketType, price: c.basePrice })));
      console.log('Admin: Force refreshed - New stats:', statsData);
      console.log('Admin: Force refreshed - Full stats response:', statsRes);
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

  // Calculate stats directly from entries data for perfect synchronization
  const calculateStatsFromEntries = (entriesData: any[]): Stats => {
    const today = dayjs().format('YYYY-MM-DD');
    const todayEntries = entriesData.filter(entry => 
      dayjs(getEffectiveEntryDate(entry)).format('YYYY-MM-DD') === today
    );
    
    // Calculate all-time totals
    const totalEntries = entriesData.length;
    const totalAmount = entriesData.reduce((sum, entry) => sum + (entry.finalAmount || 0), 0);
    const totalCash = entriesData.reduce((sum, entry) => sum + (entry.cashAmount || 0), 0);
    const totalUpi = entriesData.reduce((sum, entry) => sum + (entry.upiAmount || 0), 0);
    const totalAdvance = entriesData.reduce((sum, entry) => sum + (entry.advanceAmount || 0), 0);
    const totalAdults = entriesData.reduce((sum, entry) => sum + (entry.adults || 0), 0);
    const totalKids = entriesData.reduce((sum, entry) => sum + (entry.kids || 0), 0);
    const totalPeople = entriesData.reduce((sum, entry) => {
      if (entry.ticketType === '150') return sum + (entry.adults || 0);
      return sum + (entry.totalPeople || 0);
    }, 0);
    
    // Calculate today's totals
    const todayAmount = todayEntries.reduce((sum, entry) => sum + (entry.finalAmount || 0), 0);
    const todayCash = todayEntries.reduce((sum, entry) => sum + (entry.cashAmount || 0), 0);
    const todayUpi = todayEntries.reduce((sum, entry) => sum + (entry.upiAmount || 0), 0);
    const todayAdvance = todayEntries.reduce((sum, entry) => sum + (entry.advanceAmount || 0), 0);
    const todayAdults = todayEntries.reduce((sum, entry) => sum + (entry.adults || 0), 0);
    const todayKids = todayEntries.reduce((sum, entry) => sum + (entry.kids || 0), 0);
    const todayPeople = todayEntries.reduce((sum, entry) => {
      if (entry.ticketType === '150') return sum + (entry.adults || 0);
      return sum + (entry.totalPeople || 0);
    }, 0);
    
    // Calculate ticket type stats - CRITICAL FIX: Include upgraded tickets in their respective ticket type boxes
    const ticketTypeStats = (entries: any[], ticketType: string) => {
      let totalEntries = 0;
      let totalAdults = 0;
      let totalKids = 0;

      entries.forEach(entry => {
        // Count base ticket type (handle both string and number types)
        if (String(entry.ticketType) === String(ticketType)) {
          totalEntries += 1;
          totalAdults += (entry.adults || 0);
          totalKids += (entry.kids || 0);
        }

        // Count upgrades to this ticket type (handle both string and number types)
        if (entry.upgrades && Array.isArray(entry.upgrades)) {
          const matchingUpgrades = entry.upgrades.filter((u: any) => String(u.ticketType) === String(ticketType));
          if (matchingUpgrades.length > 0) {
            totalEntries += matchingUpgrades.length;
            totalAdults += matchingUpgrades.reduce((sum: number, u: any) => sum + (u.adults || 0), 0);
            totalKids += matchingUpgrades.reduce((sum: number, u: any) => sum + (u.kids || 0), 0);
          }
        }
      });

      return {
        entries: totalEntries,
        adults: totalAdults,
        kids: totalKids
      };
    };
    
    
    // Calculate upgrade-only stats for a specific ticket type
    const ticketTypeUpgradeStats = (entries: any[], ticketType: string) => {
      let totalUpgrades = 0;
      let totalAdults = 0;
      let totalKids = 0;

      entries.forEach(entry => {
        // Count ONLY upgrades to this ticket type (handle both string and number types)
        if (entry.upgrades && Array.isArray(entry.upgrades)) {
          const matchingUpgrades = entry.upgrades.filter((u: any) => String(u.ticketType) === String(ticketType));
          if (matchingUpgrades.length > 0) {
            totalUpgrades += matchingUpgrades.length;
            totalAdults += matchingUpgrades.reduce((sum: number, u: any) => sum + (u.adults || 0), 0);
            totalKids += matchingUpgrades.reduce((sum: number, u: any) => sum + (u.kids || 0), 0);
          }
        }
      });

      return {
        entries: totalUpgrades,
        adults: totalAdults,
        kids: totalKids
      };
    };

    // Collect all unique ticket types from entries (both base tickets and upgrades)
    const getAllTicketTypes = (entries: any[]): string[] => {
      const ticketTypes = new Set<string>();
      entries.forEach(entry => {
        if (entry.ticketType) {
          ticketTypes.add(String(entry.ticketType));
        }
        if (entry.upgrades && Array.isArray(entry.upgrades)) {
          entry.upgrades.forEach((upgrade: any) => {
            if (upgrade.ticketType) {
              ticketTypes.add(String(upgrade.ticketType));
            }
          });
        }
      });
      return Array.from(ticketTypes).sort();
    };
    // All-time ticket stats - Dynamic handling for all ticket types
    const allTicketTypes = getAllTicketTypes(entriesData);
    const totalTicketStats: { [key: string]: { entries: number; adults: number; kids: number } } = {};
    allTicketTypes.forEach(ticketType => {
      totalTicketStats[ticketType] = ticketTypeStats(entriesData, ticketType);
    });
    
    // Legacy stats for backward compatibility
    const total150Stats = totalTicketStats['150'] || { entries: 0, adults: 0, kids: 0 };
    const total200Stats = totalTicketStats['200'] || { entries: 0, adults: 0, kids: 0 };
    const total300Stats = totalTicketStats['300'] || { entries: 0, adults: 0, kids: 0 };
    const total450Stats = totalTicketStats['450'] || { entries: 0, adults: 0, kids: 0 };
    const total600Stats = totalTicketStats['600'] || { entries: 0, adults: 0, kids: 0 };
    const total100Stats = totalTicketStats['100'] || { entries: 0, adults: 0, kids: 0 };

    // Today ticket stats - Dynamic handling for all ticket types
    const todayAllTicketTypes = getAllTicketTypes(todayEntries);
    const todayTicketStats: { [key: string]: { entries: number; adults: number; kids: number } } = {};
    todayAllTicketTypes.forEach(ticketType => {
      todayTicketStats[ticketType] = ticketTypeStats(todayEntries, ticketType);
    });
    
    // Legacy stats for backward compatibility
    const today150Stats = todayTicketStats['150'] || { entries: 0, adults: 0, kids: 0 };
    const today200Stats = todayTicketStats['200'] || { entries: 0, adults: 0, kids: 0 };
    const today300Stats = todayTicketStats['300'] || { entries: 0, adults: 0, kids: 0 };
    const today450Stats = todayTicketStats['450'] || { entries: 0, adults: 0, kids: 0 };
    const today600Stats = todayTicketStats['600'] || { entries: 0, adults: 0, kids: 0 };
    const today100Stats = todayTicketStats['100'] || { entries: 0, adults: 0, kids: 0 };
    
    // Calculate upgrade-only stats for all ticket types
    const allTicketUpgradeStats: { [key: string]: { entries: number; adults: number; kids: number } } = {};
    allTicketTypes.forEach(ticketType => {
      allTicketUpgradeStats[ticketType] = ticketTypeUpgradeStats(entriesData, ticketType);
    });

    const todayTicketUpgradeStats: { [key: string]: { entries: number; adults: number; kids: number } } = {};
    todayAllTicketTypes.forEach(ticketType => {
      todayTicketUpgradeStats[ticketType] = ticketTypeUpgradeStats(todayEntries, ticketType);
    });

    // Legacy stats for backward compatibility
    const total150UpgradeStats = allTicketUpgradeStats['150'] || { entries: 0, adults: 0, kids: 0 };
    const total200UpgradeStats = allTicketUpgradeStats['200'] || { entries: 0, adults: 0, kids: 0 };
    const total300UpgradeStats = allTicketUpgradeStats['300'] || { entries: 0, adults: 0, kids: 0 };
    const total450UpgradeStats = allTicketUpgradeStats['450'] || { entries: 0, adults: 0, kids: 0 };
    const total600UpgradeStats = allTicketUpgradeStats['600'] || { entries: 0, adults: 0, kids: 0 };
    const total100UpgradeStats = allTicketUpgradeStats['100'] || { entries: 0, adults: 0, kids: 0 };

    const today150UpgradeStats = todayTicketUpgradeStats['150'] || { entries: 0, adults: 0, kids: 0 };
    const today200UpgradeStats = todayTicketUpgradeStats['200'] || { entries: 0, adults: 0, kids: 0 };
    const today300UpgradeStats = todayTicketUpgradeStats['300'] || { entries: 0, adults: 0, kids: 0 };
    const today450UpgradeStats = todayTicketUpgradeStats['450'] || { entries: 0, adults: 0, kids: 0 };
    const today600UpgradeStats = todayTicketUpgradeStats['600'] || { entries: 0, adults: 0, kids: 0 };
    const today100UpgradeStats = todayTicketUpgradeStats['100'] || { entries: 0, adults: 0, kids: 0 };

    // Calculate discount stats
    const totalAdditionalDiscount = entriesData.reduce((sum, entry) => sum + (entry.additionalDiscount || 0), 0);
    const totalKidDiscount = entriesData.reduce((sum, entry) => sum + (entry.kidDiscount || 0), 0);
    const totalTotalDiscount = totalAdditionalDiscount + totalKidDiscount;
    const todayAdditionalDiscount = todayEntries.reduce((sum, entry) => sum + (entry.additionalDiscount || 0), 0);
    const todayKidDiscount = todayEntries.reduce((sum, entry) => sum + (entry.kidDiscount || 0), 0);
    const todayTotalDiscount = todayAdditionalDiscount + todayKidDiscount;
    
    // Calculate food coupon stats - handle both numeric values and range strings (e.g., "1231-1233" = 3 coupons)
    const totalAdultsFastFoodCoupons = entriesData.reduce((sum, entry) => sum + countCouponsFromRange(entry.adultsFastFoodCoupon), 0);
    const totalKidsFastFoodCoupons = entriesData.reduce((sum, entry) => sum + countCouponsFromRange(entry.kidsFastFoodCoupon), 0);
    const totalAdultsMainFoodCoupons = entriesData.reduce((sum, entry) => sum + countCouponsFromRange(entry.adultsMainFoodCoupon), 0);
    const totalKidsMainFoodCoupons = entriesData.reduce((sum, entry) => sum + countCouponsFromRange(entry.kidsMainFoodCoupon), 0);
    const totalFastFoodCoupons = totalAdultsFastFoodCoupons + totalKidsFastFoodCoupons;
    const totalMainFoodCoupons = totalAdultsMainFoodCoupons + totalKidsMainFoodCoupons;
    const totalFoodCoupons = totalFastFoodCoupons + totalMainFoodCoupons;
    
    const todayAdultsFastFoodCoupons = todayEntries.reduce((sum, entry) => sum + countCouponsFromRange(entry.adultsFastFoodCoupon), 0);
    const todayKidsFastFoodCoupons = todayEntries.reduce((sum, entry) => sum + countCouponsFromRange(entry.kidsFastFoodCoupon), 0);
    const todayAdultsMainFoodCoupons = todayEntries.reduce((sum, entry) => sum + countCouponsFromRange(entry.adultsMainFoodCoupon), 0);
    const todayKidsMainFoodCoupons = todayEntries.reduce((sum, entry) => sum + countCouponsFromRange(entry.kidsMainFoodCoupon), 0);
    const todayFastFoodCoupons = todayAdultsFastFoodCoupons + todayKidsFastFoodCoupons;
    const todayMainFoodCoupons = todayAdultsMainFoodCoupons + todayKidsMainFoodCoupons;
    const todayTotalFoodCoupons = todayFastFoodCoupons + todayMainFoodCoupons;
    
    return {
      // Basic stats
      todayEntries: todayEntries.length,
      totalEntries,
      todayPeople,
      totalPeople,
      todayAdults,
      totalAdults,
      todayKids,
      totalKids,
      todayCash,
      totalCash,
      todayUpi,
      totalUpi,
      todayAdvance,
      totalAdvance,
      todayAmount,
      totalAmount,
      
      // Upgrade stats
      totalUpgrades: entriesData.filter(entry => entry.upgrades && entry.upgrades.length > 0).length,
      todayUpgrades: todayEntries.filter(entry => entry.upgrades && entry.upgrades.length > 0).length,
      
      // Discount stats
      todayAdditionalDiscount,
      todayTotalDiscount,
      totalAdditionalDiscount,
      totalTotalDiscount,
      
      // Performance metrics
      averageTicketValue: totalEntries > 0 ? Math.round(totalAmount / totalEntries) : 0,
      peakHour: '12:00', // Would need more complex calculation
      busiestDay: 'Monday', // Would need more complex calculation
      uniqueCustomers: totalEntries, // Simplified
      returningCustomers: 0, // Would need tracking
      conversionRate: 100, // Simplified
      
      // Ticket type counts
      today150: today150Stats.entries,
      today200: today200Stats.entries,
      today300: today300Stats.entries,
      today450: today450Stats.entries,
      today600: today600Stats.entries,
      today100: today100Stats.entries,
      total150: total150Stats.entries,
      total200: total200Stats.entries,
      total300: total300Stats.entries,
      total450: total450Stats.entries,
      total600: total600Stats.entries,
      total100: total100Stats.entries,

      // Per-ticket-type adult and kid counts
      today150Adults: today150Stats.adults,
      today150Kids: today150Stats.kids,
      today200Adults: today200Stats.adults,
      today200Kids: today200Stats.kids,
      today300Adults: today300Stats.adults,
      today300Kids: today300Stats.kids,
      today450Adults: today450Stats.adults,
      today450Kids: today450Stats.kids,
      today600Adults: today600Stats.adults,
      today600Kids: today600Stats.kids,
      today100Adults: today100Stats.adults,
      today100Kids: today100Stats.kids,
      total150Adults: total150Stats.adults,
      total150Kids: total150Stats.kids,
      total200Adults: total200Stats.adults,
      total200Kids: total200Stats.kids,
      total300Adults: total300Stats.adults,
      total300Kids: total300Stats.kids,
      total450Adults: total450Stats.adults,
      total450Kids: total450Stats.kids,
      total600Adults: total600Stats.adults,
      total600Kids: total600Stats.kids,
      total100Adults: total100Stats.adults,
      total100Kids: total100Stats.kids,
      
      // Per-ticket-type upgrade counts
      total150Upgrades: total150UpgradeStats.entries,
      total150UpgradesAdults: total150UpgradeStats.adults,
      total150UpgradesKids: total150UpgradeStats.kids,
      total200Upgrades: total200UpgradeStats.entries,
      total200UpgradesAdults: total200UpgradeStats.adults,
      total200UpgradesKids: total200UpgradeStats.kids,
      total300Upgrades: total300UpgradeStats.entries,
      total300UpgradesAdults: total300UpgradeStats.adults,
      total300UpgradesKids: total300UpgradeStats.kids,
      total450Upgrades: total450UpgradeStats.entries,
      total450UpgradesAdults: total450UpgradeStats.adults,
      total450UpgradesKids: total450UpgradeStats.kids,
      total600Upgrades: total600UpgradeStats.entries,
      total600UpgradesAdults: total600UpgradeStats.adults,
      total600UpgradesKids: total600UpgradeStats.kids,
      total100Upgrades: total100UpgradeStats.entries,
      total100UpgradesAdults: total100UpgradeStats.adults,
      total100UpgradesKids: total100UpgradeStats.kids,
      today150Upgrades: today150UpgradeStats.entries,
      today150UpgradesAdults: today150UpgradeStats.adults,
      today150UpgradesKids: today150UpgradeStats.kids,
      today200Upgrades: today200UpgradeStats.entries,
      today200UpgradesAdults: today200UpgradeStats.adults,
      today200UpgradesKids: today200UpgradeStats.kids,
      today300Upgrades: today300UpgradeStats.entries,
      today300UpgradesAdults: today300UpgradeStats.adults,
      today300UpgradesKids: today300UpgradeStats.kids,
      today450Upgrades: today450UpgradeStats.entries,
      today450UpgradesAdults: today450UpgradeStats.adults,
      today450UpgradesKids: today450UpgradeStats.kids,
      today600Upgrades: today600UpgradeStats.entries,
      today600UpgradesAdults: today600UpgradeStats.adults,
      today600UpgradesKids: today600UpgradeStats.kids,
      today100Upgrades: today100UpgradeStats.entries,
      today100UpgradesAdults: today100UpgradeStats.adults,
      today100UpgradesKids: today100UpgradeStats.kids,

      // Food coupon stats
      todayAdultsFastFoodCoupons,
      todayKidsFastFoodCoupons,
      todayAdultsMainFoodCoupons,
      todayKidsMainFoodCoupons,
      todayTotalFastFoodCoupons: todayFastFoodCoupons,
      todayTotalMainFoodCoupons: todayMainFoodCoupons,
      todayTotalFoodCoupons,
      totalAdultsFastFoodCoupons,
      totalKidsFastFoodCoupons,
      totalAdultsMainFoodCoupons,
      totalKidsMainFoodCoupons,
      totalFastFoodCoupons,
      totalMainFoodCoupons,
      totalFoodCoupons,
      
      // Performance metadata
      lastUpdated: new Date().toISOString(),
      dataFreshness: 'real-time',
      source: 'entries-data',
      syncStatus: 'synchronized'
    };
  };
  
  // Intelligent background sync with progressive loading and coordination
  const intelligentBackgroundSync = async (forceSync = false) => {
    const now = Date.now();
    
    // Prevent concurrent sync operations - this is key to fixing data flickering
    if (syncState.syncInProgress && !forceSync) {
      console.log('🔄 Dashboard: Sync already in progress, skipping...');
      return;
    }
    
    // Prevent excessive sync attempts
    if (!forceSync && syncState.isAutoSyncing && (now - syncState.lastSyncAttempt) < syncState.syncInterval) {
      console.log('🔄 Dashboard: Skipping sync - too recent');
      return;
    }
    
    // Check error count and implement exponential backoff
    if (syncState.errorCount >= 3 && !forceSync) {
      console.log('🔄 Dashboard: Too many errors, waiting before retry');
      return;
    }
    
    // Set sync in progress to prevent concurrent syncs
    setSyncState(prev => ({ 
      ...prev, 
      isAutoSyncing: true, 
      lastSyncAttempt: now,
      syncInProgress: true 
    }));
    
    try {
      console.log('🔄 Dashboard: Intelligent background sync...');
      setDataSyncStatus('syncing');
      
      // Progressive data loading - start with cached data, then fetch fresh
      const [entriesRes, chartsData] = await Promise.all([
        entriesApi.list({ page: 1, limit: 50000 }),
        entriesApi.todayCharts().catch(() => null) // Allow charts to fail gracefully
      ]);
      
      const entriesData = (entriesRes.data?.entries as any[]) ?? [];
      
      console.log('🔄 Dashboard: Fetched', entriesData.length, 'entries for intelligent sync');
      
      // Debug: Check if discount fields are present in the data
      if (entriesData.length > 0) {
        const sampleEntry = entriesData[0];
        console.log('🔍 Dashboard: Sample entry data:', {
          id: sampleEntry?._id,
          ticketType: sampleEntry?.ticketType,
          additionalDiscount: sampleEntry?.additionalDiscount,
          kidDiscount: sampleEntry?.kidDiscount,
          hasAdditionalDiscount: sampleEntry?.additionalDiscount !== undefined,
          hasKidDiscount: sampleEntry?.kidDiscount !== undefined,
          finalAmount: sampleEntry?.finalAmount,
          // Food coupons debug
          adultsFastFoodCoupon: sampleEntry?.adultsFastFoodCoupon,
          kidsFastFoodCoupon: sampleEntry?.kidsFastFoodCoupon,
          adultsMainFoodCoupon: sampleEntry?.adultsMainFoodCoupon,
          kidsMainFoodCoupon: sampleEntry?.kidsMainFoodCoupon,
          hasFoodCoupons: !!(sampleEntry?.adultsFastFoodCoupon || sampleEntry?.kidsFastFoodCoupon || sampleEntry?.adultsMainFoodCoupon || sampleEntry?.kidsMainFoodCoupon)
        });
        
        // Check for any entries with discounts
        const entriesWithDiscounts = entriesData.filter(entry => 
          (entry.additionalDiscount || 0) > 0 || (entry.kidDiscount || 0) > 0
        );
        console.log('🔍 Dashboard: Entries with discounts:', entriesWithDiscounts.length);
        
        // Check for entries with food coupons (using range parsing)
        const entriesWithFoodCoupons = entriesData.filter(entry => 
          countCouponsFromRange(entry.adultsFastFoodCoupon) > 0 || 
          countCouponsFromRange(entry.kidsFastFoodCoupon) > 0 || 
          countCouponsFromRange(entry.adultsMainFoodCoupon) > 0 || 
          countCouponsFromRange(entry.kidsMainFoodCoupon) > 0
        );
        console.log('🔍 Dashboard: Entries with food coupons:', entriesWithFoodCoupons.length);
        
        if (entriesWithFoodCoupons.length > 0) {
          console.log('🔍 Dashboard: First entry with food coupons:', {
            id: entriesWithFoodCoupons[0]._id,
            adultsFastFoodCoupon: entriesWithFoodCoupons[0].adultsFastFoodCoupon,
            kidsFastFoodCoupon: entriesWithFoodCoupons[0].kidsFastFoodCoupon,
            adultsMainFoodCoupon: entriesWithFoodCoupons[0].adultsMainFoodCoupon,
            kidsMainFoodCoupon: entriesWithFoodCoupons[0].kidsMainFoodCoupon
          });
        }
        
        if (entriesWithDiscounts.length > 0) {
          console.log('🔍 Dashboard: First discounted entry:', {
            id: entriesWithDiscounts[0]._id,
            additionalDiscount: entriesWithDiscounts[0].additionalDiscount,
            kidDiscount: entriesWithDiscounts[0].kidDiscount
          });
        }
      }
      
      // Only update if we have valid data to prevent flickering to zero
      if (entriesData.length >= 0) {
        // CRITICAL FIX: Use backend API stats instead of calculating from entries for food coupons
        // This ensures food coupons data is accurate since backend handles empty strings properly
        const fetchBackendStats = async () => {
          try {
            const backendStatsRes = await entriesApi.stats();
            const backendStats = backendStatsRes;
            
            console.log('🍔 Dashboard: Using backend API stats for food coupons:', {
              todayAdultsFastFoodCoupons: backendStats.todayAdultsFastFoodCoupons,
              todayKidsFastFoodCoupons: backendStats.todayKidsFastFoodCoupons,
              todayAdultsMainFoodCoupons: backendStats.todayAdultsMainFoodCoupons,
              todayKidsMainFoodCoupons: backendStats.todayKidsMainFoodCoupons,
              todayTotalFastFoodCoupons: backendStats.todayTotalFastFoodCoupons,
              todayTotalMainFoodCoupons: backendStats.todayTotalMainFoodCoupons,
              todayTotalFoodCoupons: backendStats.todayTotalFoodCoupons,
              totalFoodCoupons: backendStats.totalFoodCoupons
            });
            
            // Use backend stats for food coupons but keep calculated stats for other metrics
            const hybridStats = {
              ...calculateStatsFromEntries(entriesData),
              // Override food coupons with backend stats
              todayAdultsFastFoodCoupons: backendStats.todayAdultsFastFoodCoupons,
              todayKidsFastFoodCoupons: backendStats.todayKidsFastFoodCoupons,
              todayAdultsMainFoodCoupons: backendStats.todayAdultsMainFoodCoupons,
              todayKidsMainFoodCoupons: backendStats.todayKidsMainFoodCoupons,
              todayTotalFastFoodCoupons: backendStats.todayTotalFastFoodCoupons,
              todayTotalMainFoodCoupons: backendStats.todayTotalMainFoodCoupons,
              todayTotalFoodCoupons: backendStats.todayTotalFoodCoupons,
              totalAdultsFastFoodCoupons: backendStats.totalAdultsFastFoodCoupons,
              totalKidsFastFoodCoupons: backendStats.totalKidsFastFoodCoupons,
              totalAdultsMainFoodCoupons: backendStats.totalAdultsMainFoodCoupons,
              totalKidsMainFoodCoupons: backendStats.totalKidsMainFoodCoupons,
              totalFastFoodCoupons: backendStats.totalFastFoodCoupons,
              totalMainFoodCoupons: backendStats.totalMainFoodCoupons,
              totalFoodCoupons: backendStats.totalFoodCoupons
            };
            
            // Update performance metrics immediately
            const newPerformanceMetrics = {
              allTimeEntries: hybridStats.totalEntries,
              allTimeRevenue: hybridStats.totalAmount,
              todayEntries: hybridStats.todayEntries,
              todayRevenue: hybridStats.todayAmount,
              lastSyncTime: new Date().toISOString()
            };
            
            setPerformanceMetrics(newPerformanceMetrics);
            setStats(hybridStats);
            
          } catch (error) {
            console.error('❌ Dashboard: Failed to fetch backend stats, falling back to calculated stats:', error);
            // Fallback to calculated stats
            const calculatedStats = calculateStatsFromEntries(entriesData);
            setStats(calculatedStats);
          }
        };
        
        fetchBackendStats();
        
        // Update charts if available
        if (chartsData) {
          const allChartsData = await entriesApi.charts().catch(() => ({ monthly: [] }));
          const combinedCharts = {
            ...chartsData,
            monthly: allChartsData.monthly || []
          };
          setCharts(combinedCharts as unknown as Charts);
        }
        
        // Update recent entries
        const sortedEntries = entriesData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const finalEntries = sortedEntries.slice(0, 5);
        setRecentEntries(finalEntries);
        
        setDataSyncStatus('ready');
        setInitialLoadComplete(true);
        
        // Reset error count on success
        setSyncState(prev => ({ 
          ...prev, 
          errorCount: 0, 
          isAutoSyncing: false,
          syncInProgress: false 
        }));
        
        console.log('✅ Dashboard: Intelligent sync completed successfully');
        
        // Dispatch sync event
        window.dispatchEvent(new CustomEvent('dashboard-intelligent-sync', {
          detail: {
            timestamp: new Date().toISOString(),
            source: 'intelligent-background-sync',
            stats: stats,
            performanceMetrics: performanceMetrics,
            entriesCount: entriesData.length
          }
        }));
      }
      
    } catch (error) {
      console.error('❌ Dashboard: Intelligent sync failed:', error);
      setDataSyncStatus('error');
      
      // Increment error count and implement exponential backoff
      setSyncState(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1,
        isAutoSyncing: false,
        syncInProgress: false, // Reset on error
        syncInterval: Math.min(prev.syncInterval * 2, 300000) // Max 5 minutes
      }));
      
      // Don't show error to user - system will retry automatically
    }
  };

  // Professional loading component for performance metrics
  const PerformanceMetricCard = ({ title, value, subtitle, isLoading, icon, color }: {
    title: string;
    value: number | string;
    subtitle?: string;
    isLoading: boolean;
    icon: React.ReactNode;
    color: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{
        scale: 1.02,
        y: -5,
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)"
      }}
      className="group relative bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:border-gray-200 transition-all duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
            <p className="text-3xl font-bold text-gray-900">
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-gray-400">Loading...</span>
                </div>
              ) : (
                <span className={color}>
                  {typeof value === 'number' ? (
                    <AnimatedCounter value={value} />
                  ) : (
                    value
                  )}
                </span>
              )}
            </p>
          </div>
          <div className={`w-14 h-14 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center shadow-lg`}>
            {icon}
          </div>
        </div>
        {subtitle && (
          <div className="flex items-center text-sm text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">{subtitle}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
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
        console.log('Dashboard: Fetching data with intelligent sync...');
        
        // Use intelligent background sync for perfect data alignment
        await intelligentBackgroundSync(true);
        
        // Fetch ticket configs
        await fetchTicketConfigs();
        
        if (!cancelled) {
          setLoading(false);
          console.log('Dashboard: Data fetched and synchronized intelligently');
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
  
  // Automatic background sync with intelligent scheduling
  useEffect(() => {
    if (!syncState.backgroundSyncEnabled) return;
    
    const interval = setInterval(() => {
      intelligentBackgroundSync();
    }, syncState.syncInterval);
    
    return () => clearInterval(interval);
  }, [syncState.syncInterval, syncState.backgroundSyncEnabled]);
  
  // Simple date-wise sync listener
  useEffect(() => {
    const handleDateSync = async (event: any) => {
      console.log('📅 Dashboard: Received date sync event:', event.detail);
      await intelligentBackgroundSync(true); // Force sync on date events
    };
    
    // Specific handler for entry date/time updates
    const handleEntryDateTimeUpdated = async (event: any) => {
      console.log('📅 Dashboard: Entry date/time updated:', event.detail);
      await intelligentBackgroundSync(true); // Force refresh when date/time is updated
    };
    
    window.addEventListener('date-sync-complete', handleDateSync);
    window.addEventListener('entry-datetime-updated', handleEntryDateTimeUpdated);
    
    return () => {
      window.removeEventListener('date-sync-complete', handleDateSync);
      window.removeEventListener('entry-datetime-updated', handleEntryDateTimeUpdated);
    };
  }, []);

  // Enhanced real-time sync with comprehensive sync service integration
  useEffect(() => {
    let cancelled = false;
    
    // Enhanced comprehensive sync handler with coordination
    const handleComprehensiveSync = (event: any) => {
      if (!cancelled && !syncState.syncInProgress) {
        console.log('🔄 Dashboard: Comprehensive sync triggered:', event.detail);
        const fetchData = async () => {
          try {
            console.log('🔄 Dashboard: Fetching comprehensive sync data...');
            
            // Set sync in progress to prevent conflicts
            setSyncState(prev => ({ ...prev, syncInProgress: true }));
            
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
              const chartsData = await entriesApi.todayCharts();
              if (chartsData) {
                setCharts(chartsData as unknown as Charts);
              }
              
              // Log sync integrity
              console.log('✅ Dashboard: Comprehensive sync completed successfully');
              console.log('🔍 Dashboard: Data integrity:', (syncData.metadata as any)?.dataIntegrity || 'unknown');
              console.log('📊 Dashboard: Sync status:', syncData.metadata?.syncStatus);
              
              // Reset sync state
              setSyncState(prev => ({ ...prev, syncInProgress: false }));
              
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
            // Reset sync state on error
            setSyncState(prev => ({ ...prev, syncInProgress: false }));
            // Fallback to regular sync
            handleEntryUpdate();
          }
        };

        fetchData();
      }
    };
    
    const handleEntryUpdate = () => {
      if (!cancelled && !syncState.syncInProgress) {
        console.log('🔄 Dashboard: Entry update sync triggered...');
        // Use intelligent background sync for perfect data alignment
        intelligentBackgroundSync();
      } else {
        console.log('🔄 Dashboard: Skipping entry update - sync already in progress');
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

    // Listen for entries changes from AdminEntries page
    const handleEntriesChange = (event: any) => {
      console.log('🔄 Dashboard: Entries change detected:', event.detail);
      handleEntryUpdate();
    };
    
    window.addEventListener('entries-changed', handleEntriesChange);
    window.addEventListener('entry-created', handleEntriesChange);
    window.addEventListener('entry-updated', handleEntriesChange);
    window.addEventListener('entry-deleted', handleEntriesChange);
    
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
    
    // Add immediate sync listener for entry edits
    window.addEventListener('immediate-sync', immediateHandleEntryUpdate);
    
    // Add force refresh listener for complete data recalculation
    window.addEventListener('force-refresh-all-data', handleComprehensiveSync);
    
    // Add specific listener for date/time updates
    window.addEventListener('entry-datetime-updated', handleComprehensiveSync);
    
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
      window.removeEventListener('entries-changed', handleEntriesChange);
      window.removeEventListener('entry-created', handleEntriesChange);
      window.removeEventListener('entry-updated', handleEntriesChange);
      window.removeEventListener('entry-deleted', handleEntriesChange);
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
      window.removeEventListener('immediate-sync', immediateHandleEntryUpdate);
      window.removeEventListener('force-refresh-all-data', handleComprehensiveSync);
      window.removeEventListener('entry-datetime-updated', handleComprehensiveSync);
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
            entriesApi.todayCharts(),
            fetchTicketConfigs() // Ensure ticket configs are also refreshed
          ]);
          if (!cancelled) {
            console.log('📊 Dashboard: New stats - todayAdvance:', (s as any)?.todayAdvance, 'totalAdvance:', (s as any)?.totalAdvance);
            console.log('🍔 Dashboard: Food coupons - todayTotal:', (s as any)?.todayTotalFoodCoupons, 'totalFoodCoupons:', (s as any)?.totalFoodCoupons);
            const statsData = s; // API returns data directly
            setStats(statsData as unknown as Stats);
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
              entriesApi.todayCharts(),
              fetchTicketConfigs()
            ]);
            if (!cancelled) {
              const statsData = s; // API returns data directly
              setStats(statsData as unknown as Stats);
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
              const statsData = s; // API returns data directly
              setStats(statsData as unknown as Stats); // Proper casting for Stats interface
              setTicketConfigs(c); // c is TicketConfig[]
              setError(null);
              console.log('📊 Dashboard: Raw stats data after complete cache clear:', statsData);
              console.log('✅ Dashboard: Complete cache clear successful - today should be 0');
              
              // PROFESSIONAL FIX: Force reset API call if today stats not reset
              if ((s as any).todayEntries === 0 && ((s as any).today150 > 0 || (s as any).today200 > 0 || (s as any).today300 > 0 || (s as any).today450 > 0 || (s as any).today600 > 0 || (s as any).today100 > 0)) {
                console.log('🚨 PROFESSIONAL FIX: Today entries = 0 but ticket types > 0, forcing reset...');
                try {
                  const resetStats = await entriesApi.stats(true);
                  if (resetStats) {
                    console.log('✅ PROFESSIONAL FIX: Force reset successful, updating stats...');
                    const resetStatsData = resetStats; // API returns data directly
                    setStats(resetStatsData as unknown as Stats);
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

  const safeCharts = charts || { hourlyChart: [], ticketDistribution: [], hourlyComparison: [], monthly: [], summary: { totalEntries: 0, totalRevenue: 0, date: '', lastUpdated: '' } };

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

            {/* Intelligent Sync Status Indicator */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl border transition-all duration-300 ${
                dataSyncStatus === 'ready' 
                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' 
                  : dataSyncStatus === 'syncing'
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                  : dataSyncStatus === 'error'
                  ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200'
                  : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center">
                    {dataSyncStatus === 'syncing' && (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                    )}
                    {dataSyncStatus === 'ready' && (
                      <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {dataSyncStatus === 'error' && (
                      <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {dataSyncStatus === 'loading' && (
                      <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    <div className="text-sm">
                      <span className={`font-medium ${
                        dataSyncStatus === 'ready' ? 'text-green-800' :
                        dataSyncStatus === 'syncing' ? 'text-blue-800' :
                        dataSyncStatus === 'error' ? 'text-red-800' :
                        'text-gray-800'
                      }`}>
                        Status: <span className="font-bold">{
                          dataSyncStatus === 'ready' ? '✅ Auto-Syncing' :
                          dataSyncStatus === 'syncing' ? '🔄 Syncing...' :
                          dataSyncStatus === 'error' ? '❌ Error' :
                          '⏳ Loading...'
                        }</span>
                      </span>
                      {performanceMetrics.lastSyncTime && (
                        <span className="ml-4 text-gray-600">
                          Last Sync: <span className="font-bold">{dayjs(performanceMetrics.lastSyncTime).format('HH:mm:ss')}</span>
                        </span>
                      )}
                      {syncState.backgroundSyncEnabled && (
                        <span className="ml-4 text-green-600">
                          <span className="font-bold">🔄 Auto</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

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

            {/* Section Separator */}
            <div className="relative py-8 mb-8">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>
              <div className="relative flex justify-center">
                <div className="bg-white px-6 py-3 rounded-full shadow-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-gray-700">Daily Reset at Midnight</span>
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  </div>
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
                  {/* Comparison Card - Today vs All-Time */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.7, ease: "backOut" }}
                    whileHover={{
                      scale: 1.02,
                      y: -5,
                      boxShadow: "0 25px 50px rgba(59, 130, 246, 0.2)"
                    }}
                    className="group relative bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-8 shadow-2xl text-white lg:col-span-2"
                  >
                    <div className="absolute inset-0 bg-white/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <p className="text-lg font-bold text-blue-100 mb-2">📊 Revenue Comparison</p>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <p className="text-xs text-blue-200 mb-1">Today's Revenue</p>
                              <p className="text-3xl font-extrabold text-white">
                                ₹{!stats ? '0' : <AnimatedCounter value={stats.todayAmount ?? 0} />}
                              </p>
                              <p className="text-xs text-blue-200 mt-1">Resets daily at midnight</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-200 mb-1">All-Time Revenue</p>
                              <p className="text-3xl font-extrabold text-white">
                                ₹{!stats ? '0' : <AnimatedCounter value={stats.totalAmount ?? 0} />}
                              </p>
                              <p className="text-xs text-blue-200 mt-1">Preserved forever</p>
                            </div>
                          </div>
                        </div>
                        <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center shadow-lg">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm2-4h.01M17 19h.01" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex items-center text-sm text-blue-100">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span className="font-medium">Daily reset preserves all-time data</span>
                      </div>
                    </div>
                  </motion.div>

                {/* All Time Entries */}
                <PerformanceMetricCard
                  title="Total Entries"
                  value={performanceMetrics.allTimeEntries}
                  subtitle="All records"
                  isLoading={dataSyncStatus === 'loading' || dataSyncStatus === 'syncing'}
                  icon={
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  color="text-emerald-600"
                />

                {/* All Time Revenue */}
                <PerformanceMetricCard
                  title="All-Time Revenue"
                  value={`₹${performanceMetrics.allTimeRevenue}`}
                  subtitle="Preserved forever"
                  isLoading={dataSyncStatus === 'loading' || dataSyncStatus === 'syncing'}
                  icon={
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  color="text-blue-600"
                />

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

                {/* Professional Discount Analytics */}
                <DiscountAnalytics timeRange="30d" />
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
                <LineChart data={safeCharts.hourlyChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="_id" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${value} entries`, 'Count']} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#10b981" name="Entries" strokeWidth={2} />
                  <Line type="monotone" dataKey="amount" stroke="#f59e0b" name="Revenue" strokeWidth={2} />
                </LineChart>
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
                <LineChart data={safeCharts.hourlyChart}>
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
                <BarChart data={safeCharts.hourlyChart}>
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
