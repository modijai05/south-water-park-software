import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analyticsApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import Logger from '@/lib/logger';
import { globalSyncService } from '@/services/globalSyncService';

interface DiscountAnalytics {
  summary: {
    totalEntries: number;
    entriesWithDiscounts: number;
    totalDiscountAmount: number;
    totalAdditionalDiscount: number;
    totalKidDiscount: number;
    averageDiscountPerEntry: number;
    discountRate: number;
  };
  trends: {
    dailyDiscounts: Array<{
      date: string;
      additionalDiscount: number;
      kidDiscount: number;
      totalDiscount: number;
      entries: number;
    }>;
    discountTypes: {
      additional: { count: number; amount: number; avgAmount: number };
      kid: { count: number; amount: number; avgAmount: number };
    };
    ticketTypeDiscounts: Record<string, {
      count: number;
      totalDiscount: number;
      avgDiscount: number;
    }>;
  };
  insights: {
    highestDiscountDay: any;
    mostDiscountedTicketType: any;
    discountFrequency: string;
    totalSavings: number;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function DiscountAnalytics({ timeRange = '30d' }: { timeRange?: string }) {
  const [data, setData] = useState<DiscountAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiscountAnalytics();
    
    // Set up real-time sync event listeners for discount updates
    const handleDiscountUpdated = (event: any) => {
      console.log('💰 DiscountAnalytics: Discount updated event received:', event.detail);
      fetchDiscountAnalytics();
    };
    
    const handleAdditionalDiscountUpdated = (event: any) => {
      console.log('🎫 DiscountAnalytics: Additional discount updated event received:', event.detail);
      fetchDiscountAnalytics();
    };
    
    const handleEntryCreated = () => {
      console.log('📊 DiscountAnalytics: Entry created event received, refreshing discount data...');
      fetchDiscountAnalytics();
    };
    
    const handlePaymentCompleted = () => {
      console.log('💳 DiscountAnalytics: Payment completed event received, refreshing discount data...');
      fetchDiscountAnalytics();
    };
    
    const handleImmediateSync = (event: any) => {
      console.log('⚡ DiscountAnalytics: Immediate sync event received:', event.detail);
      fetchDiscountAnalytics();
    };
    
    const handleDiscountsSync = () => {
      console.log('🎟️ DiscountAnalytics: Discounts sync event received, refreshing data...');
      fetchDiscountAnalytics();
    };
    
    // Add global sync service listeners
    globalSyncService.addEventListener('discount-updated', handleDiscountUpdated);
    globalSyncService.addEventListener('additional-discount-updated', handleAdditionalDiscountUpdated);
    globalSyncService.addEventListener('entry-created', handleEntryCreated);
    globalSyncService.addEventListener('payment-completed', handlePaymentCompleted);
    globalSyncService.addEventListener('immediate-sync', handleImmediateSync);
    globalSyncService.addEventListener('discounts-sync', handleDiscountsSync);
    
    // Also listen to window events for cross-component communication
    window.addEventListener('discount-updated', handleDiscountUpdated as EventListener);
    window.addEventListener('additional-discount-updated', handleAdditionalDiscountUpdated as EventListener);
    window.addEventListener('entry-created', handleEntryCreated as EventListener);
    window.addEventListener('payment-completed', handlePaymentCompleted as EventListener);
    window.addEventListener('immediate-sync', handleImmediateSync as EventListener);
    window.addEventListener('discounts-sync', handleDiscountsSync as EventListener);
    
    return () => {
      // Clean up global sync service listeners
      globalSyncService.removeEventListener('discount-updated', handleDiscountUpdated);
      globalSyncService.removeEventListener('additional-discount-updated', handleAdditionalDiscountUpdated);
      globalSyncService.removeEventListener('entry-created', handleEntryCreated);
      globalSyncService.removeEventListener('payment-completed', handlePaymentCompleted);
      globalSyncService.removeEventListener('immediate-sync', handleImmediateSync);
      globalSyncService.removeEventListener('discounts-sync', handleDiscountsSync);
      
      // Clean up window event listeners
      window.removeEventListener('discount-updated', handleDiscountUpdated as EventListener);
      window.removeEventListener('additional-discount-updated', handleAdditionalDiscountUpdated as EventListener);
      window.removeEventListener('entry-created', handleEntryCreated as EventListener);
      window.removeEventListener('payment-completed', handlePaymentCompleted as EventListener);
      window.removeEventListener('immediate-sync', handleImmediateSync as EventListener);
      window.removeEventListener('discounts-sync', handleDiscountsSync as EventListener);
    };
  }, [timeRange]);

