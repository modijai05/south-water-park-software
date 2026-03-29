// Force refresh utility to immediately update all data to today's date
import { entriesApi } from '@/lib/api';
import { performDailyReset, clearTodayCache } from './dailyReset';

export const forceRefreshToToday = async () => {
  console.log('🚀 Force refreshing all data to today\'s date...');
  
  try {
    // Clear ALL caches aggressively
    const allCacheKeys = [
      'entries-cache',
      'stats-cache', 
      'charts-cache',
      'today-charts-cache',
      'analytics-cache',
      'today-analytics-cache',
      'ticket-configs-cache',
      'staff-stats-cache',
      'sync-cache',
      'last-sync-timestamp',
      'dashboard-cache',
      'admin-cache',
      'performance-cache'
    ];
    
    allCacheKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🧹 Cleared cache: ${key}`);
    });
    
    // Clear session storage as well
    sessionStorage.clear();
    console.log('🧹 Cleared session storage');
    
    // Perform daily reset
    clearTodayCache();
    performDailyReset();
    
    // Force fetch fresh data from backend
    console.log('🔄 Force fetching fresh data...');
    
    const [statsData, chartsData] = await Promise.all([
      entriesApi.stats(true), // Force refresh
      entriesApi.todayCharts() // Get today's data only
    ]);
    
    console.log('📊 Fresh stats data:', statsData);
    console.log('📈 Fresh charts data:', chartsData);
    
    // Dispatch force refresh event
    window.dispatchEvent(new CustomEvent('force-refresh-to-today', {
      detail: {
        timestamp: new Date().toISOString(),
        stats: statsData,
        charts: chartsData,
        cachesCleared: allCacheKeys.length,
        reason: 'auto-force-refresh'
      }
    }));
    
    // Silent force refresh - no popup notifications
    console.log('✅ Force refresh completed successfully');
    
    return { success: true, stats: statsData, charts: chartsData };
    
  } catch (error) {
    console.error('❌ Force refresh failed:', error);
    
    // Silent error handling - no popup notifications
    return { success: false, error: error.message };
  }
};

// Manual force refresh with user notification (only called manually)
export const manualForceRefresh = async () => {
  console.log('🚀 Manual force refresh triggered by user...');
  
  try {
    const result = await forceRefreshToToday();
    
    if (result.success) {
      // Show success notification only for manual refresh
      if (typeof window !== 'undefined' && window.alert) {
        alert('✅ Manual refresh completed! All data is now showing today\'s date only.\n\nPlease refresh the page to see the updated data.');
      }
    } else {
      // Show error notification only for manual refresh
      if (typeof window !== 'undefined' && window.alert) {
        alert('❌ Manual refresh failed. Please refresh the page manually.\n\nError: ' + result.error);
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Manual refresh failed:', error);
    if (typeof window !== 'undefined' && window.alert) {
      alert('❌ Manual refresh failed. Please refresh the page manually.\n\nError: ' + error.message);
    }
    return { success: false, error: error.message };
  }
};

// Auto-check and force refresh if needed
export const checkAndForceRefresh = () => {
  const lastForceRefresh = localStorage.getItem('last-force-refresh-today');
  const today = new Date().toISOString().split('T')[0];
  
  console.log('🔍 Checking if force refresh is needed...');
  console.log('📅 Last force refresh:', lastForceRefresh);
  console.log('📅 Today:', today);
  
  if (lastForceRefresh !== today) {
    console.log('🚀 Auto-triggering force refresh for today...');
    forceRefreshToToday();
    localStorage.setItem('last-force-refresh-today', today);
    return true;
  }
  
  return false;
};

// Make available globally
declare global {
  interface Window {
    forceRefreshToToday: () => Promise<any>;
    manualForceRefresh: () => Promise<any>;
    checkAndForceRefresh: () => boolean;
  }
}

if (typeof window !== 'undefined') {
  window.forceRefreshToToday = forceRefreshToToday;
  window.manualForceRefresh = manualForceRefresh;
  window.checkAndForceRefresh = checkAndForceRefresh;
  
  // Auto-check on load
  setTimeout(() => {
    checkAndForceRefresh();
  }, 2000);
}
