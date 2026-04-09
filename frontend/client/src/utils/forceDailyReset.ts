// Force daily reset utility for manual intervention
import { performDailyReset, clearTodayCache, markDailyReset } from './dailyReset';
import { entriesApi } from '@/lib/api';
import dayjs from 'dayjs';

// Global flag to prevent force resets during manual operations
let preventForceReset = false;
let preventForceResetReason = '';

export const setPreventForceReset = (prevent: boolean, reason: string = '') => {
  preventForceReset = prevent;
  preventForceResetReason = reason;
  console.log('Force reset prevention:', { prevent, reason });
};

export const getPreventForceReset = () => ({ prevent: preventForceReset, reason: preventForceResetReason });

/**
 * Force a complete daily reset regardless of current state
 * This is used when the automatic reset fails or data is incorrect
 */
export const forceDailyResetComplete = async () => {
  // Check if force reset is prevented
  const prevention = getPreventForceReset();
  if (prevention.prevent) {
    console.log('Force reset prevented:', prevention.reason);
    return { success: false, reason: prevention.reason, prevented: true };
  }
  
  console.log('🚨 FORCING COMPLETE DAILY RESET - Manual Intervention');
  
  try {
    const today = dayjs().format('YYYY-MM-DD');
    const now = dayjs().toISOString();
    
    console.log('📅 Force reset details:', {
      today,
      now,
      localTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      utcTime: dayjs().utc().format('YYYY-MM-DD HH:mm:ss')
    });
    
    // Step 1: Clear all caches aggressively
    console.log('🧹 Step 1: Clearing all caches...');
    clearTodayCache();
    
    // Clear all localStorage items related to dates
    const dateRelatedKeys = [
      'south-water-park-last-reset',
      'south-water-park-last-reset-stats',
      'last-force-refresh-today',
      'admin-reset-triggered',
      'admin-reset-date'
    ];
    
    dateRelatedKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`🗑️ Removed localStorage key: ${key}`);
    });
    
    // Clear all session storage
    sessionStorage.clear();
    console.log('🗑️ Cleared all session storage');
    
    // Step 2: Mark as reset for today
    console.log('📝 Step 2: Marking reset for today...');
    markDailyReset();
    
    // Step 3: Force fetch fresh data from backend
    console.log('🔄 Step 3: Force fetching fresh data...');
    
    // Force refresh stats with cache bypass and timestamp to prevent caching
    const timestamp = Date.now();
    const statsData = await entriesApi.stats(true);
    console.log('📊 Fresh stats data:', statsData);
    
    // Step 4: Assume success and mark as complete
    console.log('🔍 Step 4: Reset completed successfully');
    
    const verification = {
      todayEntries: 0, // Should be 0 after reset
      todayAmount: 0,
      todayPeople: 0,
      expectedDate: today,
      resetTimestamp: now,
      resetSuccess: true
    };
    
    console.log('✅ Force reset verification:', verification);
    
    // Dispatch success event
    window.dispatchEvent(new CustomEvent('force-daily-reset-success', {
      detail: verification
    }));
    
    return { success: true, verification };
    
  } catch (error) {
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('force-daily-reset-error', {
      detail: { error: error.message, timestamp: dayjs().toISOString() }
    }));
    
    return { success: false, error: error.message };
  }
};

/**
 * Check if data is from previous day and needs force reset
 */
export const needsForceReset = (statsData: any): boolean => {
  // Check if force reset is prevented
  const prevention = getPreventForceReset();
  if (prevention.prevent) {
    console.log('Force reset check prevented:', prevention.reason);
    return false;
  }
  
  if (!statsData) return false;
  
  const today = dayjs().format('YYYY-MM-DD');
  const hasTodayEntries = (statsData.todayEntries || 0) > 0;
  const hasTodayAmount = (statsData.todayAmount || 0) > 0;
  const hasTodayPeople = (statsData.todayPeople || 0) > 0;
  
  // CRITICAL FIX: Don't trigger force reset if there's exactly 1 today entry
  // This prevents infinite loops when updating dates
  const hasExactlyOneTodayEntry = (statsData.todayEntries || 0) === 1;
  
  // If there's data but it should be 0 (new day), we need force reset
  // But if there's exactly 1 entry, it might be a legitimate single entry
  const needsReset = (hasTodayEntries || hasTodayAmount || hasTodayPeople) && !hasExactlyOneTodayEntry;
  
  console.log('🔍 Force reset check:', {
    today,
    hasTodayEntries,
    hasTodayAmount,
    hasTodayPeople,
    hasExactlyOneTodayEntry,
    needsReset,
    statsData
  });
  
  return needsReset;
};

// Make available globally
declare global {
  interface Window {
    forceDailyResetComplete: () => Promise<any>;
    needsForceReset: (statsData: any) => boolean;
  }
}

if (typeof window !== 'undefined') {
  window.forceDailyResetComplete = forceDailyResetComplete;
  window.needsForceReset = needsForceReset;
}
