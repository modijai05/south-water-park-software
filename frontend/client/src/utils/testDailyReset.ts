// Test utility for daily reset functionality
import { performDailyReset, needsDailyReset, getResetStats } from './dailyReset';

export const testDailyReset = () => {
  console.log('🧪 Testing daily reset functionality...');
  
  // Check current state
  const needsReset = needsDailyReset();
  console.log('📅 Needs reset:', needsReset);
  
  const currentStats = getResetStats();
  console.log('📊 Current reset stats:', currentStats);
  
  // Perform manual reset for testing
  if (window.confirm('Do you want to perform a manual daily reset for testing?')) {
    performDailyReset();
    console.log('✅ Manual reset performed');
    
    // Check state after reset
    setTimeout(() => {
      const newStats = getResetStats();
      console.log('📊 New reset stats:', newStats);
    }, 1000);
  }
};

// Add to window for easy testing in browser console
declare global {
  interface Window {
    testDailyReset: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.testDailyReset = testDailyReset;
}
