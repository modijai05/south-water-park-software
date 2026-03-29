const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { User } = require('../models/User.js');
const { Entry } = require('../models/Entry.js');
const dayjs = require('dayjs');

const router = Router();

// Mock analytics data
const mockAnalyticsData = {
  overview: {
    totalEntries: 12500,
    totalRevenue: 1250000,
    activeUsers: 45,
    todayEntries: 180,
    todayRevenue: 18000
  },
  chartData: {
    entries: [
      { date: '2024-01-01', count: 150 },
      { date: '2024-01-02', count: 200 },
      { date: '2024-01-03', count: 180 },
      { date: '2024-01-04', count: 220 },
      { date: '2024-01-05', count: 190 },
    ],
    revenue: [
      { date: '2024-01-01', amount: 15000 },
      { date: '2024-01-02', amount: 20000 },
      { date: '2024-01-03', amount: 18000 },
      { date: '2024-01-04', amount: 22000 },
      { date: '2024-01-05', amount: 19000 },
    ]
  },
  topPerformers: [
    { username: 'staff1', entries: 450, revenue: 45000 },
    { username: 'staff2', entries: 380, revenue: 38000 },
    { username: 'staff3', entries: 320, revenue: 32000 },
  ]
};

// GET /api/analytics/overview - Get analytics overview
router.get('/overview', authenticate, async (req, res) => {
  try {
    res.json({ data: mockAnalyticsData.overview });
  } catch (error) {
    console.error('Get analytics overview error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics overview' });
  }
});

// GET /api/analytics/chart - Get chart data
router.get('/chart', authenticate, async (req, res) => {
  try {
    const { type = 'entries', period = 'week' } = req.query;
    
    let data;
    switch (type) {
      case 'revenue':
        data = mockAnalyticsData.chartData.revenue;
        break;
      default:
        data = mockAnalyticsData.chartData.entries;
    }
    
    res.json({ 
      type,
      period,
      data 
    });
  } catch (error) {
    console.error('Get chart data error:', error);
    res.status(500).json({ message: 'Failed to fetch chart data' });
  }
});

// GET /api/analytics/top-performers - Get top performers (admin only)
router.get('/top-performers', authenticate, requireAdmin, async (req, res) => {
  try {
    res.json({ data: mockAnalyticsData.topPerformers });
  } catch (error) {
    console.error('Get top performers error:', error);
    res.status(500).json({ message: 'Failed to fetch top performers' });
  }
});

// GET /api/analytics/demand - Get demand analysis
router.get('/demand', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    console.log('Analytics demand request for timeRange:', timeRange);
    
    // Mock demand data based on time range
    const demandData = {
      timeRange: timeRange || 'week',
      data: [
        { ticketType: '100', demand: 45, trend: 'increasing' },
        { ticketType: '150', demand: 32, trend: 'stable' },
        { ticketType: '300', demand: 78, trend: 'increasing' },
        { ticketType: '450', demand: 25, trend: 'decreasing' },
        { ticketType: '600', demand: 15, trend: 'stable' }
      ],
      summary: {
        totalDemand: 195,
        averageDemand: 32.5,
        highestDemand: { ticketType: '300', count: 78 },
        lowestDemand: { ticketType: '600', count: 15 }
      }
    };
    
    console.log('✅ Demand analytics data sent:', JSON.stringify(demandData, null, 2));
    res.json({ success: true, data: demandData });
  } catch (error) {
    console.error('Get demand analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch demand analytics' });
  }
});

