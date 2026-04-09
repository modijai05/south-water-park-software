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
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day'); // Default to 30 days
    }
    
    // Get entries within the time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    console.log(`Found ${entries.length} entries for timeRange: ${timeRange}`);
    
    // Calculate demand analysis for each ticket type
    const ticketTypes = ['150', '300', '450', '600', '100'];
    const demandData = ticketTypes.map(type => {
      const typeEntries = entries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;
      
      // Calculate growth rate (compare with previous period)
      const midPoint = now.subtract(15, 'day');
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
    
    console.log('✅ Real demand analytics data sent:', demandData.length, 'ticket types processed');
    res.json(demandData);
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

      // Calculate discount data for today
      const totalAdditionalDiscount = typeEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
      const totalKidDiscount = typeEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
      const totalDiscountAmount = totalAdditionalDiscount + totalKidDiscount;
      const entriesWithDiscounts = typeEntries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;

      // Debug logging for discount data
      if (totalDiscountAmount > 0) {
        console.log(`📊 Today Analytics - Ticket Type ${type}:`, {
          totalEntries,
          totalAdditionalDiscount,
          totalKidDiscount,
          totalDiscountAmount,
          entriesWithDiscounts
        });
      }

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
        avgPeoplePerEntry: Math.round(avgPeoplePerEntry * 100) / 100,
        // Add discount data
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        entriesWithDiscounts,
        discountRate: totalEntries > 0 ? Math.round((entriesWithDiscounts / totalEntries) * 100 * 100) / 100 : 0
      };
    });

    // Calculate overall today stats
    const totalRevenue = entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const totalEntries = entries.length;
    const totalPeople = entries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const totalAdults = entries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const totalKids = entries.reduce((sum, e) => sum + (e.kids || 0), 0);

    // Calculate discount stats for today
    const totalAdditionalDiscount = entries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const totalKidDiscount = entries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    const totalDiscountAmount = totalAdditionalDiscount + totalKidDiscount;
    const entriesWithDiscounts = entries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;
    const discountRate = totalEntries > 0 ? Math.round((entriesWithDiscounts / totalEntries) * 100 * 100) / 100 : 0;

    // Debug logging for overall discount data
    if (totalDiscountAmount > 0) {
      console.log('📊 Today Analytics - Overall Discount Summary:', {
        totalEntries,
        entriesWithDiscounts,
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        discountRate
      });
    }

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
        // Add discount data to summary
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        entriesWithDiscounts,
        discountRate,
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

    // Debug: Check for entries with discounts
    const entriesWithDiscounts = allEntries.filter(entry => 
      (entry.additionalDiscount || 0) > 0 || (entry.kidDiscount || 0) > 0
    );
    console.log('📊 Entries with discounts found:', entriesWithDiscounts.length);
    
    if (entriesWithDiscounts.length > 0) {
      console.log('📊 Sample entry with discount:', {
        id: entriesWithDiscounts[0]._id,
        ticketType: entriesWithDiscounts[0].ticketType,
        additionalDiscount: entriesWithDiscounts[0].additionalDiscount,
        kidDiscount: entriesWithDiscounts[0].kidDiscount,
        finalAmount: entriesWithDiscounts[0].finalAmount,
        createdAt: entriesWithDiscounts[0].createdAt
      });
    }

    // Separate today's entries and historical entries
    const todayEntries = allEntries.filter(entry => {
      const effectiveDate = dayjs(entry.entryDate || entry.createdAt);
      return effectiveDate.isAfter(todayStart) && effectiveDate.isBefore(todayEnd);
    });
    
    const historicalEntries = allEntries.filter(entry => {
      const effectiveDate = dayjs(entry.entryDate || entry.createdAt);
      return !effectiveDate.isAfter(todayStart) || !effectiveDate.isBefore(todayEnd);
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
      
      // Calculate discount data for today
      const totalAdditionalDiscount = typeEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
      const totalKidDiscount = typeEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
      const totalDiscountAmount = totalAdditionalDiscount + totalKidDiscount;
      const entriesWithDiscounts = typeEntries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;

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
        // Add discount data
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        entriesWithDiscounts,
        discountRate: totalEntries > 0 ? Math.round((entriesWithDiscounts / totalEntries) * 100 * 100) / 100 : 0,
        isToday: true // Mark as today's data
      };
    });

    // Process historical data (last 30 days for example)
    const thirtyDaysAgo = now.subtract(30, 'day').startOf('day').toDate();
    const recentHistoricalEntries = historicalEntries.filter(entry => {
      const effectiveDate = dayjs(entry.entryDate || entry.createdAt);
      return effectiveDate.isAfter(thirtyDaysAgo);
    });

    const historicalAnalytics = ticketTypes.map(type => {
      const typeEntries = recentHistoricalEntries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const adults = typeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const kids = typeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;
      
      // Calculate discount data for historical
      const totalAdditionalDiscount = typeEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
      const totalKidDiscount = typeEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
      const totalDiscountAmount = totalAdditionalDiscount + totalKidDiscount;
      const entriesWithDiscounts = typeEntries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;

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
        // Add discount data
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        entriesWithDiscounts,
        discountRate: totalEntries > 0 ? Math.round((entriesWithDiscounts / totalEntries) * 100 * 100) / 100 : 0,
        isHistorical: true // Mark as historical data
      };
    });

    // Calculate overall stats
    const todayTotalRevenue = todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const todayTotalEntries = todayEntries.length;
    const todayTotalPeople = todayEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const todayTotalAdults = todayEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const todayTotalKids = todayEntries.reduce((sum, e) => sum + (e.kids || 0), 0);

    // Calculate discount stats for today
    const todayTotalAdditionalDiscount = todayEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const todayTotalKidDiscount = todayEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    const todayTotalDiscountAmount = todayTotalAdditionalDiscount + todayTotalKidDiscount;
    const todayEntriesWithDiscounts = todayEntries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;
    const todayDiscountRate = todayTotalEntries > 0 ? Math.round((todayEntriesWithDiscounts / todayTotalEntries) * 100 * 100) / 100 : 0;

    const historicalTotalRevenue = recentHistoricalEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
    const historicalTotalEntries = recentHistoricalEntries.length;
    const historicalTotalPeople = recentHistoricalEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
    const historicalTotalAdults = recentHistoricalEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
    const historicalTotalKids = recentHistoricalEntries.reduce((sum, e) => sum + (e.kids || 0), 0);

    // Calculate discount stats for historical
    const historicalTotalAdditionalDiscount = recentHistoricalEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const historicalTotalKidDiscount = recentHistoricalEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    const historicalTotalDiscountAmount = historicalTotalAdditionalDiscount + historicalTotalKidDiscount;
    const historicalEntriesWithDiscounts = recentHistoricalEntries.filter(e => (e.additionalDiscount || 0) > 0 || (e.kidDiscount || 0) > 0).length;
    const historicalDiscountRate = historicalTotalEntries > 0 ? Math.round((historicalEntriesWithDiscounts / historicalTotalEntries) * 100 * 100) / 100 : 0;

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
          // Add discount data to today's summary
          totalAdditionalDiscount: todayTotalAdditionalDiscount,
          totalKidDiscount: todayTotalKidDiscount,
          totalDiscountAmount: todayTotalDiscountAmount,
          entriesWithDiscounts: todayEntriesWithDiscounts,
          discountRate: todayDiscountRate,
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
          // Add discount data to historical summary
          totalAdditionalDiscount: historicalTotalAdditionalDiscount,
          totalKidDiscount: historicalTotalKidDiscount,
          totalDiscountAmount: historicalTotalDiscountAmount,
          entriesWithDiscounts: historicalEntriesWithDiscounts,
          discountRate: historicalDiscountRate,
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

