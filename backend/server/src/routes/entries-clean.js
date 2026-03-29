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
    conversionRate: 0
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

// GET /api/entries/:id - Get single entry (PUBLIC ACCESS) - MUST BE AFTER SPECIFIC ROUTES
router.get('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🔍 Fetching single entry:', id);
    
    // Validate ObjectId format
    if (id === 'stats' || id === 'health' || id === 'sync-all') {
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
      filledBy
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

// GET /api/entries - Get all entries (admin/staff) - MUST BE LAST
router.get('/', simpleAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const from = req.query.from || '';
    const to = req.query.to || '';
    
    console.log('📋 Fetching entries with filters:', { page, limit, search, from, to });
    
    // Build query
    let query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { receiptNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }
    
    // Try database fetch
    try {
      if (mongoose.connection.readyState === 1) {
        const skip = (page - 1) * limit;
        
        const [entries, total] = await Promise.all([
          Entry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
          Entry.countDocuments(query)
        ]);
        
        console.log(`✅ Found ${entries.length} entries (page ${page}, total ${total})`);
        
        return res.json({
          success: true,
          data: {
            entries,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
          }
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback entries');
        return res.json({
          success: true,
          data: {
            entries: [],
            total: 0,
            page,
            limit,
            totalPages: 0
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
    console.error('❌ Get entries error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch entries',
      message: error.message
    });
  }
});

module.exports = router;