/** GET /api/analytics/today - Get today's performance analytics */
router.get('/today', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('📊 Today analytics endpoint called by user:', req.user?.username);
    
    // Use UTC timezone to ensure consistent date handling
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    
    // Create date filter without timezone complications
    const todayFilter = { 
      createdAt: { 
        $gte: todayStart, 
        $lte: todayEnd 
      } 
    };

    console.log('📊 Today date range:', {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      currentTime: now.toISOString(),
      timezone: now.format('Z')
    });

    console.log('📊 Today filter object:', JSON.stringify(todayFilter));

    const entries = await Entry.find(todayFilter).lean();
    console.log('📊 Today entries found:', entries.length);

    const ticketTypes = ['150', '300', '450', '600', '100'];
    const todayAnalytics = ticketTypes.map(type => {
      const typeEntries = entries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const adults = typeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const kids = typeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;

      // Get ticket labels
      const getTicketLabel = (ticketType) => {
        switch (ticketType) {
          case '150': return 'Special tickets';
          case '300': return '3-4hr tickets';
          case '450': return 'Fast food tickets';
          case '600': return 'Main food tickets';
          case '100': return 'Sitting only';
          default: return ticketType;
        }
      };

      return {
        ticketType: type,
        label: getTicketLabel(type),
        price: parseInt(type),
        tickets: totalEntries,
        revenue,
        totalPeople,
        adults,
        kids,
        avgPeoplePerEntry: Math.round(avgPeoplePerEntry * 100) / 100
      };
    });

    // Calculate overall today stats
    const totalRevenue = entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const totalEntries = entries.length;
    const totalPeople = entries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const totalAdults = entries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const totalKids = entries.reduce((sum, e) => sum + (e.kids || 0), 0);

    // Add live data timestamp and metrics
    const responseData = {
      todayAnalytics,
      summary: {
        totalRevenue,
        totalEntries,
        totalPeople,
        totalAdults,
        totalKids,
        date: dayjs().format('YYYY-MM-DD'),
        lastUpdated: new Date().toISOString(),
        // Live performance indicators
        liveMetrics: {
          avgTicketValue: totalEntries > 0 ? Math.round(totalRevenue / totalEntries) : 0,
          peakHour: entries.length > 0 ? 
            dayjs(entries.reduce((max, e) => 
              dayjs(e.createdAt).hour() > dayjs(max.createdAt).hour() ? e : max
            ).createdAt).hour() : 0,
          recentActivity: entries.filter(e => 
            dayjs(e.createdAt).isAfter(dayjs().subtract(30, 'minute'))
          ).length
        }
      }
    };
    
    console.log('📊 Today analytics response:', {
      totalRevenue,
      totalEntries,
      totalPeople,
      ticketTypes: todayAnalytics.map(t => ({ type: t.ticketType, tickets: t.tickets }))
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Today analytics error:', error);
    console.error('Today analytics error stack:', error.stack);
    res.status(500).json({ message: 'Failed to fetch today analytics' });
  }
});

