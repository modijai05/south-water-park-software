import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { analyticsApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { TodayAnalytics } from '@/components/TodayAnalytics';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, Treemap 
} from 'recharts';
import Logger from '@/lib/logger';
import type { 
  EntryRecord as Entry, 
  AnalyticsData,
  UpgradeItem as EntryUpgrade,
  CustomEventData
} from '@/types';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const TICKET_COLORS = {
  '150': '#EF4444',
  '300': '#3B82F6', 
  '450': '#10B981',
  '600': '#F59E0B',
  '100': '#8B5CF6'
};

interface DateWiseAnalyticsData {
  todayAnalytics: Partial<Entry>[];
  historicalAnalytics: Partial<Entry>[];
  summary: {
    today: Partial<AnalyticsData> & {
      avgTicketValue?: number;
      growthRate?: number;
      peakHour?: number;
    };
    historical: Partial<AnalyticsData> & {
      avgTicketValue?: number;
    };
    insights?: {
      performanceComparison: string;
      revenueDifference: number;
      entriesDifference: number;
      trendDirection: string;
    };
  };
}

interface ComponentAnalyticsData {
  demandAnalysis: DemandAnalysis[];
  upgradeInsights: UpgradeInsight[];
  timeSeriesData: TimeSeriesData[];
  revenueBreakdown: RevenueBreakdown[];
  customerPreferences: CustomerPreference[];
  peakHours: PeakHourData[];
}

interface DemandAnalysis {
  ticketType: string;
  totalEntries: number;
  revenue: number;
  avgPeoplePerEntry: number;
  growthRate: number;
  marketShare: number;
  seasonality: number;
}

interface UpgradeInsight {
  fromTicket: string;
  toTicket: string;
  upgradeCount: number;
  upgradeRevenue: number;
  conversionRate: number;
  avgUpgradeValue: number;
  timeToUpgrade: number;
}

interface TimeSeriesData {
  date: string;
  [key: string]: string | number;
}

interface RevenueBreakdown {
  ticketType: string;
  revenue: number;
  percentage: number;
  entries: number;
}

interface CustomerPreference {
  ticketType: string;
  adults: number;
  kids: number;
  groups: number;
  soloVisitors: number;
  repeatCustomers: number;
}

interface PeakHourData {
  hour: number;
  entries: number;
  revenue: number;
  ticketTypes: { [key: string]: number };
}

