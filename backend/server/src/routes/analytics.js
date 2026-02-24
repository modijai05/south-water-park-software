const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');

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

module.exports = { analyticsRouter: router };
