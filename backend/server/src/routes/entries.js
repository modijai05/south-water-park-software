const { Router } = require('express');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const mongoose = require('mongoose');
const { Entry } = require('../models/Entry.js');

const router = Router();

// Simple authentication middleware without database
const simpleAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Create mock user without database
    req.user = {
      _id: decoded.userId,
      username: 'admin1',
      fullName: 'Admin User',
      role: 'admin',
      active: true
    };
    
    console.log('✅ Simple auth successful for:', req.user.username);
    return next();
    
  } catch (error) {
    console.error('❌ Simple auth error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper function to get today's date range
const getTodayRange = () => {
  const now = dayjs();
  const startOfDay = now.startOf('day').toDate();
  const endOfDay = now.endOf('day').toDate();
  return { startOfDay, endOfDay };
};

// Helper function to calculate stats from entries
const calculateStatsFromEntries = (entries) => {
  const stats = {
    todayEntries: entries.length,
    totalAmount: 0,
    todayAmount: 0,
    cashAmount: 0,
    todayCash: 0,
    upiAmount: 0,
    todayUpi: 0,
    advanceAmount: 0,
    todayAdvance: 0,
    totalPeople: 0,
    todayPeople: 0,
    totalAdults: 0,
    todayAdults: 0,
    totalKids: 0,
    todayKids: 0,
    // Ticket type stats
    today150: 0,
    today300: 0,
    today450: 0,
    today600: 0,
    today100: 0,
    total150: 0,
    total300: 0,
    total450: 0,
    total600: 0,
    total100: 0
  };

  entries.forEach(entry => {
    // Today's stats
    stats.todayAmount += entry.finalAmount || 0;
    stats.todayCash += entry.cashAmount || 0;
    stats.todayUpi += entry.upiAmount || 0;
    stats.todayAdvance += entry.advanceAmount || 0;
    stats.todayPeople += entry.totalPeople || 0;
    stats.todayAdults += entry.adults || 0;
    stats.todayKids += entry.kids || 0;

    // Today's ticket types
    switch(entry.ticketType) {
      case '150': stats.today150 += 1; break;
      case '300': stats.today300 += 1; break;
      case '450': stats.today450 += 1; break;
      case '600': stats.today600 += 1; break;
      case '100': stats.today100 += 1; break;
    }
  });

  return stats;
};

// GET /api/entries/stats - Get entry statistics
router.get('/stats', simpleAuth, async (req, res) => {
  try {
    console.log('📊 Stats API called - Using real MongoDB data');
    
    // Check for force reset parameter
    const forceReset = req.query.forceReset === 'true';
    if (forceReset) {
      console.log('🚨 FORCE RESET: Returning all today stats as 0');
      
      const resetResponse = {
        success: true,
        data: {
          todayEntries: 0,
          totalEntries: 0,
          todayPeople: 0,
          totalPeople: 0,
          todayAdults: 0,
          totalAdults: 0,
          todayKids: 0,
          totalKids: 0,
          todayAmount: 0,
          totalAmount: 0,
          todayCash: 0,
          totalCash: 0,
          todayUpi: 0,
          totalUpi: 0,
          todayAdvance: 0,
          totalAdvance: 0,
          today150: 0,
          today300: 0,
          today450: 0,
          today600: 0,
          today100: 0,
          total150: 0,
          total300: 0,
          total450: 0,
          total600: 0,
          total100: 0,
          lastUpdated: new Date().toISOString(),
          forceReset: true,
          resetTrigger: 'force-parameter'
        }
      };
      
      return res.json(resetResponse);
    }
    
    // Get today's date range
    const { startOfDay, endOfDay } = getTodayRange();
    
    // Fetch today's entries from MongoDB
    const todayEntries = await Entry.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).lean();
    
    // Fetch total entries for overall stats
    const totalEntriesCount = await Entry.countDocuments();
    
    // Calculate today's stats
    const todayStats = calculateStatsFromEntries(todayEntries);
    
    // Calculate overall stats (simplified for performance)
    const overallStats = await Entry.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$finalAmount' },
          totalCash: { $sum: '$cashAmount' },
          totalUpi: { $sum: '$upiAmount' },
          totalAdvance: { $sum: '$advanceAmount' },
          totalPeople: { $sum: '$totalPeople' },
          totalAdults: { $sum: '$adults' },
          totalKids: { $sum: '$kids' },
          ticketTypes: { $push: '$ticketType' }
        }
      }
    ]);
    
    const overall = overallStats[0] || {};
    
    // Count ticket types for overall stats
    const ticketTypeCounts = await Entry.aggregate([
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const ticketStats = {};
    ticketTypeCounts.forEach(item => {
      ticketStats[`total${item._id}`] = item.count;
    });
    
    const response = {
      success: true,
      data: {
        todayEntries: todayStats.todayEntries,
        totalEntries: totalEntriesCount,
        todayPeople: todayStats.todayPeople,
        totalPeople: overall.totalPeople || 0,
        todayAdults: todayStats.todayAdults,
        totalAdults: overall.totalAdults || 0,
        todayKids: todayStats.todayKids,
        totalKids: overall.totalKids || 0,
        todayAmount: todayStats.todayAmount,
        totalAmount: overall.totalAmount || 0,
        todayCash: todayStats.todayCash,
        totalCash: overall.totalCash || 0,
        todayUpi: todayStats.todayUpi,
        totalUpi: overall.totalUpi || 0,
        todayAdvance: todayStats.todayAdvance,
        totalAdvance: overall.totalAdvance || 0,
        today150: todayStats.today150,
        today300: todayStats.today300,
        today450: todayStats.today450,
        today600: todayStats.today600,
        today100: todayStats.today100,
        total150: ticketStats.total150 || 0,
        total300: ticketStats.total300 || 0,
        total450: ticketStats.total450 || 0,
        total600: ticketStats.total600 || 0,
        total100: ticketStats.total100 || 0,
        lastUpdated: new Date().toISOString(),
        forceReset: false
      }
    };
    
    console.log('✅ Real stats data returned successfully');
    console.log(`📊 Today's entries: ${response.data.todayEntries}, Total: ${response.data.totalEntries}`);
    
    return res.json(response);
    
  } catch (error) {
    console.error('❌ Stats API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch entry statistics',
      error: error.message
    });
  }
});

