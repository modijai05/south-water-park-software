import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Extend dayjs with UTC plugin
dayjs.extend(utc);

// Storage key for last reset date
const LAST_RESET_KEY = 'south-water-park-last-reset';
const LAST_RESET_STATS_KEY = 'south-water-park-last-reset-stats';

export interface DailyResetStats {
  date: string;
  timestamp: string;
  resetCount: number;
}

/**
 * Check if a daily reset is needed based on the current date (LOCAL timezone)
 */
export const needsDailyReset = (): boolean => {
  const lastReset = localStorage.getItem(LAST_RESET_KEY);
  const today = dayjs().format('YYYY-MM-DD');
  
  console.log('🔄 Daily reset check (LOCAL):', { 
    lastReset, 
    today, 
    localTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    utcTime: dayjs().utc().format('YYYY-MM-DD HH:mm:ss'),
    needsReset: lastReset !== today 
  });
  
  if (!lastReset) {
    console.log('🔄 No previous reset found, reset needed');
    return true;
  }
  
  return lastReset !== today;
};

/**
 * Mark that a daily reset has been performed for today (LOCAL timezone)
 */
export const markDailyReset = (): void => {
  const today = dayjs().format('YYYY-MM-DD');
  const timestamp = dayjs().toISOString();
  
  console.log('🌅 Performing daily reset for LOCAL date:', today);
  
  // Store the reset date
  localStorage.setItem(LAST_RESET_KEY, today);
  
  // Update reset statistics
  const existingStats = getResetStats();
  const newStats: DailyResetStats = {
    date: today,
    timestamp,
    resetCount: (existingStats?.resetCount || 0) + 1
  };
  
  localStorage.setItem(LAST_RESET_STATS_KEY, JSON.stringify(newStats));
  
  console.log('✅ Daily reset marked:', newStats);
};

/**
 * Get the last reset statistics
 */
export const getResetStats = (): DailyResetStats | null => {
  try {
    const stats = localStorage.getItem(LAST_RESET_STATS_KEY);
    return stats ? JSON.parse(stats) : null;
  } catch (error) {
    console.error('❌ Error parsing reset stats:', error);
    return null;
  }
};

/**
 * Clear today's cached data from localStorage
 */
export const clearTodayCache = (): void => {
  const keysToRemove = [
    'entries-cache',
    'stats-cache', 
    'charts-cache',
    'analytics-cache',
    'today-analytics-cache',
    'ticket-configs-cache',
    'staff-stats-cache'
  ];
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('🧹 Cleared today\'s cache data');
};

/**
 * Perform a complete daily reset
 */
export const performDailyReset = (): void => {
  console.log('🌅 Performing daily reset for', dayjs().format('YYYY-MM-DD'));
  
  // Clear cached data
  clearTodayCache();
  
  // Mark the reset
  markDailyReset();
  
  // Dispatch custom event for components to listen to
  window.dispatchEvent(new CustomEvent('daily-reset', {
    detail: {
      date: dayjs().format('YYYY-MM-DD'),
      timestamp: dayjs().toISOString()
    }
  }));
  
  console.log('✅ Daily reset completed successfully');
};

/**
 * Hook to handle daily reset automatically
 */
export const useDailyReset = (callback?: () => void): (() => void) => {
  const checkAndReset = () => {
    if (needsDailyReset()) {
      performDailyReset();
      callback?.();
    }
  };
  
  // Check on mount
  checkAndReset();
  
  // Set up interval to check every minute
  const interval = setInterval(checkAndReset, 60000);
  
  // Return cleanup function
  return () => clearInterval(interval);
};

/**
 * Get time until next reset (midnight)
 */
export const getTimeUntilNextReset = (): { hours: number; minutes: number; seconds: number } => {
  const now = dayjs();
  const tomorrow = now.add(1, 'day').startOf('day');
  const diff = tomorrow.diff(now);
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
};