// GET /api/analytics/upgrades - Get upgrade insights
router.get('/upgrades', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    console.log('Analytics upgrades request for timeRange:', timeRange);
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day');
    }
    
    // Get entries within the time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    // Calculate upgrade insights
    const upgradeData = [];
    const upgradeTypes = ['locker', 'food', 'special'];
    
    upgradeTypes.forEach(type => {
      const entriesWithUpgrade = entries.filter(e => e.upgrades && e.upgrades.includes(type));
      const totalRevenue = entriesWithUpgrade.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const upgradeCount = entriesWithUpgrade.length;
      
      if (upgradeCount > 0) {
        upgradeData.push({
          upgradeType: type,
          count: upgradeCount,
          revenue: totalRevenue,
          avgRevenue: totalRevenue / upgradeCount
        });
      }
    });
    
    console.log('✅ Real upgrade analytics data sent:', upgradeData.length, 'upgrade types processed');
    res.json(upgradeData);
  } catch (error) {
    console.error('Get upgrade analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch upgrade analytics' });
  }
});

// GET /api/analytics/timeseries - Get time series data
router.get('/timeseries', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    console.log('Analytics timeseries request for timeRange:', timeRange);
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    let groupBy = 'day';
    
    switch (timeRange) {
      case '7d': 
        startDate = now.subtract(7, 'day'); 
        groupBy = 'day';
        break;
      case '30d': 
        startDate = now.subtract(30, 'day'); 
        groupBy = 'day';
        break;
      case '90d': 
        startDate = now.subtract(90, 'day'); 
        groupBy = 'week';
        break;
      case '1y': 
        startDate = now.subtract(1, 'year'); 
        groupBy = 'month';
        break;
      default: 
        startDate = now.subtract(30, 'day');
        groupBy = 'day';
    }
    
    // Get entries within the time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    // Group entries by time period
    const timeSeriesData = {};
    
    entries.forEach(entry => {
      let key;
      const effectiveDate = dayjs(entry.entryDate || entry.createdAt);
      
      switch (groupBy) {
        case 'day':
          key = effectiveDate.format('YYYY-MM-DD');
          break;
        case 'week':
          key = effectiveDate.startOf('week').format('YYYY-MM-DD');
          break;
        case 'month':
          key = effectiveDate.format('YYYY-MM');
          break;
        default:
          key = effectiveDate.format('YYYY-MM-DD');
      }
      
      if (!timeSeriesData[key]) {
        timeSeriesData[key] = {
          date: key,
          entries: 0,
          revenue: 0,
          people: 0
        };
      }
      
      timeSeriesData[key].entries += 1;
      timeSeriesData[key].revenue += entry.finalAmount || 0;
      timeSeriesData[key].people += entry.totalPeople || 0;
    });
    
    const result = Object.values(timeSeriesData).sort((a, b) => a.date.localeCompare(b.date));
    
    console.log('✅ Real timeseries analytics data sent:', result.length, 'time periods processed');
    res.json(result);
  } catch (error) {
    console.error('Get timeseries analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch timeseries analytics' });
  }
});

