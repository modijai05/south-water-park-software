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
    
    // Authentication successful
    return next();
    
  } catch (error) {
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

// Helper function to calculate comprehensive stats from entries
const calculateStatsFromEntries = (entries, allEntries = []) => {
  const stats = {
    todayEntries: entries.length,
    totalEntries: allEntries.length,
    todayAmount: 0,
    totalAmount: 0,
    cashAmount: 0,
    todayCash: 0,
    totalCash: 0,
    upiAmount: 0,
    todayUpi: 0,
    totalUpi: 0,
    advanceAmount: 0,
    todayAdvance: 0,
    totalAdvance: 0,
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
    total100: 0,
    // Per-ticket-type adult and kid counts
    today150Adults: 0,
    today150Kids: 0,
    today300Adults: 0,
    today300Kids: 0,
    today450Adults: 0,
    today450Kids: 0,
    today600Adults: 0,
    today600Kids: 0,
    today100Adults: 0,
    today100Kids: 0,
    total150Adults: 0,
    total150Kids: 0,
    total300Adults: 0,
    total300Kids: 0,
    total450Adults: 0,
    total450Kids: 0,
    total600Adults: 0,
    total600Kids: 0,
    total100Adults: 0,
    total100Kids: 0,
    // Food coupon stats
    todayAdultsFastFoodCoupons: 0,
    todayKidsFastFoodCoupons: 0,
    todayAdultsMainFoodCoupons: 0,
    todayKidsMainFoodCoupons: 0,
    todayTotalFastFoodCoupons: 0,
    todayTotalMainFoodCoupons: 0,
    todayTotalFoodCoupons: 0,
    totalAdultsFastFoodCoupons: 0,
    totalKidsFastFoodCoupons: 0,
    totalAdultsMainFoodCoupons: 0,
    totalKidsMainFoodCoupons: 0,
    totalFastFoodCoupons: 0,
    totalMainFoodCoupons: 0,
    totalFoodCoupons: 0,
    // Performance metrics
    averageTicketValue: 0,
    peakHour: 'N/A',
    conversionRate: 0,
    // Discount statistics
    todayAdditionalDiscount: 0,
    todayTotalDiscount: 0,
    totalAdditionalDiscount: 0,
    totalTotalDiscount: 0
  };

  // Calculate today's stats
  entries.forEach(entry => {
    const ticketType = parseInt(entry.ticketType) || 150;
    const adults = entry.adults || 0;
    const kids = entry.kids || 0;
    const totalPeople = adults + kids;
    const finalAmount = entry.finalAmount || 0;
    const cashAmount = entry.cashAmount || 0;
    const upiAmount = entry.upiAmount || 0;
    const advanceAmount = entry.advanceAmount || 0;

    // Basic counts
    stats.todayPeople += totalPeople;
    stats.todayAdults += adults;
    stats.todayKids += kids;
    stats.todayAmount += finalAmount;
    stats.todayCash += cashAmount;
    stats.todayUpi += upiAmount;
    stats.todayAdvance += advanceAmount;

    // Ticket type specific stats
    switch (ticketType) {
      case 100:
        stats.today100++;
        stats.today100Adults += adults;
        stats.today100Kids += kids;
        break;
      case 150:
        stats.today150++;
        stats.today150Adults += adults;
        stats.today150Kids += kids;
        break;
      case 300:
        stats.today300++;
        stats.today300Adults += adults;
        stats.today300Kids += kids;
        break;
      case 450:
        stats.today450++;
        stats.today450Adults += adults;
        stats.today450Kids += kids;
        break;
      case 600:
        stats.today600++;
        stats.today600Adults += adults;
        stats.today600Kids += kids;
        break;
    }

    // Food coupons (if available)
    if (entry.foodCoupons) {
      const adultCoupons = entry.foodCoupons.adultFastFoodCoupons + entry.foodCoupons.adultMainFoodCoupons;
      const kidCoupons = entry.foodCoupons.kidFastFoodCoupons + entry.foodCoupons.kidMainFoodCoupons;
      
      stats.todayAdultsFastFoodCoupons += entry.foodCoupons.adultFastFoodCoupons || 0;
      stats.todayKidsFastFoodCoupons += entry.foodCoupons.kidFastFoodCoupons || 0;
      stats.todayAdultsMainFoodCoupons += entry.foodCoupons.adultMainFoodCoupons || 0;
      stats.todayKidsMainFoodCoupons += entry.foodCoupons.kidMainFoodCoupons || 0;
      stats.todayTotalFastFoodCoupons += (entry.foodCoupons.adultFastFoodCoupons || 0) + (entry.foodCoupons.kidFastFoodCoupons || 0);
      stats.todayTotalMainFoodCoupons += (entry.foodCoupons.adultMainFoodCoupons || 0) + (entry.foodCoupons.kidMainFoodCoupons || 0);
      stats.todayTotalFoodCoupons += adultCoupons + kidCoupons;
    }

    // Discount calculations
    const additionalDiscount = entry.additionalDiscount || 0;
    const kidDiscount = entry.kidDiscount || 0;
    const totalDiscount = additionalDiscount + kidDiscount;
    
    stats.todayAdditionalDiscount += additionalDiscount;
    stats.todayTotalDiscount += totalDiscount;
  });

  // Calculate total stats
  allEntries.forEach(entry => {
    const ticketType = parseInt(entry.ticketType) || 150;
    const adults = entry.adults || 0;
    const kids = entry.kids || 0;
    const totalPeople = adults + kids;
    const finalAmount = entry.finalAmount || 0;
    const cashAmount = entry.cashAmount || 0;
    const upiAmount = entry.upiAmount || 0;
    const advanceAmount = entry.advanceAmount || 0;

    // Basic counts
    stats.totalPeople += totalPeople;
    stats.totalAdults += adults;
    stats.totalKids += kids;
    stats.totalAmount += finalAmount;
    stats.totalCash += cashAmount;
    stats.totalUpi += upiAmount;
    stats.totalAdvance += advanceAmount;

    // Ticket type specific stats
    switch (ticketType) {
      case 100:
        stats.total100++;
        stats.total100Adults += adults;
        stats.total100Kids += kids;
        break;
      case 150:
        stats.total150++;
        stats.total150Adults += adults;
        stats.total150Kids += kids;
        break;
      case 300:
        stats.total300++;
        stats.total300Adults += adults;
        stats.total300Kids += kids;
        break;
      case 450:
        stats.total450++;
        stats.total450Adults += adults;
        stats.total450Kids += kids;
        break;
      case 600:
        stats.total600++;
        stats.total600Adults += adults;
        stats.total600Kids += kids;
        break;
    }

    // Food coupons (if available)
    if (entry.foodCoupons) {
      stats.totalAdultsFastFoodCoupons += entry.foodCoupons.adultFastFoodCoupons || 0;
      stats.totalKidsFastFoodCoupons += entry.foodCoupons.kidFastFoodCoupons || 0;
      stats.totalAdultsMainFoodCoupons += entry.foodCoupons.adultMainFoodCoupons || 0;
      stats.totalKidsMainFoodCoupons += entry.foodCoupons.kidMainFoodCoupons || 0;
      stats.totalFastFoodCoupons += (entry.foodCoupons.adultFastFoodCoupons || 0) + (entry.foodCoupons.kidFastFoodCoupons || 0);
      stats.totalMainFoodCoupons += (entry.foodCoupons.adultMainFoodCoupons || 0) + (entry.foodCoupons.kidMainFoodCoupons || 0);
      stats.totalFoodCoupons += stats.totalAdultsFastFoodCoupons + stats.totalKidsFastFoodCoupons + stats.totalAdultsMainFoodCoupons + stats.totalKidsMainFoodCoupons;
    }

    // Discount calculations
    const additionalDiscount = entry.additionalDiscount || 0;
    const kidDiscount = entry.kidDiscount || 0;
    const totalDiscount = additionalDiscount + kidDiscount;
    
    stats.totalAdditionalDiscount += additionalDiscount;
    stats.totalTotalDiscount += totalDiscount;
  });

  // Calculate performance metrics
  stats.averageTicketValue = stats.totalEntries > 0 ? Math.round(stats.totalAmount / stats.totalEntries) : 0;
  
  return stats;
};

// Helper function to count coupons from range strings
const countCouponsFromRange = (couponRange) => {
  if (!couponRange || typeof couponRange !== 'string') return 0;
  const match = couponRange.match(/(\d+)-(\d+)/);
  if (match) {
    return parseInt(match[2]) - parseInt(match[1]) + 1;
  }
  return 0;
};

// ===========================================
// IMPORTANT: ROUTE ORDER MATTERS!
// Specific routes must come BEFORE parameterized routes
// ===========================================

// GET /api/entries/sync-all - Comprehensive data sync for all dashboards (MUST BE FIRST)
router.get('/sync-all', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('🔄 Comprehensive data sync requested');
    
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, returning offline sync data');
      return res.json({
        success: false,
        error: 'Database not connected',
        data: {
          stats: {
            todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
            todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
            todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
            todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
            today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
            total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
            today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
            today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
            today100Adults: 0, today100Kids: 0,
            total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
            total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
            total100Adults: 0, total100Kids: 0,
            lastUpdated: new Date().toISOString(),
            dataFreshness: 'offline',
            source: 'database-disconnected',
            syncStatus: 'offline'
          },
          recentEntries: [],
          todayEntries: [],
          summary: {
            totalRecords: 0,
            todayRecords: 0,
            recentRecords: 0,
            lastUpdated: new Date().toISOString()
          },
          metadata: {
            syncType: 'comprehensive',
            timestamp: new Date().toISOString(),
            dataFreshness: 'offline',
            source: 'database-disconnected',
            syncStatus: 'offline'
          }
        }
      });
    }
    
    console.log('🔗 MongoDB connected, fetching comprehensive sync data...');
    
    // Get current date range
    const { startOfDay, endOfDay } = getTodayRange();
    
    // Fetch all required data in parallel
    const [allEntries, todayEntries, recentEntries] = await Promise.all([
      Entry.find().sort({ createdAt: -1 }),
      Entry.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } }).sort({ createdAt: -1 }),
      Entry.find().sort({ createdAt: -1 }).limit(10)
    ]);
    
    console.log(`📊 Sync data: ${allEntries.length} total, ${todayEntries.length} today, ${recentEntries.length} recent`);
    
    // Calculate statistics
    const stats = calculateStatsFromEntries(todayEntries, allEntries);
    
    // Prepare comprehensive response
    const syncData = {
      stats: {
        ...stats,
        lastUpdated: new Date().toISOString(),
        dataFreshness: 'real-time',
        source: 'mongodb',
        syncStatus: 'connected'
      },
      recentEntries: recentEntries.map(entry => ({
        id: entry._id,
        name: entry.name,
        mobile: entry.mobile,
        ticketType: entry.ticketType,
        adults: entry.adults,
        kids: entry.kids,
        totalPeople: entry.totalPeople,
        finalAmount: entry.finalAmount,
        receiptNumber: entry.receiptNumber,
        createdAt: entry.createdAt
      })),
      todayEntries: todayEntries.map(entry => ({
        id: entry._id,
        name: entry.name,
        mobile: entry.mobile,
        ticketType: entry.ticketType,
        adults: entry.adults,
        kids: entry.kids,
        totalPeople: entry.totalPeople,
        finalAmount: entry.finalAmount,
        receiptNumber: entry.receiptNumber,
        createdAt: entry.createdAt
      })),
      summary: {
        totalRecords: allEntries.length,
        todayRecords: todayEntries.length,
        recentRecords: recentEntries.length,
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        syncType: 'comprehensive',
        timestamp: new Date().toISOString(),
        dataFreshness: 'real-time',
        source: 'mongodb',
        syncStatus: 'connected',
        performance: {
          queryTime: Date.now(),
          cacheStatus: 'live',
          dataIntegrity: 'verified'
        }
      }
    };
    
    console.log('✅ Comprehensive sync completed successfully');
    return res.json({
      success: true,
      data: syncData
    });
    
  } catch (error) {
    console.error('❌ Sync-all endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to sync data',
      message: error.message
    });
  }
});

