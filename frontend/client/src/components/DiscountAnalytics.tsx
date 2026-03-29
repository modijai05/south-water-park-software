import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analyticsApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, AreaChart, Area
} from 'recharts';
import Logger from '@/lib/logger';

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
  }, [timeRange]);

  const fetchDiscountAnalytics = async () => {
    setLoading(true);
    try {
      const response = await analyticsApi.discounts(timeRange);
      setData(response);
      Logger.info('Discount analytics data loaded', response, 'DiscountAnalytics');
    } catch (error) {
      Logger.error('Failed to fetch discount analytics', error, 'DiscountAnalytics');
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
        <p className="text-gray-500">No discount data available</p>
      </div>
    );
  }

  const pieData = [
    { name: 'Additional Discounts', value: data.trends.discountTypes.additional.amount, color: '#3B82F6' },
    { name: 'Kid Discounts', value: data.trends.discountTypes.kid.amount, color: '#10B981' }
  ];

  const ticketTypeData = Object.entries(data.trends.ticketTypeDiscounts).map(([type, stats]) => ({
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
                ₹<AnimatedCounter value={data.summary.totalDiscountAmount} />
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {data.summary.entriesWithDiscounts} entries
              </p>
            </div>
            <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
              <span className="text-lg">💰</span>
            </div>
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
                {data.summary.discountRate.toFixed(1)}%
              </p>
              <p className="text-xs text-green-600 mt-1">
                of {data.summary.totalEntries} entries
              </p>
            </div>
            <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
              <span className="text-lg">📊</span>
            </div>
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
                ₹<AnimatedCounter value={Math.round(data.summary.averageDiscountPerEntry)} />
              </p>
              <p className="text-xs text-purple-600 mt-1">
                per entry
              </p>
            </div>
            <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
              <span className="text-lg">📈</span>
            </div>
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
              <p className="text-sm font-medium text-orange-600">Frequency</p>
              <p className="text-2xl font-bold text-orange-900 capitalize">
                {data.insights.discountFrequency}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                discount usage
              </p>
            </div>
            <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
              <span className="text-lg">🎯</span>
            </div>
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
            <AreaChart data={data.trends.dailyDiscounts}>
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