// GET /api/analytics/peak-hours - Get peak hours analysis
router.get('/peak-hours', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    console.log('Analytics peak-hours request for timeRange:', timeRange);
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day');
    }
    
    // Get entries within time range
    const entries = await Entry.find({
      $or: [
        { entryDate: { $gte: startDate.toDate() } },
        { createdAt: { $gte: startDate.toDate() } }
      ]
    }).lean();
    
    // Calculate peak hours (0-23)
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      entries: 0,
      revenue: 0,
      people: 0
    }));
    
    entries.forEach(entry => {
      const hour = dayjs(entry.entryDate || entry.createdAt).hour();
      hourlyData[hour].entries += 1;
      hourlyData[hour].revenue += entry.finalAmount || 0;
      hourlyData[hour].people += entry.totalPeople || 0;
    });
    
    console.log('✅ Real peak-hours analytics data sent for 24 hours');
    res.json(hourlyData);
  } catch (error) {
    console.error('Get peak-hours analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch peak-hours analytics' });
  }
});

// GET /api/analytics/customer-preferences - Get customer preferences
router.get('/customer-preferences', authenticate, async (req, res) => {
  try {
    const { timeRange } = req.query;
    console.log('Analytics customer-preferences request for timeRange:', timeRange);
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day');
    }
    
    // Get entries within the time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    // Calculate customer preferences
    const preferences = {
      ticketTypePreferences: {},
      avgGroupSize: 0,
      weekendVsWeekday: { weekend: 0, weekday: 0 },
      timePreferences: { morning: 0, afternoon: 0, evening: 0 }
    };
    
    let totalPeople = 0;
    let totalEntries = entries.length;
    
    entries.forEach(entry => {
      // Ticket type preferences
      const ticketType = entry.ticketType || 'unknown';
      preferences.ticketTypePreferences[ticketType] = (preferences.ticketTypePreferences[ticketType] || 0) + 1;
      
      // Group size
      totalPeople += entry.totalPeople || 0;
      
      // Weekend vs Weekday
      const day = dayjs(entry.createdAt).day();
      if (day === 0 || day === 6) { // Sunday or Saturday
        preferences.weekendVsWeekday.weekend += 1;
      } else {
        preferences.weekendVsWeekday.weekday += 1;
      }
      
      // Time preferences
      const hour = dayjs(entry.createdAt).hour();
      if (hour < 12) {
        preferences.timePreferences.morning += 1;
      } else if (hour < 17) {
        preferences.timePreferences.afternoon += 1;
      } else {
        preferences.timePreferences.evening += 1;
      }
    });
    
    preferences.avgGroupSize = totalEntries > 0 ? totalPeople / totalEntries : 0;
    
    console.log('✅ Real customer-preferences analytics data sent');
    res.json([preferences]);
  } catch (error) {
    console.error('Get customer-preferences analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch customer-preferences analytics' });
  }
});