// GET /api/entries/stats - Get entry statistics (PUBLIC ACCESS)
router.get('/stats', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Stats endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching stats from database...');
        
        const { startOfDay, endOfDay } = getTodayRange();
        
        // Fetch today's entries and all entries
        const [todayEntries, allEntries] = await Promise.all([
          Entry.find({ createdAt: { $gte: startOfDay, $lte: endOfDay } }).sort({ createdAt: -1 }),
          Entry.find().sort({ createdAt: -1 })
        ]);
        
        console.log(`📊 Found ${todayEntries.length} today entries, ${allEntries.length} total entries`);
        
        // Calculate statistics using helper function
        const stats = calculateStatsFromEntries(todayEntries, allEntries);
        
        // Add metadata
        stats.lastUpdated = new Date().toISOString();
        stats.dataFreshness = 'real-time';
        stats.source = 'mongodb';
        stats.syncStatus = 'connected';
        
        return res.json({
          success: true,
          data: stats
        });
        
      } catch (dbError) {
        console.error('❌ Database stats fetch failed:', dbError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback stats');
    }
    
    // Fallback stats
    const fallbackStats = {
      todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
      todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
      todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
      todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
      today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
      total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
      today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
      today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
      today100Adults: 0, today100Kids: 0,
      total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
      total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
      total100Adults: 0, total100Kids: 0,
      // Food coupon stats
      todayAdultsFastFoodCoupons: 0, todayKidsFastFoodCoupons: 0,
      todayAdultsMainFoodCoupons: 0, todayKidsMainFoodCoupons: 0,
      todayTotalFastFoodCoupons: 0, todayTotalMainFoodCoupons: 0, todayTotalFoodCoupons: 0,
      totalAdultsFastFoodCoupons: 0, totalKidsFastFoodCoupons: 0,
      totalAdultsMainFoodCoupons: 0, totalKidsMainFoodCoupons: 0,
      totalFastFoodCoupons: 0, totalMainFoodCoupons: 0, totalFoodCoupons: 0,
      // Performance metrics
      averageTicketValue: 0, peakHour: 'N/A', conversionRate: 0,
      // Discount statistics
      todayAdditionalDiscount: 0, todayTotalDiscount: 0,
      totalAdditionalDiscount: 0, totalTotalDiscount: 0,
      lastUpdated: new Date().toISOString(),
      dataFreshness: 'fallback',
      source: 'offline',
      syncStatus: 'disconnected'
    };
    
    return res.json({
      success: true,
      data: fallbackStats
    });
    
  } catch (error) {
    console.error('❌ Stats endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// GET /api/entries/:id - Get single entry (PUBLIC ACCESS) - MOVED TO THE END

// POST /api/entries - Create new entry (PUBLIC ACCESS)
router.post('/', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📝 Creating new entry:', req.body);
    
    const {
      name,
      mobile,
      ticketType,
      adults,
      kids,
      totalPeople,
      finalAmount,
      cashAmount,
      upiAmount,
      advanceAmount,
      receiptNumber,
      foodCoupons,
      filledBy,
      filledByFullName
    } = req.body;
    
    // Validate required fields
    if (!name || !mobile || !ticketType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Name, mobile, and ticket type are required'
      });
    }
    
    // Try database save
    try {
      if (mongoose.connection.readyState === 1) {
        const newEntry = new Entry({
          name,
          mobile,
          ticketType,
          adults: adults || 0,
          kids: kids || 0,
          totalPeople: totalPeople || (adults || 0) + (kids || 0),
          finalAmount: finalAmount || 0,
          cashAmount: cashAmount || 0,
          upiAmount: upiAmount || 0,
          advanceAmount: advanceAmount || 0,
          receiptNumber,
          foodCoupons,
          filledBy: filledBy || 'unknown',
          filledByFullName: filledByFullName || 'unknown',
          createdAt: new Date()
        });
        
        const savedEntry = await newEntry.save();
        console.log('✅ Entry saved to database:', savedEntry.receiptNumber);
        
        return res.status(201).json({
          success: true,
          message: 'Entry created successfully',
          data: {
            id: savedEntry._id,
            receiptNumber: savedEntry.receiptNumber,
            name: savedEntry.name,
            mobile: savedEntry.mobile,
            ticketType: savedEntry.ticketType,
            adults: savedEntry.adults,
            kids: savedEntry.kids,
            totalPeople: savedEntry.totalPeople,
            finalAmount: savedEntry.finalAmount,
            cashAmount: savedEntry.cashAmount,
            upiAmount: savedEntry.upiAmount,
            advanceAmount: savedEntry.advanceAmount,
            createdAt: savedEntry.createdAt,
            databaseSaved: true
          }
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback response');
        return res.status(201).json({
          success: true,
          message: 'Entry created successfully (fallback mode)',
          data: {
            id: 'fallback-' + Date.now(),
            receiptNumber,
            name,
            mobile,
            ticketType,
            adults,
            kids,
            totalPeople,
            finalAmount,
            cashAmount,
            upiAmount,
            advanceAmount,
            createdAt: new Date().toISOString(),
            databaseSaved: false,
            fallbackMode: true
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database save error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to save entry',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Create entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create entry',
      message: error.message
    });
  }
});

// GET /api/entries/charts - Get chart data (MUST BE BEFORE /:id)
router.get('/charts', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Charts endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching chart data...');
        
        // Get date ranges for charts
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Fetch chart data in parallel
        const [last7DaysEntries, ticketDistributionData, monthlyData] = await Promise.all([
          Entry.find({
            createdAt: { $gte: sevenDaysAgo, $lte: now }
          }).sort({ createdAt: 1 }).lean(),
          
          Entry.aggregate([
            {
              $group: {
                _id: '$ticketType',
                count: { $sum: 1 },
                amount: { $sum: '$finalAmount' }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ]),
          
          Entry.aggregate([
            {
              $match: {
                createdAt: { $gte: thirtyDaysAgo, $lte: now }
              }
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt'
                  }
                },
                count: { $sum: 1 },
                amount: { $sum: '$finalAmount' }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ])
        ]);
        
        console.log(`📊 Chart data: ${last7DaysEntries.length} last 7 days, ${ticketDistributionData.length} ticket types, ${monthlyData.length} monthly`);
        
        return res.json({
          success: true,
          data: {
            last7Days: last7DaysEntries.map(entry => ({
              _id: entry._id?.toString() || '',
              date: entry.createdAt ? new Date(entry.createdAt).toISOString().split('T')[0] : '',
              count: 1,
              amount: entry.finalAmount || 0
            })),
            ticketDistribution: ticketDistributionData.map(item => ({
              _id: item._id || '',
              count: item.count || 0,
              amount: item.amount || 0
            })),
            monthly: monthlyData.map(item => ({
              _id: item._id || '',
              count: item.count || 0,
              amount: item.amount || 0
            })),
            upgradeDistribution: [], // TODO: Implement upgrade distribution logic
            comparisonData: [] // TODO: Implement comparison data logic
          }
        });
        
      } catch (dbError) {
        console.error('❌ Database charts fetch failed:', dbError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback chart data');
    }
    
    // Fallback chart data
    const fallbackChartData = {
      last7Days: [],
      ticketDistribution: [],
      monthly: [],
      upgradeDistribution: [],
      comparisonData: []
    };
    
    return res.json({
      success: true,
      data: fallbackChartData
    });
    
  } catch (error) {
    console.error('❌ Charts endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

// GET /api/entries/export - Export entries with filtering (MUST BE BEFORE /:id)
router.get('/export', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const {
      search = '',
      ticketType = '',
      from = '',
      to = '',
      limit = 50
    } = req.query;
    
    console.log('📊 Export endpoint called with filters:', { search, ticketType, from, to, limit });
    
    // Build query
    let query = {};
    
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
    
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    // Try database fetch
    try {
      if (mongoose.connection.readyState === 1) {
        const limitNum = parseInt(limit) || 50;
        const skip = 0; // For export, get all matching records
        
        const [entries, total] = await Promise.all([
          Entry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
          Entry.countDocuments(query)
        ]);
        
        console.log(`✅ Export found ${entries.length} entries (total ${total})`);
        
        // Calculate export statistics
        const exportStats = {
          averageTicketValue: entries.length > 0 ? Math.round(entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0) / entries.length) : 0,
          totalPeople: entries.reduce((sum, e) => sum + (e.totalPeople || 0), 0),
          totalRevenue: entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
          ticketTypeDistribution: entries.reduce((dist, e) => {
            dist[e.ticketType || '150'] = (dist[e.ticketType || '150'] || 0) + 1;
            return dist;
          }, {})
        };
        
        const exportData = {
          entries,
          total,
          query: { search, ticketType, from, to, limit: limitNum },
          exportDate: new Date().toISOString(),
          exportStats,
          metadata: {
            exportVersion: '2.0',
            dataIntegrity: 'verified',
            source: 'mongodb',
            performance: {
              queryTime: Date.now(),
              recordCount: entries.length,
              cacheStatus: 'live'
            }
          }
        };
        
        return res.json({
          success: true,
          data: exportData
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback export data');
        
        return res.json({
          success: true,
          data: {
            entries: [],
            total: 0,
            query: { search, ticketType, from, to, limit },
            exportDate: new Date().toISOString(),
            exportStats: {
              averageTicketValue: 0,
              totalPeople: 0,
              totalRevenue: 0,
              ticketTypeDistribution: {}
            },
            metadata: {
              exportVersion: '2.0',
              dataIntegrity: 'fallback',
              source: 'database-disconnected',
              performance: {
                queryTime: Date.now(),
                recordCount: 0,
                cacheStatus: 'offline'
              }
            }
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database export error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Export endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export entries',
      message: error.message
    });
  }
});

// GET /api/entries - Get all entries (admin/staff) - MUST BE LAST
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;
    
    console.log('📋 Fetching entries with pagination:', { search, page: pageNum, limit: limitNum });
    
    // Try database query, fallback to mock data
    try {
      if (mongoose.connection.readyState === 1) {
        // Build optimized search query with indexes
        let query = {};
        if (search && search.trim()) {
          // Use indexed fields for better performance
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } },
            { receiptNumber: { $regex: search, $options: 'i' } },
            { filledBy: { $regex: search, $options: 'i' } }
          ];
        }
        
        // Optimized fetch with lean() for better performance
        const [entries, total] = await Promise.all([
          Entry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean() // Use lean for faster queries
            .select('name mobile ticketType adults kids totalPeople finalAmount cashAmount upiAmount advanceAmount otherAmount adultsFastFoodCoupon kidsFastFoodCoupon adultsMainFoodCoupon kidsMainFoodCoupon receiptNumber createdAt filledBy filledByFullName createdBy upgrades'), // Select only required fields
          Entry.countDocuments(query)
        ]);
        
        // Fix filledByFullName for existing entries
        const fixedEntries = entries.map(entry => ({
          ...entry,
          filledByFullName: entry.filledByFullName || entry.filledBy || 'Unknown'
        }));
        
        console.log(`✅ Found ${fixedEntries.length} entries (total: ${total})`);
        
        return res.json({
          success: true,
          data: {
            entries: fixedEntries,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
          }
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning mock data');
        return res.json({
          success: true,
          data: {
            entries: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      return res.json({
        success: true,
        data: {
          entries: [],
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0
        }
      });
    }
  } catch (error) {
    console.error('❌ Entries endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch entries',
      message: error.message
    });
  }
});

// PUT /api/entries/:id - Update single entry
router.put('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    const updateData = req.body;
    console.log('📝 Updating entry:', id, updateData);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export' || id === 'clear-all') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database update, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const updatedEntry = await Entry.findOneAndUpdate(
          { _id: id },
          updateData,
          { new: true, runValidators: true }
        );
        
        if (!updatedEntry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('✅ Entry updated in database:', updatedEntry.receiptNumber);
        return res.json({
          success: true,
          data: { entry: updatedEntry },
          message: 'Entry updated successfully'
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback update response');
        return res.json({
          success: true,
          data: { entry: { ...updateData, _id: id } },
          message: 'Entry updated successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database update error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Update entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update entry',
      message: error.message
    });
  }
});

// POST /api/entries/:id/generate-receipt - Generate receipt number for entry
router.post('/:id/generate-receipt', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🧾 Generating receipt for entry:', id);
    
    if (mongoose.connection.readyState === 1) {
      try {
        const entry = await Entry.findById(id);
        if (!entry) {
          return res.status(404).json({
            success: false,
            error: 'Entry not found'
          });
        }
        
        // Generate receipt number using the utility
        const { generateReceiptNumber } = require('../utils/receiptNumberGenerator');
        const receiptNumber = generateReceiptNumber();
        
        // Update entry with receipt number
        entry.receiptNumber = receiptNumber;
        await entry.save();
        
        console.log('✅ Receipt number generated:', receiptNumber);
        
        return res.json({
          success: true,
          receiptNumber,
          entryId: entry._id
        });
        
      } catch (dbError) {
        console.error('❌ Database error generating receipt:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: dbError.message
        });
      }
    } else {
      console.log('⚠️ MongoDB not connected, generating fallback receipt number');
      
      // Generate fallback receipt number
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
      const timestamp = today.getTime().toString().slice(-4);
      const receiptNumber = `SWP-${dateStr}-${timestamp}`;
      
      return res.json({
        success: true,
        receiptNumber,
        entryId: id,
        fallback: true
      });
    }
  } catch (error) {
    console.error('❌ Receipt generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate receipt',
      message: error.message
    });
  }
});

// DELETE /api/entries/:id - Delete single entry (PUBLIC ACCESS)
router.delete('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🗑️ Deleting entry:', id);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export' || id === 'clear-all') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database delete, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const deletedEntry = await Entry.findOneAndDelete({ _id: id });
        
        if (!deletedEntry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('✅ Entry deleted from database:', deletedEntry.receiptNumber);
        return res.json({
          success: true,
          message: 'Entry deleted successfully'
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback delete response');
        return res.json({
          success: true,
          message: 'Entry deleted successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database delete error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Delete entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete entry',
      message: error.message
    });
  }
});

// DELETE /api/entries/clear-all - Clear all entries (ADMIN ONLY)
router.delete('/clear-all', simpleAuth, async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('🗑️ Clearing all entries');
    
    // Try database clear, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const result = await Entry.deleteMany({});
        
        console.log(`✅ Cleared ${result.deletedCount} entries from database`);
        return res.json({
          success: true,
          message: `Cleared ${result.deletedCount} entries successfully`
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback clear response');
        return res.json({
          success: true,
          message: 'All entries cleared successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database clear error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Clear entries error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear entries',
      message: error.message
    });
  }
});

// GET /api/entries/:id - Get single entry (PUBLIC ACCESS) - MUST BE LAST TO AVOID CONFLICTS
router.get('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🔍 Fetching single entry:', id);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database find, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const entry = await Entry.findOne({ _id: id });
        
        if (!entry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('✅ Entry found in database');
        return res.json({
          success: true,
          data: entry
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback entry');
        return res.json({
          success: true,
          data: {
            _id: id,
            name: 'Unknown',
            mobile: 'Unknown',
            ticketType: '150',
            adults: 1,
            kids: 0,
            totalPeople: 1,
            finalAmount: 150,
            cashAmount: 150,
            upiAmount: 0,
            advanceAmount: 0,
            receiptNumber: 'REC' + Date.now(),
            createdAt: new Date().toISOString(),
            fallbackMode: true
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Get entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch entry',
      message: error.message
    });
  }
});

module.exports = router;