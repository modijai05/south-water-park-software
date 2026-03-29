// System reset utility to ensure deployment changes take effect
import { performDailyReset, clearTodayCache } from './dailyReset';

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
  
  // Show user notification
  if (typeof window !== 'undefined' && window.alert) {
    alert('System reset completed! Please refresh the page to see the updated today\'s performance graphs.');
  }
};

// Auto-trigger reset if needed
export const checkAndTriggerReset = () => {
  const lastReset = localStorage.getItem('south-water-park-last-reset');
  const today = new Date().toISOString().split('T')[0];
  
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