// GET /api/analytics/discounts - Get discount analytics
router.get('/discounts', authenticate, async (req, res) => {
  try {
    console.log('🎯 Analytics discounts endpoint called - DEBUG');
    const { timeRange } = req.query;
    console.log('Analytics discounts request for timeRange:', timeRange);
    
    // Calculate date range based on timeRange
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
      default: startDate = now.subtract(30, 'day');
    }
    
    // Get entries within time range
    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();
    
    console.log(`Found ${entries.length} entries for discount analysis`);
    
    // Calculate comprehensive discount analytics
    const discountAnalytics = {
      summary: {
        totalEntries: entries.length,
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
    
    // Process entries for discount data
    const dailyData = {};
    
    entries.forEach(entry => {
      const additionalDiscount = entry.additionalDiscount || 0;
      const kidDiscount = entry.kidDiscount || 0;
      const totalDiscount = additionalDiscount + kidDiscount;
      
      if (totalDiscount > 0) {
        discountAnalytics.summary.entriesWithDiscounts++;
        discountAnalytics.summary.totalDiscountAmount += totalDiscount;
        discountAnalytics.summary.totalAdditionalDiscount += additionalDiscount;
        discountAnalytics.summary.totalKidDiscount += kidDiscount;
        
        // Track by ticket type
        const ticketType = entry.ticketType || 'unknown';
        if (!discountAnalytics.trends.ticketTypeDiscounts[ticketType]) {
          discountAnalytics.trends.ticketTypeDiscounts[ticketType] = {
            count: 0,
            totalDiscount: 0,
            avgDiscount: 0
          };
        }
        discountAnalytics.trends.ticketTypeDiscounts[ticketType].count++;
        discountAnalytics.trends.ticketTypeDiscounts[ticketType].totalDiscount += totalDiscount;
        
        // Track discount types
        if (additionalDiscount > 0) {
          discountAnalytics.trends.discountTypes.additional.count++;
          discountAnalytics.trends.discountTypes.additional.amount += additionalDiscount;
        }
        if (kidDiscount > 0) {
          discountAnalytics.trends.discountTypes.kid.count++;
          discountAnalytics.trends.discountTypes.kid.amount += kidDiscount;
        }
        
        // Track daily discounts
        const day = dayjs(entry.createdAt).format('YYYY-MM-DD');
        if (!dailyData[day]) {
          dailyData[day] = { date: day, additionalDiscount: 0, kidDiscount: 0, totalDiscount: 0, entries: 0 };
        }
        dailyData[day].additionalDiscount += additionalDiscount;
        dailyData[day].kidDiscount += kidDiscount;
        dailyData[day].totalDiscount += totalDiscount;
        dailyData[day].entries++;
      }
    });
    
    // Calculate averages and rates
    if (entries.length > 0) {
      discountAnalytics.summary.discountRate = (discountAnalytics.summary.entriesWithDiscounts / entries.length) * 100;
      discountAnalytics.summary.averageDiscountPerEntry = discountAnalytics.summary.totalDiscountAmount / entries.length;
    }
    
    // Calculate average discount amounts for discount types
    if (discountAnalytics.trends.discountTypes.additional.count > 0) {
      discountAnalytics.trends.discountTypes.additional.avgAmount = 
        discountAnalytics.trends.discountTypes.additional.amount / discountAnalytics.trends.discountTypes.additional.count;
    }
    if (discountAnalytics.trends.discountTypes.kid.count > 0) {
      discountAnalytics.trends.discountTypes.kid.avgAmount = 
        discountAnalytics.trends.discountTypes.kid.amount / discountAnalytics.trends.discountTypes.kid.count;
    }
    
    // Calculate average discount per ticket type
    Object.keys(discountAnalytics.trends.ticketTypeDiscounts).forEach(ticketType => {
      const data = discountAnalytics.trends.ticketTypeDiscounts[ticketType];
      data.avgDiscount = data.count > 0 ? data.totalDiscount / data.count : 0;
    });
    
    // Convert daily data to array and sort
    discountAnalytics.trends.dailyDiscounts = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    
    // Find insights
    if (discountAnalytics.trends.dailyDiscounts.length > 0) {
      const highestDay = discountAnalytics.trends.dailyDiscounts.reduce((max, day) => 
        day.totalDiscount > max.totalDiscount ? day : max
      );
      discountAnalytics.insights.highestDiscountDay = highestDay;
    }
    
    const ticketTypeEntries = Object.entries(discountAnalytics.trends.ticketTypeDiscounts);
    if (ticketTypeEntries.length > 0) {
      const mostDiscounted = ticketTypeEntries.reduce((max, [type, data]) => 
        data.totalDiscount > max[1].totalDiscount ? [type, data] : max
      );
      discountAnalytics.insights.mostDiscountedTicketType = {
        ticketType: mostDiscounted[0],
        ...mostDiscounted[1]
      };
    }
    
    // Determine discount frequency
    if (discountAnalytics.summary.discountRate > 50) {
      discountAnalytics.insights.discountFrequency = 'high';
    } else if (discountAnalytics.summary.discountRate > 20) {
      discountAnalytics.insights.discountFrequency = 'medium';
    } else {
      discountAnalytics.insights.discountFrequency = 'low';
    }
    
    discountAnalytics.insights.totalSavings = discountAnalytics.summary.totalDiscountAmount;
    
    console.log('✅ Real discount analytics data sent successfully');
    res.json(discountAnalytics);
  } catch (error) {
    console.error('Get discount analytics error:', error);
    console.error('Get discount analytics error stack:', error.stack);
    res.status(500).json({ message: 'Failed to fetch discount analytics' });
  }
});

// GET /api/analytics/discounts-test - Test endpoint for debugging
router.get('/discounts-test', async (req, res) => {
  try {
    console.log('🧪 Analytics discounts-test endpoint called');
    res.json({
      success: true,
      message: 'Discount analytics test endpoint working',
      timestamp: new Date().toISOString(),
      debug: {
        endpoint: '/api/analytics/discounts-test',
        method: 'GET',
        query: req.query,
        headers: req.headers
      }
    });
  } catch (error) {
    console.error('Discount analytics test error:', error);
    res.status(500).json({ message: 'Test endpoint failed' });
  }
});

// GET /api/analytics/debug-discounts - Debug endpoint to check discount data
router.get('/debug-discounts', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('🔍 Debug discounts endpoint called');
    
    // Get all entries with discounts
    const entriesWithDiscounts = await Entry.find({
      $or: [
        { additionalDiscount: { $gt: 0 } },
        { kidDiscount: { $gt: 0 } }
      ]
    }).lean();
    
    console.log(`🔍 Found ${entriesWithDiscounts.length} entries with discounts`);
    
    // Get today's entries with discounts
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    
    const todayEntriesWithDiscounts = entriesWithDiscounts.filter(entry => {
      const effectiveDate = dayjs(entry.entryDate || entry.createdAt);
      return effectiveDate.isAfter(todayStart) && effectiveDate.isBefore(todayEnd);
    });
    
    console.log(`🔍 Found ${todayEntriesWithDiscounts.length} today's entries with discounts`);
    
    // Calculate totals
    const totalAdditionalDiscount = entriesWithDiscounts.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const totalKidDiscount = entriesWithDiscounts.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    const totalDiscountAmount = totalAdditionalDiscount + totalKidDiscount;
    
    const todayAdditionalDiscount = todayEntriesWithDiscounts.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0);
    const todayKidDiscount = todayEntriesWithDiscounts.reduce((sum, e) => sum + (e.kidDiscount || 0), 0);
    const todayDiscountAmount = todayAdditionalDiscount + todayKidDiscount;
    
    // Sample entries
    const sampleEntries = entriesWithDiscounts.slice(0, 3).map(entry => ({
      id: entry._id,
      ticketType: entry.ticketType,
      additionalDiscount: entry.additionalDiscount,
      kidDiscount: entry.kidDiscount,
      finalAmount: entry.finalAmount,
      createdAt: entry.createdAt
    }));
    
    res.json({
      success: true,
      summary: {
        totalEntriesWithDiscounts: entriesWithDiscounts.length,
        todayEntriesWithDiscounts: todayEntriesWithDiscounts.length,
        totalAdditionalDiscount,
        totalKidDiscount,
        totalDiscountAmount,
        todayAdditionalDiscount,
        todayKidDiscount,
        todayDiscountAmount
      },
      sampleEntries
    });
  } catch (error) {
    console.error('Debug discounts error:', error);
    res.status(500).json({ message: 'Failed to debug discount data' });
  }
});

module.exports = { analyticsRouter: router };