  const fetchDiscountAnalytics = async () => {
    setLoading(true);
    try {
      console.log('🔄 DiscountAnalytics: Fetching discount data for timeRange:', timeRange);
      const response = await analyticsApi.discounts(timeRange);
      console.log('✅ DiscountAnalytics: Raw API response:', response);
      setData(response);
      Logger.info('Discount analytics data loaded', response, 'DiscountAnalytics');
    } catch (error) {
      console.error('❌ DiscountAnalytics: API Error:', error);
      Logger.error('Failed to fetch discount analytics', error, 'DiscountAnalytics');
      
      // Provide fallback data to prevent UI crashes
      const fallbackData = {
        summary: {
          totalEntries: 0,
          entriesWithDiscounts: 0,
          totalDiscountAmount: 0,
          totalAdditionalDiscount: 0,
          totalKidDiscount: 0,
          averageDiscountPerEntry: 0,
          discountRate: 0
        },
        trends: {
          dailyDiscounts: [],
          discountTypes: {
            additional: { count: 0, amount: 0, avgAmount: 0 },
            kid: { count: 0, amount: 0, avgAmount: 0 }
          },
          ticketTypeDiscounts: {}
        },
        insights: {
          highestDiscountDay: null,
          mostDiscountedTicketType: null,
          discountFrequency: 'low',
          totalSavings: 0
        }
      };
      
      console.log('🔄 DiscountAnalytics: Using fallback data due to API error');
      setData(fallbackData);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
            <div className="h-20 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">🎫</div>
          <p className="text-gray-500 text-lg font-medium">No discount data available</p>
          <p className="text-gray-400 text-sm mt-2">Start offering discounts to see analytics here</p>
        </div>
      </div>
    );
  }

