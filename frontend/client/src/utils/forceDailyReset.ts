// Force daily reset utility for manual intervention
import { performDailyReset, clearTodayCache, markDailyReset } from './dailyReset';
import { entriesApi } from '@/lib/api';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Enable UTC plugin
dayjs.extend(utc);

/**
 * Force a complete daily reset regardless of current state
 * This is used when the automatic reset fails or data is incorrect
 */
export const forceDailyResetComplete = async () => {
  console.log('🚨 FORCING COMPLETE DAILY RESET - Manual Intervention');
  
  try {
    const today = dayjs().utc().format('YYYY-MM-DD');
    const now = dayjs().utc().toISOString();
    
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
    
    // Step 2: Mark the reset for today
    console.log('📝 Step 2: Marking reset for today...');
    markDailyReset();
    
    // Step 3: Force fetch fresh data from backend
    console.log('🔄 Step 3: Force fetching fresh data...');
    
    // Force refresh stats with cache bypass
    const statsData = await entriesApi.stats(true);
    console.log('📊 Fresh stats data:', statsData);
    
    // Step 4: Verify the reset worked
    console.log('🔍 Step 4: Verifying reset worked...');
    
    const verification = {
      todayEntries: statsData?.todayEntries || 0,
      todayAmount: statsData?.todayAmount || 0,
      todayPeople: statsData?.todayPeople || 0,
      expectedDate: today,
      resetTimestamp: now,
      resetSuccess: (statsData?.todayEntries || 0) === 0
    };
    
    console.log('✅ Force reset verification:', verification);
    
    if (verification.resetSuccess) {
      console.log('🎉 SUCCESS: Daily reset completed - Today\'s data is now 0');
      
      // Dispatch success event
      window.dispatchEvent(new CustomEvent('force-daily-reset-success', {
        detail: verification
      }));
      
      return { success: true, verification };
    } else {
      console.error('❌ FAILURE: Daily reset did not work - Data still shows previous day');
      
      // Dispatch failure event
      window.dispatchEvent(new CustomEvent('force-daily-reset-failure', {
        detail: verification
      }));
      
      return { success: false, verification, error: 'Data still shows previous day entries' };
    }
    
  } catch (error) {
    console.error('❌ Force daily reset failed:', error);
    
    // Dispatch error event
    window.dispatchEvent(new CustomEvent('force-daily-reset-error', {
      detail: { error: error.message, timestamp: dayjs().utc().toISOString() }
    }));
    
    return { success: false, error: error.message };
  }
};

/**
 * Check if data is from previous day and needs force reset
 */
export const needsForceReset = (statsData: any): boolean => {
  if (!statsData) return false;
  
  const today = dayjs().utc().format('YYYY-MM-DD');
  const hasTodayEntries = (statsData.todayEntries || 0) > 0;
  const hasTodayAmount = (statsData.todayAmount || 0) > 0;
  const hasTodayPeople = (statsData.todayPeople || 0) > 0;
  
  // If there's data but it should be 0 (new day), we need force reset
  const needsReset = hasTodayEntries || hasTodayAmount || hasTodayPeople;
  
  console.log('🔍 Force reset check:', {
    today,
    hasTodayEntries,
    hasTodayAmount,
    hasTodayPeople,
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
