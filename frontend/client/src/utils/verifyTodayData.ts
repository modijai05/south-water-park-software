// Verification utility to ensure today's data is showing correctly
import { entriesApi } from '@/lib/api';
import dayjs from 'dayjs';

// Type definitions for API responses
interface StatsData {
  todayEntries: number;
  totalEntries: number;
  todayPeople: number;
  totalPeople: number;
  todayAdults: number;
  totalAdults: number;
  todayKids: number;
  totalKids: number;
  todayAmount: number;
  totalAmount: number;
  todayCash: number;
  totalCash: number;
  todayUpi: number;
  totalUpi: number;
  todayAdvance: number;
  totalAdvance: number;
  lastUpdated?: string;
  dataFreshness?: string;
  source?: string;
  syncStatus?: string;
}

interface ChartsData {
  hourlyChart: { _id: string; count: number; amount: number }[];
  ticketDistribution: { _id: string; count: number; amount: number }[];
  hourlyComparison: { hour: string; entries: number; revenue: number }[];
  summary: {
    totalEntries: number;
    totalRevenue: number;
    date: string;
    lastUpdated: string;
  };
}

export const verifyTodayData = async () => {
  console.log('🔍 Verifying today\'s data is displaying correctly...');
  
  try {
    const today = dayjs().format('YYYY-MM-DD');
    console.log('📅 Today\'s date:', today);
    
    // Fetch today's data
    const [statsData, chartsData] = await Promise.all([
      entriesApi.stats(true),
      entriesApi.todayCharts()
    ]);
    
    console.log('📊 Stats data verification:', {
      todayEntries: (statsData as StatsData)?.todayEntries || 0,
      todayAmount: (statsData as StatsData)?.todayAmount || 0,
      todayPeople: (statsData as StatsData)?.todayPeople || 0,
      lastUpdated: (statsData as StatsData)?.lastUpdated
    });
    
    console.log('📈 Charts data verification:', {
      hourlyChartLength: chartsData?.hourlyChart?.length || 0,
      ticketDistributionLength: chartsData?.ticketDistribution?.length || 0,
      summaryDate: chartsData?.summary?.date,
      summaryEntries: chartsData?.summary?.totalEntries || 0,
      lastUpdated: chartsData?.summary?.lastUpdated
    });
    
    // Verify data consistency
    const issues = [];
    
    // Check if stats show today's data
    if (!(statsData as StatsData)?.todayEntries || (statsData as StatsData).todayEntries < 0) {
      issues.push('Stats todayEntries is missing or invalid');
    }
    
    // Check if charts show today's data
    if (!chartsData?.hourlyChart || chartsData.hourlyChart.length !== 24) {
      issues.push('Charts hourlyChart is missing or incomplete');
    }
    
    // Check if summary date matches today
    if (chartsData?.summary?.date !== today) {
      issues.push(`Summary date mismatch. Expected: ${today}, Got: ${chartsData?.summary?.date}`);
    }
    
    // Check if data is fresh (updated within last 5 minutes)
    const now = dayjs();
    const lastUpdated = dayjs((statsData as StatsData)?.lastUpdated || chartsData?.summary?.lastUpdated);
    const minutesSinceUpdate = now.diff(lastUpdated, 'minute');
    
    if (minutesSinceUpdate > 5) {
      issues.push(`Data is stale. Last updated ${minutesSinceUpdate} minutes ago`);
    }
    
    if (issues.length > 0) {
      console.error('❌ Verification issues found:', issues);
      return { success: false, issues, data: { statsData, chartsData } };
    }
    
    console.log('✅ Today\'s data verification passed!');
    console.log('🎯 All checks passed - data is showing today\'s date correctly');
    
    return { 
      success: true, 
      issues: [], 
      data: { statsData, chartsData },
      verification: {
        date: today,
        entries: (statsData as StatsData)?.todayEntries || 0,
        revenue: (statsData as StatsData)?.todayAmount || 0,
        lastUpdated: (statsData as StatsData)?.lastUpdated,
        freshness: `${minutesSinceUpdate} minutes ago`
      }
    };
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return { success: false, error: (error as Error).message };
  }
};

// Auto-verify on page load
export const autoVerify = () => {
  setTimeout(() => {
    console.log('🔄 Auto-verifying today\'s data...');
    verifyTodayData().then(result => {
      if (result.success) {
        console.log('✅ Auto-verification passed - today\'s data is correct');
      } else {
        console.error('❌ Auto-verification failed:', result.issues || result.error);
      }
    });
  }, 3000);
};

// Make available globally
declare global {
  interface Window {
    verifyTodayData: () => Promise<any>;
    autoVerify: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.verifyTodayData = verifyTodayData;
  window.autoVerify = autoVerify;
  
  // Auto-verify on load
  autoVerify();
}