// GET /api/entries/charts - Get chart data
router.get('/charts', simpleAuth, async (req, res) => {
  try {
    console.log('📊 Charts API called - Using real MongoDB data');
    
    // Get last 7 days data
    const last7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day');
      const startOfDay = date.startOf('day').toDate();
      const endOfDay = date.endOf('day').toDate();
      
      const dayStats = await Entry.aggregate([
        {
          $match: {
            createdAt: { $gte: startOfDay, $lte: endOfDay }
          }
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: '$finalAmount' }
          }
        }
      ]);
      
      last7DaysData.push({
        _id: date.format('YYYY-MM-DD'),
        count: dayStats[0]?.count || 0,
        amount: dayStats[0]?.amount || 0
      });
    }
    
    // Get ticket distribution
    const ticketDistribution = await Entry.aggregate([
      {
        $group: {
          _id: '$ticketType',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get upgrade distribution
    const upgradeDistribution = await Entry.aggregate([
      { $unwind: '$upgrades' },
      {
        $group: {
          _id: '$upgrades.ticketType',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get monthly data
    const monthlyData = await Entry.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 },
          amount: { $sum: '$finalAmount' }
        }
      },
      {
        $project: {
          _id: {
            $dateFromParts: {
              year: '$_id.year',
              month: '$_id.month'
            }
          },
          count: 1,
          amount: 1
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: { $dateToString: { format: '%Y-%m', date: '$_id' } },
          count: 1,
          amount: 1
        }
      }
    ]);
    
    const chartData = {
      success: true,
      data: {
        last7Days: last7DaysData,
        ticketDistribution: ticketDistribution,
        upgradeDistribution: upgradeDistribution,
        monthly: monthlyData
      }
    };
    
    console.log('✅ Real charts data returned successfully');
    return res.json(chartData);
    
  } catch (error) {
    console.error('❌ Charts API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data',
      error: error.message
    });
  }
});

// GET /api/entries - Get all entries (admin/staff)
router.get('/', simpleAuth, async (req, res) => {
  try {
    console.log('📊 Entries list API called - Using real MongoDB data');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const ticketType = req.query.ticketType || '';
    const date = req.query.date || '';
    
    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (ticketType) {
      query.ticketType = ticketType;
    }
    
    if (date) {
      const startOfDay = dayjs(date).startOf('day').toDate();
      const endOfDay = dayjs(date).endOf('day').toDate();
      query.createdAt = { $gte: startOfDay, $lte: endOfDay };
    }
    
    // Get entries with pagination
    const entries = await Entry.find(query)
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    
    const total = await Entry.countDocuments(query);
    
    const entriesData = {
      success: true,
      data: {
        entries: entries,
        total: total,
        page: page,
        limit: limit,
        totalPages: Math.ceil(total / limit)
      }
    };
    
    console.log(`✅ Real entries list returned successfully: ${entries.length} entries`);
    return res.json(entriesData);
    
  } catch (error) {
    console.error('❌ Entries list API Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch entries',
      error: error.message
    });
  }
});

module.exports = router;