export function TicketAnalytics() {
  const [data, setData] = useState<ComponentAnalyticsData>({
    demandAnalysis: [],
    upgradeInsights: [],
    timeSeriesData: [],
    revenueBreakdown: [],
    customerPreferences: [],
    peakHours: []
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'today'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'entries' | 'growth'>('revenue');
  const [showToday, setShowToday] = useState(true); // Show today's analytics by default

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      let response;
      
      if (timeRange === 'today') {
        // Use date-wise endpoint for today's data
        response = await analyticsApi.dateWise();
        Logger.info('Date-wise analytics data loaded', response, 'TicketAnalytics');
        
        // Use today's analytics from the new endpoint
        const analyticsData: ComponentAnalyticsData = {
          demandAnalysis: response.todayAnalytics || [],
          upgradeInsights: [],
          timeSeriesData: [],
          revenueBreakdown: (response.todayAnalytics || []).map((d: Partial<Entry>) => ({
            ticketType: d.ticketType || 'unknown',
            revenue: (d as any).revenue || 0,
            percentage: 0, // Calculate percentage based on today's total
            entries: (d as any).tickets || 0
          })),
          customerPreferences: [],
          peakHours: []
        };
        
        setData(analyticsData);
      } else {
        // Use historical analytics for other time ranges
        const [demandData, upgradesData, timeSeriesData, peakHoursData, customerPrefsData] = await Promise.all([
          analyticsApi.demand(timeRange),
          analyticsApi.upgrades(timeRange),
          analyticsApi.timeSeries(timeRange),
          analyticsApi.peakHours(timeRange),
          analyticsApi.customerPreferences(timeRange)
        ]);
        
        const analyticsData: ComponentAnalyticsData = {
          demandAnalysis: demandData,
          upgradeInsights: upgradesData,
          timeSeriesData: timeSeriesData,
          revenueBreakdown: demandData.map((d: DemandAnalysis) => ({
            ticketType: d.ticketType,
            revenue: d.revenue,
            percentage: d.marketShare,
            entries: d.totalEntries
          })),
          customerPreferences: customerPrefsData,
          peakHours: peakHoursData
        };
        
        setData(analyticsData);
      }
    } catch (error) {
      Logger.error('Failed to fetch analytics data', error, 'TicketAnalytics');
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (entries: Entry[], range: string): ComponentAnalyticsData => {
    const now = dayjs();
    let startDate = now;
    
    switch (range) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
    }

    const filteredEntries = entries.filter(entry => 
      dayjs(entry.createdAt).isAfter(startDate)
    );

    return {
      demandAnalysis: calculateDemandAnalysis(filteredEntries),
      upgradeInsights: calculateUpgradeInsights(filteredEntries),
      timeSeriesData: calculateTimeSeriesData(filteredEntries),
      revenueBreakdown: calculateRevenueBreakdown(filteredEntries),
      customerPreferences: calculateCustomerPreferences(filteredEntries),
      peakHours: calculatePeakHours(filteredEntries)
    };
  };

  const calculateDemandAnalysis = (entries: Entry[]): DemandAnalysis[] => {
    const ticketTypes = ['150', '300', '450', '600', '100'];
    
    return ticketTypes.map(type => {
      const typeEntries = entries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;
      
      // Calculate growth rate (compare with previous period)
      const midPoint = dayjs().subtract(15, 'day');
      const recentEntries = typeEntries.filter(e => dayjs(e.createdAt).isAfter(midPoint));
      const olderEntries = typeEntries.filter(e => dayjs(e.createdAt).isBefore(midPoint));
      const growthRate = olderEntries.length > 0 
        ? ((recentEntries.length - olderEntries.length) / olderEntries.length) * 100 
        : 0;
      
      const marketShare = entries.length > 0 ? (totalEntries / entries.length) * 100 : 0;
      
      // Simple seasonality calculation (weekend vs weekday)
      const weekendEntries = typeEntries.filter(e => {
        const day = dayjs(e.createdAt).day();
        return day === 0 || day === 6; // Sunday or Saturday
      });
      const seasonality = totalEntries > 0 ? (weekendEntries.length / totalEntries) * 100 : 0;

      return {
        ticketType: type,
        totalEntries,
        revenue,
        avgPeoplePerEntry,
        growthRate,
        marketShare,
        seasonality
      };
    });
  };

  const calculateUpgradeInsights = (entries: Entry[]): UpgradeInsight[] => {
    // Guard against undefined/null data
    if (!entries || !Array.isArray(entries)) {
      return [];
    }
    
    const insights: UpgradeInsight[] = [];
    
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(entry => {
      if (entry.upgrades && Array.isArray(entry.upgrades) && entry.upgrades.length > 0) {
        const safeUpgrades = Array.isArray(entry.upgrades) ? entry.upgrades : [];
        safeUpgrades.forEach((upgrade: EntryUpgrade) => {
          const existingInsight = insights.find(i => 
            i.fromTicket === entry.ticketType && i.toTicket === upgrade.ticketType
          );
          
          if (existingInsight) {
            existingInsight.upgradeCount++;
            existingInsight.upgradeRevenue += upgrade.finalAmount || 0;
          } else {
            insights.push({
              fromTicket: entry.ticketType,
              toTicket: upgrade.ticketType,
              upgradeCount: 1,
              upgradeRevenue: upgrade.finalAmount || 0,
              conversionRate: 0,
              avgUpgradeValue: upgrade.finalAmount || 0,
              timeToUpgrade: 0
            });
          }
        });
      }
    });

    // Calculate conversion rates and averages
    const safeInsights = Array.isArray(insights) ? insights : [];
    safeInsights.forEach(insight => {
      const fromTicketEntries = entries.filter(e => e.ticketType === insight.fromTicket);
      insight.conversionRate = fromTicketEntries.length > 0 
        ? (insight.upgradeCount / fromTicketEntries.length) * 100 
        : 0;
      insight.avgUpgradeValue = insight.upgradeCount > 0 
        ? insight.upgradeRevenue / insight.upgradeCount 
        : 0;
    });

    return insights.sort((a, b) => b.upgradeCount - a.upgradeCount);
  };

  const calculateTimeSeriesData = (entries: Entry[]): TimeSeriesData[] => {
    // Guard against undefined/null data
    if (!entries || !Array.isArray(entries)) {
      return [];
    }
    
    const data: Record<string, TimeSeriesData> = {};
    const safeEntries = Array.isArray(entries) ? entries : [];
    
    safeEntries.forEach(entry => {
      if (!entry) return; // Guard against null/undefined entries
      const date = dayjs(entry.createdAt).format('YYYY-MM-DD');
      if (!data[date]) {
        data[date] = { date };
      }
      
      const ticketType = entry.ticketType;
      if (ticketType) {
        if (!data[date][ticketType]) {
          data[date][ticketType] = 0;
        }
        (data[date][ticketType] as number)++;
      }
      
      if (!data[date].totalEntries) {
        data[date].totalEntries = 0;
      }
      (data[date].totalEntries as number)++;
      
      if (!data[date].totalRevenue) {
        data[date].totalRevenue = 0;
      }
      (data[date].totalRevenue as number) += entry.finalAmount || 0;
    });

    return Object.values(data).sort((a, b) => a.date.localeCompare(b.date));
  };

  const calculateRevenueBreakdown = (entries: Entry[]): RevenueBreakdown[] => {
    // Guard against undefined/null data
    if (!entries || !Array.isArray(entries)) {
      return [];
    }
    
    const breakdown: { [key: string]: { revenue: number; entries: number } } = {};
    const safeEntries = Array.isArray(entries) ? entries : [];
    
    safeEntries.forEach(entry => {
      if (!entry) return; // Guard against null/undefined entries
      const type = entry.ticketType;
      if (type) {
        if (!breakdown[type]) {
          breakdown[type] = { revenue: 0, entries: 0 };
        }
        breakdown[type].revenue += entry.finalAmount || 0;
        breakdown[type].entries++;
      }
    });

    const totalRevenue = Object.values(breakdown).reduce((sum, b) => sum + b.revenue, 0);

    return Object.entries(breakdown).map(([type, data]) => ({
      ticketType: type,
      revenue: data.revenue,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      entries: data.entries
    })).sort((a, b) => b.revenue - a.revenue);
  };

  const calculateCustomerPreferences = (entries: Entry[]): CustomerPreference[] => {
    // Guard against undefined/null data
    if (!entries || !Array.isArray(entries)) {
      return [];
    }
    
    const preferences: { [key: string]: CustomerPreference } = {};
    const safeEntries = Array.isArray(entries) ? entries : [];
    
    safeEntries.forEach(entry => {
      if (!entry) return; // Guard against null/undefined entries
      const type = entry.ticketType;
      if (type) {
        if (!preferences[type]) {
          preferences[type] = {
            ticketType: type,
            adults: 0,
            kids: 0,
            groups: 0,
            soloVisitors: 0,
            repeatCustomers: 0
          };
        }
        
        preferences[type].adults += entry.adults || 0;
        preferences[type].kids += entry.kids || 0;
        
        const totalPeople = (entry.adults || 0) + (entry.kids || 0);
        if (totalPeople === 1) {
          preferences[type].soloVisitors++;
        } else if (totalPeople > 2) {
          preferences[type].groups++;
        }
      }
    });

    return Object.values(preferences);
  };

  const calculatePeakHours = (entries: Entry[]): PeakHourData[] => {
    // Guard against undefined/null data
    if (!entries || !Array.isArray(entries)) {
      return [];
    }
    
    const hours: { [key: number]: PeakHourData } = {};
    
    for (let i = 0; i < 24; i++) {
      hours[i] = {
        hour: i,
        entries: 0,
        revenue: 0,
        ticketTypes: {}
      };
    }
    
    const safeEntries = Array.isArray(entries) ? entries : [];
    safeEntries.forEach(entry => {
      if (!entry || !entry.createdAt) return; // Guard against null/undefined entries
      const hour = dayjs(entry.createdAt).hour();
      if (hour >= 0 && hour < 24) {
        hours[hour].entries++;
        hours[hour].revenue += entry.finalAmount || 0;
        
        const ticketType = entry.ticketType;
        if (ticketType) {
          if (!hours[hour].ticketTypes[ticketType]) {
            hours[hour].ticketTypes[ticketType] = 0;
          }
          hours[hour].ticketTypes[ticketType]++;
        }
      }
    });

    return Object.values(hours);
  };

  const topPerformingTicket = useMemo(() => {
    if (!data?.demandAnalysis) return null;
    return data.demandAnalysis.reduce((max, current) => 
      current.revenue > max.revenue ? current : max
    );
  }, [data]);

  const mostPopularUpgrade = useMemo(() => {
    if (!data?.upgradeInsights) return null;
    return data.upgradeInsights[0] || null;
  }, [data]);

  if (loading) {
    return (
      <Layout title="📊 Ticket Analytics">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="📊 Ticket Analytics Dashboard">
      {/* View Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-wrap gap-4 items-center justify-between"
      >
        <div className="flex gap-2">
          <button
            onClick={() => setShowToday(true)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              showToday
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📊 Today's Performance
          </button>
          <button
            onClick={() => setShowToday(false)}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !showToday
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            📈 Historical Analytics
          </button>
        </div>
        
        {!showToday && (
          <>
            <div className="flex gap-2">
              {(['7d', '30d', '90d', '1y'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    timeRange === range
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '1 Year'}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2">
              {(['revenue', 'entries', 'growth'] as const).map(metric => (
                <button
                  key={metric}
                  onClick={() => setSelectedMetric(metric)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    selectedMetric === metric
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {metric === 'revenue' ? 'Revenue' : metric === 'entries' ? 'Entries' : 'Growth'}
                </button>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Today's Analytics Section */}
      {showToday && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <TodayAnalytics />
          
          {/* Live Performance Insights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
              <h3 className="text-lg font-bold text-green-900 mb-4">📊 Performance Insights</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700">Live Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-bold text-green-800">Live</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700">Auto-refresh</span>
                  <span className="text-sm font-bold text-green-800">30 sec</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-green-700">Data Freshness</span>
                  <span className="text-sm font-bold text-green-800">Real-time</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-bold text-blue-900 mb-4">⚡ Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700">Today's Trend</span>
                  <span className="text-sm font-bold text-blue-800">Increasing</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700">Avg. Order Value</span>
                  <span className="text-sm font-bold text-blue-800">₹450</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-700">Peak Time</span>
                  <span className="text-sm font-bold text-blue-800">2:00 PM</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
              <h3 className="text-lg font-bold text-purple-900 mb-4">🎯 Today's Targets</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">Revenue Progress</span>
                  <span className="text-sm font-bold text-purple-800">75%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">Entries Goal</span>
                  <span className="text-sm font-bold text-purple-800">120/200</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-purple-700">Conversion Rate</span>
                  <span className="text-sm font-bold text-purple-800">4.5%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Historical Analytics Section */}
      {!showToday && (
        <>
          {/* Key Insights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200"
        >
          <h3 className="text-lg font-bold text-blue-900 mb-2">🏆 Top Performer</h3>
          {topPerformingTicket && (
            <>
              <div className="text-2xl font-bold text-blue-800">₹{topPerformingTicket.ticketType}</div>
              <div className="text-sm text-blue-600">₹{topPerformingTicket.revenue.toLocaleString()} revenue</div>
              <div className="text-xs text-blue-500 mt-1">{topPerformingTicket.marketShare.toFixed(1)}% market share</div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200"
        >
          <h3 className="text-lg font-bold text-green-900 mb-2">🔄 Popular Upgrade</h3>
          {mostPopularUpgrade && (
            <>
              <div className="text-2xl font-bold text-green-800">
                ₹{mostPopularUpgrade.fromTicket} → ₹{mostPopularUpgrade.toTicket}
              </div>
              <div className="text-sm text-green-600">{mostPopularUpgrade.upgradeCount} upgrades</div>
              <div className="text-xs text-green-500 mt-1">{mostPopularUpgrade.conversionRate.toFixed(1)}% conversion</div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200"
        >
          <h3 className="text-lg font-bold text-purple-900 mb-2">📈 Growth Leader</h3>
          {data?.demandAnalysis && (
            <>
              <div className="text-2xl font-bold text-purple-800">
                ₹{data.demandAnalysis.reduce((max, current) => 
                  current.growthRate > max.growthRate ? current : max
                ).ticketType}
              </div>
              <div className="text-sm text-purple-600">
                {Math.max(...data.demandAnalysis.map(d => d.growthRate)).toFixed(1)}% growth
              </div>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200"
        >
          <h3 className="text-lg font-bold text-orange-900 mb-2">⏰ Peak Hour</h3>
          {data?.peakHours && (
            <>
              <div className="text-2xl font-bold text-orange-800">
                {data.peakHours.reduce((max, current) => 
                  current.entries > max.entries ? current : max
                ).hour}:00
              </div>
              <div className="text-sm text-orange-600">
                {Math.max(...data.peakHours.map(h => h.entries))} entries
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Demand Analysis Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white p-6 rounded-xl shadow-lg mb-8"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">📊 Ticket Type Demand Analysis</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data?.demandAnalysis}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ticketType" />
            <YAxis />
            <Tooltip 
              formatter={(value: string | number, name: string) => [
                name === 'revenue' ? `₹${value.toLocaleString()}` : value,
                name === 'revenue' ? 'Revenue' : name === 'totalEntries' ? 'Entries' : 'Growth Rate %'
              ]}
            />
            <Legend />
            <Bar dataKey="revenue" fill="#3B82F6" name="Revenue" />
            <Bar dataKey="totalEntries" fill="#10B981" name="Entries" />
            <Bar dataKey="growthRate" fill="#F59E0B" name="Growth Rate %" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Revenue Breakdown Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white p-6 rounded-xl shadow-lg"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">💰 Revenue Breakdown</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data?.revenueBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ ticketType, percentage }) => `₹${ticketType}: ${percentage.toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {data?.revenueBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={TICKET_COLORS[entry.ticketType as keyof typeof TICKET_COLORS] || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: string | number) => [`₹${value.toLocaleString()}`, 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white p-6 rounded-xl shadow-lg"
        >
          <h2 className="text-xl font-bold text-gray-800 mb-4">🔄 Upgrade Patterns</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.upgradeInsights.slice(0, 5)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="toTicket" />
              <YAxis />
              <Tooltip formatter={(value: string | number) => [value, 'Upgrades']} />
              <Bar dataKey="upgradeCount" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Time Series Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white p-6 rounded-xl shadow-lg mb-8"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">📈 Revenue Trends Over Time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data?.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']} />
            <Legend />
            <Area type="monotone" dataKey="totalRevenue" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Peak Hours Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="bg-white p-6 rounded-xl shadow-lg"
      >
        <h2 className="text-xl font-bold text-gray-800 mb-4">⏰ Peak Hours Analysis</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data?.peakHours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis />
            <Tooltip formatter={(value: string | number) => [value, 'Entries']} />
            <Legend />
            <Line type="monotone" dataKey="entries" stroke="#F59E0B" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </motion.div>
        </>
      )}
    </Layout>
  );
}
