const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { User } = require('../models/User.js');

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
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();
    const todayFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };

    const entries = await Entry.find(todayFilter).lean();

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

    res.json({
      todayAnalytics,
      summary: {
        totalRevenue,
        totalEntries,
        totalPeople,
        totalAdults,
        totalKids,
        date: dayjs().format('YYYY-MM-DD'),
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Today analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch today analytics' });
  }
});

module.exports = { analyticsRouter: router };