/** GET /api/analytics/date-wise - Get date-wise analytics (today vs historical) */
router.get('/date-wise', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('📊 Date-wise analytics endpoint called by user:', req.user?.username);
    
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    
    console.log('📊 Date-wise date range:', {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      currentTime: now.toISOString(),
      timezone: now.format('Z')
    });

    // Get all entries
    const allEntries = await Entry.find({}).lean();
    console.log('📊 Total entries found:', allEntries.length);

    // Separate today's entries and historical entries
    const todayEntries = allEntries.filter(entry => {
      const entryDate = dayjs(entry.createdAt);
      return entryDate.isAfter(todayStart) && entryDate.isBefore(todayEnd);
    });
    
    const historicalEntries = allEntries.filter(entry => {
      const entryDate = dayjs(entry.createdAt);
      return !entryDate.isAfter(todayStart) || !entryDate.isBefore(todayEnd);
    });

    console.log('📊 Today entries:', todayEntries.length);
    console.log('📊 Historical entries:', historicalEntries.length);

    // Process today's data
    const ticketTypes = ['150', '300', '450', '600', '100'];
    const todayAnalytics = ticketTypes.map(type => {
      const typeEntries = todayEntries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const adults = typeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const kids = typeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;

      const getTicketLabel = (ticketType) => {
        switch (ticketType) {
          case '150': return 'Special tickets';
          case '300': return '3-4hr tickets';
          case '450': return 'Fast food tickets';
          case '600': return 'Main food tickets';
          case '100': return 'Sitting only';
          default: return ticketType;
        }
      };

      return {
        ticketType: type,
        label: getTicketLabel(type),
        price: parseInt(type),
        tickets: totalEntries,
        revenue,
        totalPeople,
        adults,
        kids,
        avgPeoplePerEntry: Math.round(avgPeoplePerEntry * 100) / 100,
        isToday: true // Mark as today's data
      };
    });

    // Process historical data (last 30 days for example)
    const thirtyDaysAgo = now.subtract(30, 'day').startOf('day').toDate();
    const recentHistoricalEntries = historicalEntries.filter(entry => 
      dayjs(entry.createdAt).isAfter(thirtyDaysAgo)
    );

    const historicalAnalytics = ticketTypes.map(type => {
      const typeEntries = recentHistoricalEntries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const adults = typeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const kids = typeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;

      const getTicketLabel = (ticketType) => {
        switch (ticketType) {
          case '150': return 'Special tickets';
          case '300': return '3-4hr tickets';
          case '450': return 'Fast food tickets';
          case '600': return 'Main food tickets';
          case '100': return 'Sitting only';
          default: return ticketType;
        }
      };

      return {
        ticketType: type,
        label: getTicketLabel(type),
        price: parseInt(type),
        tickets: totalEntries,
        revenue,
        totalPeople,
        adults,
        kids,
        avgPeoplePerEntry: Math.round(avgPeoplePerEntry * 100) / 100,
        isToday: false // Mark as historical data
      };
    });

    // Calculate overall stats
    const todayTotalRevenue = todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const todayTotalEntries = todayEntries.length;
    const todayTotalPeople = todayEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const todayTotalAdults = todayEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const todayTotalKids = todayEntries.reduce((sum, e) => sum + (e.kids || 0), 0);

    const historicalTotalRevenue = recentHistoricalEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const historicalTotalEntries = recentHistoricalEntries.length;
    const historicalTotalPeople = recentHistoricalEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const historicalTotalAdults = recentHistoricalEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const historicalTotalKids = recentHistoricalEntries.reduce((sum, e) => sum + (e.kids || 0), 0);

    // Enhanced response with live data insights
    const responseData = {
      todayAnalytics,
      historicalAnalytics,
      summary: {
        today: {
          totalRevenue: todayTotalRevenue,
          totalEntries: todayTotalEntries,
          totalPeople: todayTotalPeople,
          totalAdults: todayTotalAdults,
          totalKids: todayTotalKids,
          date: now.format('YYYY-MM-DD'),
          // Live performance indicators
          avgTicketValue: todayTotalEntries > 0 ? Math.round(todayTotalRevenue / todayTotalEntries) : 0,
          growthRate: historicalTotalEntries > 0 ? 
            Math.round(((todayTotalEntries - historicalTotalEntries) / historicalTotalEntries) * 100) : 0,
          peakHour: todayEntries.length > 0 ? 
            dayjs(todayEntries.reduce((max, e) => 
              dayjs(e.createdAt).hour() > dayjs(max.createdAt).hour() ? e : max
            ).createdAt).hour() : 0
        },
        historical: {
          totalRevenue: historicalTotalRevenue,
          totalEntries: historicalTotalEntries,
          totalPeople: historicalTotalPeople,
          totalAdults: historicalTotalAdults,
          totalKids: historicalTotalKids,
          dateRange: 'Last 30 days',
          avgTicketValue: historicalTotalEntries > 0 ? Math.round(historicalTotalRevenue / historicalTotalEntries) : 0
        },
        lastUpdated: new Date().toISOString(),
        // Live comparison metrics
        insights: {
          performanceComparison: todayTotalRevenue > historicalTotalRevenue ? 'above' : 'below',
          revenueDifference: todayTotalRevenue - historicalTotalRevenue,
          entriesDifference: todayTotalEntries - historicalTotalEntries,
          trendDirection: todayTotalEntries > historicalTotalEntries ? 'increasing' : 'decreasing'
        }
      }
    };
    
    console.log('📊 Date-wise analytics response:', {
      todayEntries: todayTotalEntries,
      historicalEntries: historicalTotalEntries,
      todayRevenue: todayTotalRevenue,
      historicalRevenue: historicalTotalRevenue
    });
    
    res.json(responseData);
  } catch (error) {
    console.error('Date-wise analytics error:', error);
    console.error('Date-wise analytics error stack:', error.stack);
    res.status(500).json({ message: 'Failed to fetch date-wise analytics' });
  }
});

module.exports = { analyticsRouter: router };
