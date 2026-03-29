import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { analyticsApi } from '@/lib/api';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { globalSyncService } from '@/services/globalSyncService';

interface TodayAnalytics {
  ticketType: string;
  label: string;
  price: number;
  tickets: number;
  revenue: number;
  totalPeople: number;
  adults: number;
  kids: number;
  avgPeoplePerEntry: number;
  // Add discount properties
  totalAdditionalDiscount?: number;
  totalKidDiscount?: number;
  totalDiscountAmount?: number;
  entriesWithDiscounts?: number;
  discountRate?: number;
}

interface TodaySummary {
  totalRevenue: number;
  totalEntries: number;
  totalPeople: number;
  totalAdults: number;
  totalKids: number;
  date: string;
  lastUpdated: string;
  // Add discount properties
  totalAdditionalDiscount?: number;
  totalKidDiscount?: number;
  totalDiscountAmount?: number;
  entriesWithDiscounts?: number;
  discountRate?: number;
  liveMetrics?: {
    avgTicketValue: number;
    peakHour: number;
    recentActivity: number;
  };
}

export function TodayAnalytics() {
  const [todayData, setTodayData] = useState<TodayAnalytics[]>([]);
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchTodayData, 30000);
    
    // Set up real-time sync event listeners
    const handleEntryCreated = () => {
      console.log('📊 TodayAnalytics: Entry created event received, refreshing data...');
      fetchTodayData();
    };
    
    const handlePaymentCompleted = () => {
      console.log('💰 TodayAnalytics: Payment completed event received, refreshing data...');
      fetchTodayData();
    };
    
    const handleImmediateSync = (event: any) => {
      console.log('⚡ TodayAnalytics: Immediate sync event received:', event.detail);
      fetchTodayData();
    };
    
    const handleStatsSync = () => {
      console.log('📈 TodayAnalytics: Stats sync event received, refreshing data...');
      fetchTodayData();
    };
    
    // Add global sync service listeners
    globalSyncService.addEventListener('entry-created', handleEntryCreated);
    globalSyncService.addEventListener('payment-completed', handlePaymentCompleted);
    globalSyncService.addEventListener('immediate-sync', handleImmediateSync);
    globalSyncService.addEventListener('stats-sync', handleStatsSync);
    
    // Also listen to window events for cross-component communication
    window.addEventListener('entry-created', handleEntryCreated as EventListener);
    window.addEventListener('payment-completed', handlePaymentCompleted as EventListener);
    window.addEventListener('immediate-sync', handleImmediateSync as EventListener);
    window.addEventListener('stats-sync', handleStatsSync as EventListener);
    
    return () => {
      clearInterval(interval);
      
      // Clean up global sync service listeners
      globalSyncService.removeEventListener('entry-created', handleEntryCreated);
      globalSyncService.removeEventListener('payment-completed', handlePaymentCompleted);
      globalSyncService.removeEventListener('immediate-sync', handleImmediateSync);
      globalSyncService.removeEventListener('stats-sync', handleStatsSync);
      
      // Clean up window event listeners
      window.removeEventListener('entry-created', handleEntryCreated as EventListener);
      window.removeEventListener('payment-completed', handlePaymentCompleted as EventListener);
      window.removeEventListener('immediate-sync', handleImmediateSync as EventListener);
      window.removeEventListener('stats-sync', handleStatsSync as EventListener);
    };
  }, []);

  const fetchTodayData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use new date-wise analytics endpoint that properly separates today vs historical
      const response = await analyticsApi.dateWise();
      console.log('✅ Date-wise analytics data loaded:', response);
      
      // Use today's analytics from the new endpoint
      setTodayData(response.todayAnalytics || []);
      setSummary(response.summary?.today || null);
      
    } catch (error) {
      console.error('Failed to fetch date-wise analytics:', error);
      setError('Failed to load today\'s analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getCardColor = (ticketType: string) => {
    switch (ticketType) {
      case '150': return 'from-blue-50 to-blue-100 border-blue-200';
      case '300': return 'from-purple-50 to-purple-100 border-purple-200';
      case '450': return 'from-orange-50 to-orange-100 border-orange-200';
      case '600': return 'from-green-50 to-green-100 border-green-200';
      case '100': return 'from-pink-50 to-pink-100 border-pink-200';
      default: return 'from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const getTextColor = (ticketType: string) => {
    switch (ticketType) {
      case '150': return 'text-blue-900';
      case '300': return 'text-purple-900';
      case '450': return 'text-orange-900';
      case '600': return 'text-green-900';
      case '100': return 'text-pink-900';
      default: return 'text-gray-900';
    }
  };

  const getIconColor = (ticketType: string) => {
    switch (ticketType) {
      case '150': return 'from-blue-500 to-blue-600';
      case '300': return 'from-purple-500 to-purple-600';
      case '450': return 'from-orange-500 to-orange-600';
      case '600': return 'from-green-500 to-green-600';
      case '100': return 'from-pink-500 to-pink-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-600 font-medium">{error}</p>
        <button 
          onClick={fetchTodayData} 
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Today's Performance</h2>
        {summary && (
          <div className="flex items-center justify-center gap-4 text-sm text-gray-600">
            <span>Date: {summary.date}</span>
            <span>•</span>
            <span>Last Updated: {new Date(summary.lastUpdated).toLocaleTimeString()}</span>
          </div>
        )}
      </motion.div>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8"
        >
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Revenue</div>
            <div className="text-2xl font-bold text-green-600">₹{summary.totalRevenue.toLocaleString()}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Entries</div>
            <div className="text-2xl font-bold text-blue-600">{summary.totalEntries}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">Total People</div>
            <div className="text-2xl font-bold text-purple-600">{summary.totalPeople}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
            <div className="text-sm font-medium text-gray-600 mb-1">Adults/Kids</div>
            <div className="text-2xl font-bold text-orange-600">{summary.totalAdults}/{summary.totalKids}</div>
          </div>
          {/* Discount Cards */}
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg shadow border border-blue-200">
            <div className="text-sm font-medium text-blue-600 mb-1">Total Discounts</div>
            <div className="text-2xl font-bold text-blue-800">₹{summary.totalDiscountAmount?.toLocaleString() || 0}</div>
            <div className="text-xs text-blue-600 mt-1">{summary.entriesWithDiscounts || 0} entries</div>
          </div>
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg shadow border border-green-200">
            <div className="text-sm font-medium text-green-600 mb-1">Discount Rate</div>
            <div className="text-2xl font-bold text-green-800">{summary.discountRate?.toFixed(1) || 0}%</div>
            <div className="text-xs text-green-600 mt-1">Additional: ₹{summary.totalAdditionalDiscount?.toLocaleString() || 0}</div>
          </div>
          {/* Live Metrics */}
          {summary.liveMetrics && (
            <>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg shadow border border-purple-200">
                <div className="text-sm font-medium text-purple-600 mb-1">Avg Ticket Value</div>
                <div className="text-2xl font-bold text-purple-800">₹{summary.liveMetrics.avgTicketValue}</div>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg shadow border border-orange-200">
                <div className="text-sm font-medium text-orange-600 mb-1">Peak Hour</div>
                <div className="text-2xl font-bold text-orange-800">{summary.liveMetrics.peakHour}:00</div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Ticket Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {todayData.map((ticket, index) => (
          <motion.div
            key={ticket.ticketType}
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1, ease: "backOut" }}
            whileHover={{
              scale: 1.02,
              y: -5,
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)"
            }}
            className={`relative bg-gradient-to-br ${getCardColor(ticket.ticketType)} p-6 rounded-xl shadow-lg border transition-all duration-300`}
          >
            {/* Background gradient on hover */}
            <div className="absolute inset-0 bg-white opacity-0 hover:opacity-10 rounded-xl transition-opacity duration-300"></div>

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-sm font-medium ${getTextColor(ticket.ticketType)} mb-1`}>{ticket.label}</p>
                  <p className={`text-2xl font-bold ${getTextColor(ticket.ticketType)}`}>₹{ticket.price}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-br ${getIconColor(ticket.ticketType)} rounded-xl flex items-center justify-center shadow-lg`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                  </svg>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Tickets:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    <AnimatedCounter value={ticket.tickets} />
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>People:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    <AnimatedCounter value={ticket.totalPeople} />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Adults:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    <AnimatedCounter value={ticket.adults} />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Kids:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    <AnimatedCounter value={ticket.kids} />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Total:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    <AnimatedCounter value={ticket.totalPeople} />
                  </span>
                </div>
              </div>

              {/* Revenue */}
              <div className="mt-4 pt-4 border-t border-current border-opacity-20">
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Revenue:</span>
                  <span className={`text-lg font-bold ${getTextColor(ticket.ticketType)}`}>
                    ₹<AnimatedCounter value={ticket.revenue} />
                  </span>
                </div>
              </div>

              {/* Discount Info */}
              {(ticket.totalDiscountAmount || 0) > 0 && (
                <div className="mt-2 pt-2 border-t border-current border-opacity-20">
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-medium ${getTextColor(ticket.ticketType)}`}>Discounts:</span>
                    <span className={`text-sm font-bold ${getTextColor(ticket.ticketType)}`}>
                      ₹<AnimatedCounter value={ticket.totalDiscountAmount || 0} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className={`text-xs ${getTextColor(ticket.ticketType)}`}>Rate:</span>
                    <span className={`text-xs font-bold ${getTextColor(ticket.ticketType)}`}>
                      {ticket.discountRate?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center mt-8">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={fetchTodayData}
          className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium shadow-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </motion.button>
      </div>
    </div>
  );
}
