// System reset utility to ensure deployment changes take effect
import { performDailyReset, clearTodayCache } from './dailyReset';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

// Enable UTC plugin
dayjs.extend(utc);

export const triggerSystemReset = () => {
  console.log('🔄 Triggering system reset for deployment changes...');
  
  // Clear all caches to ensure fresh data
  clearTodayCache();
  
  // Perform daily reset to refresh today's data
  performDailyReset();
  
  // Clear localStorage caches
  const cacheKeys = [
    'entries-cache',
    'stats-cache', 
    'charts-cache',
    'analytics-cache',
    'today-analytics-cache',
    'ticket-configs-cache',
    'staff-stats-cache',
    'today-charts-cache'
  ];
  
  cacheKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🧹 Cleared cache: ${key}`);
  });
  
  // Dispatch reset events
  window.dispatchEvent(new CustomEvent('system-reset', {
    detail: {
      timestamp: new Date().toISOString(),
      reason: 'deployment-changes',
      cachesCleared: cacheKeys.length
    }
  }));
  
  console.log('✅ System reset completed successfully');
  console.log('🔄 Please refresh the page to see the changes');
  
  // Silent reset - no popup notifications
};

// Auto-trigger reset if needed (UTC-based)
export const checkAndTriggerReset = () => {
  const lastReset = localStorage.getItem('south-water-park-last-reset');
  const today = dayjs().utc().format('YYYY-MM-DD');
  
  console.log('🔄 System reset check (UTC):', {
    lastReset,
    today,
    localTime: dayjs().format('YYYY-MM-DD'),
    utcTime: dayjs().utc().format('YYYY-MM-DD')
  });
  
  if (lastReset !== today) {
    console.log('🔄 Auto-triggering system reset for new deployment...');
    triggerSystemReset();
    return true;
  }
  
  return false;
};

// Make available globally for manual reset
declare global {
  interface Window {
    triggerSystemReset: () => void;
    checkAndTriggerReset: () => boolean;
  }
}

if (typeof window !== 'undefined') {
  window.triggerSystemReset = triggerSystemReset;
  window.checkAndTriggerReset = checkAndTriggerReset;
  
  // Auto-check on load
  setTimeout(() => {
    checkAndTriggerReset();
  }, 1000);
}