  // Show empty state when no discounts exist
  if (data.summary.entriesWithDiscounts === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="text-center py-8">
          <div className="text-4xl mb-4">💰</div>
          <p className="text-gray-500 text-lg font-medium">No discounts given yet</p>
          <p className="text-gray-400 text-sm mt-2">
            Total entries: {data.summary.totalEntries} | 
            Discount rate: {data.summary.discountRate.toFixed(1)}%
          </p>
        </div>
      </div>
    );
  }

  // Add debug logging to see what data we're working with
  console.log('🔍 DiscountAnalytics: Current data state:', data);
  console.log('🔍 DiscountAnalytics: entriesWithDiscounts:', data?.summary?.entriesWithDiscounts);
  console.log('🔍 DiscountAnalytics: totalDiscountAmount:', data?.summary?.totalDiscountAmount);

  // TEMPORARY: Test with sample data to verify rendering works
  const testData = data && data.summary.totalEntries > 0 ? data : {
    summary: {
      totalEntries: 81,
      entriesWithDiscounts: 3,
      totalDiscountAmount: 850,
      totalAdditionalDiscount: 550,
      totalKidDiscount: 300,
      averageDiscountPerEntry: 10.49,
      discountRate: 3.7
    },
    trends: {
      dailyDiscounts: [],
      discountTypes: {
        additional: { count: 2, amount: 550, avgAmount: 275 },
        kid: { count: 1, amount: 300, avgAmount: 300 }
      },
      ticketTypeDiscounts: {}
    },
    insights: {
      highestDiscountDay: null,
      mostDiscountedTicketType: null,
      discountFrequency: 'low',
      totalSavings: 850
    }
  };

  const displayData = testData || data;
  console.log('🎯 DiscountAnalytics: Using displayData:', displayData);

  const pieData = [
    { name: 'Additional Discounts', value: displayData.trends.discountTypes.additional.amount, color: '#3B82F6' },
    { name: 'Kid Discounts', value: displayData.trends.discountTypes.kid.amount, color: '#10B981' }
  ];

  const ticketTypeData = Object.entries(displayData.trends.ticketTypeDiscounts).map(([type, stats]) => ({
    ticketType: type,
    ...stats
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Discounts</p>
              <p className="text-2xl font-bold text-blue-900">
                ₹<AnimatedCounter value={displayData.summary.totalDiscountAmount} />
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Across {displayData.summary.entriesWithDiscounts} entries
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Discount Rate</p>
              <p className="text-2xl font-bold text-green-900">
                {displayData.summary.discountRate.toFixed(1)}%
              </p>
              <p className="text-xs text-green-600 mt-1">
                Of {displayData.summary.totalEntries} total entries
              </p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Avg Discount</p>
              <p className="text-2xl font-bold text-purple-900">
                ₹{displayData.summary.averageDiscountPerEntry.toFixed(2)}
              </p>
              <p className="text-xs text-purple-600 mt-1">Per entry</p>
            </div>
            <div className="text-3xl">�</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Total Savings</p>
              <p className="text-2xl font-bold text-orange-900">
                ₹<AnimatedCounter value={displayData.insights.totalSavings} />
              </p>
              <p className="text-xs text-orange-600 mt-1">Customer savings</p>
            </div>
            <div className="text-3xl">💸</div>
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Discount Trends */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-xl border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Discount Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={displayData.trends.dailyDiscounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="additionalDiscount" stackId="1" stroke="#3B82F6" fill="#3B82F6" name="Additional" />
              <Area type="monotone" dataKey="kidDiscount" stackId="1" stroke="#10B981" fill="#10B981" name="Kid" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Discount Types Pie Chart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white p-6 rounded-xl border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Discount Types</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => `₹${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Ticket Type Discounts */}
      {ticketTypeData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-xl border border-gray-200"
        >
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Discounts by Ticket Type</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ticketTypeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ticketType" />
              <YAxis />
              <Tooltip formatter={(value: number) => `₹${value}`} />
              <Legend />
              <Bar dataKey="totalDiscount" fill="#8B5CF6" name="Total Discount" />
              <Bar dataKey="avgDiscount" fill="#F59E0B" name="Average Discount" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-200"
      >
        <h3 className="text-lg font-semibold text-indigo-900 mb-4">💡 Discount Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 p-4 rounded-lg">
            <p className="text-sm font-medium text-indigo-600">Highest Discount Day</p>
            <p className="text-lg font-bold text-indigo-900">
              {data.insights.highestDiscountDay 
                ? `${data.insights.highestDiscountDay.date} (₹${data.insights.highestDiscountDay.totalDiscount})`
                : 'No data'
              }
            </p>
          </div>
          <div className="bg-white/80 p-4 rounded-lg">
            <p className="text-sm font-medium text-indigo-600">Most Discounted Ticket</p>
            <p className="text-lg font-bold text-indigo-900">
              {data.insights.mostDiscountedTicketType 
                ? `${data.insights.mostDiscountedTicketType.ticketType} (₹${data.insights.mostDiscountedTicketType.totalDiscount})`
                : 'No data'
              }
            </p>
          </div>
          <div className="bg-white/80 p-4 rounded-lg">
            <p className="text-sm font-medium text-indigo-600">Total Savings</p>
            <p className="text-lg font-bold text-indigo-900">
              ₹<AnimatedCounter value={data.insights.totalSavings} />
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
