const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');

const router = Router();

// Mock demand analysis data
const mockDemandData = {
  dailyStats: [
    { date: '2024-01-01', entries: 150, revenue: 15000 },
    { date: '2024-01-02', entries: 200, revenue: 20000 },
    { date: '2024-01-03', entries: 180, revenue: 18000 },
  ],
  weeklyStats: [
    { week: '2024-W01', entries: 1050, revenue: 105000 },
    { week: '2024-W02', entries: 1200, revenue: 120000 },
  ],
  monthlyStats: [
    { month: '2024-01', entries: 4200, revenue: 420000 },
    { month: '2024-02', entries: 3800, revenue: 380000 },
  ]
};

// GET /api/ticket-demand-analysis - Get demand analysis
router.get('/', authenticate, async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    
    let data;
    switch (period) {
      case 'weekly':
        data = mockDemandData.weeklyStats;
        break;
      case 'monthly':
        data = mockDemandData.monthlyStats;
        break;
      default:
        data = mockDemandData.dailyStats;
    }
    
    res.json({ 
      period,
      data,
      summary: {
        totalEntries: data.reduce((sum, item) => sum + item.entries, 0),
        totalRevenue: data.reduce((sum, item) => sum + item.revenue, 0),
        averageEntries: Math.round(data.reduce((sum, item) => sum + item.entries, 0) / data.length),
        averageRevenue: Math.round(data.reduce((sum, item) => sum + item.revenue, 0) / data.length)
      }
    });
  } catch (error) {
    console.error('Get demand analysis error:', error);
    res.status(500).json({ message: 'Failed to fetch demand analysis' });
  }
});

// GET /api/ticket-demand-analysis/forecast - Get demand forecast
router.get('/forecast', authenticate, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    // Mock forecast data
    const forecast = Array.from({ length: parseInt(days) }, (_, i) => ({
      date: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      predictedEntries: Math.floor(Math.random() * 100) + 150,
      predictedRevenue: Math.floor(Math.random() * 10000) + 15000,
      confidence: Math.random() * 0.3 + 0.7 // 70-100% confidence
    }));
    
    res.json({ 
      forecast,
      summary: {
        totalPredictedEntries: forecast.reduce((sum, item) => sum + item.predictedEntries, 0),
        totalPredictedRevenue: forecast.reduce((sum, item) => sum + item.predictedRevenue, 0),
        averageConfidence: forecast.reduce((sum, item) => sum + item.confidence, 0) / forecast.length
      }
    });
  } catch (error) {
    console.error('Get demand forecast error:', error);
    res.status(500).json({ message: 'Failed to generate demand forecast' });
  }
});

module.exports = router;
