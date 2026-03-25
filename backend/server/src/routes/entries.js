const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth.js');
const { Entry } = require('../models/Entry.js');
const { User } = require('../models/User.js');
const dayjs = require('dayjs');
const { aggregateCouponCounts } = require('../utils/couponCounter.js');
const { generateUniqueReceiptNumber, generateReceiptNumberForExistingEntry } = require('../utils/receiptNumberGenerator.js');

const router = Router();


// GET /api/entries/stats - Get entry statistics
router.get('/stats', authenticate, async (req, res) => {
  try {
    console.error('📊 Entries stats API called successfully');
    const isAdmin = req.user?.role === 'admin';
    
    // Add cache-busting headers
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    
    // Check database connection
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ Database not connected, returning fallback stats data');
      return res.json({
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
          // Add ticket type breakdown statistics
          today100: 0, total100: 0, today100Adults: 0, total100Adults: 0, today100Kids: 0, total100Kids: 0,
          today150: 0, total150: 0, today150Adults: 0, total150Adults: 0, today150Kids: 0, total150Kids: 0,
          today300: 0, total300: 0, today300Adults: 0, total300Adults: 0, today300Kids: 0, total300Kids: 0,
          today450: 0, total450: 0, today450Adults: 0, total450Adults: 0, today450Kids: 0, total450Kids: 0,
          today600: 0, total600: 0, today600Adults: 0, total600Adults: 0, today600Kids: 0, total600Kids: 0,
          // Only provide financial data to admin
          ...(isAdmin ? {
            todayAmount: 0,
            todayCash: 0,
            todayUpi: 0,
            todayAdvance: 0,
            totalAmount: 0,
            totalCash: 0,
            totalUpi: 0,
            totalAdvance: 0,
            averageTicketValue: 0,
            // Add discount statistics
            todayKidDiscount: 0,
            todayAdditionalDiscount: 0,
            todayTotalDiscount: 0,
            totalKidDiscount: 0,
            totalAdditionalDiscount: 0,
            totalTotalDiscount: 0,
          } : {}),
          // Add coupon counts
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
        }
      });
    }
    
    // Use server's local timezone for consistent date handling
    // Force fresh calculation every time
    const now = dayjs();
    const todayStart = now.startOf('day').toDate();
    const todayEnd = now.endOf('day').toDate();
    const todayFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };

    console.log('📊 Today date range (FRESH CALCULATION):', {
      todayStart: todayStart.toISOString(),
      todayEnd: todayEnd.toISOString(),
      currentTime: now.toISOString(),
      timezone: now.format('Z'),
      serverTime: new Date().toISOString(),
      todayDate: now.format('YYYY-MM-DD'),
      forceRefresh: req.query.force === 'true',
      timestamp: req.query.t
    });

    // If force refresh is requested, log it
    if (req.query.force === 'true') {
      console.log('🔄 FORCE REFRESH REQUESTED - Ignoring any cache');
    }

    // For staff, filter by their own entries
    const staffFilter = isAdmin ? {} : { createdBy: req.user?._id };
    const todayStaffFilter = { ...todayFilter, ...staffFilter };

    // Use lean() and only select needed fields for better performance
    const [todayCount, totalCount, todayEntries, allEntries] = await Promise.all([
      Entry.countDocuments(todayStaffFilter).maxTimeMS(5000),
      Entry.countDocuments(staffFilter).maxTimeMS(10000),
      Entry.find(todayStaffFilter)
        .select('ticketType adults kids totalPeople finalAmount cashAmount upiAmount advanceAmount otherAmount kidDiscount additionalDiscount adultsFastFoodCoupon kidsFastFoodCoupon adultsMainFoodCoupon kidsMainFoodCoupon upgrades')
        .lean()
        .maxTimeMS(5000),
      Entry.find(staffFilter)
        .select('ticketType adults kids totalPeople finalAmount cashAmount upiAmount advanceAmount otherAmount kidDiscount additionalDiscount adultsFastFoodCoupon kidsFastFoodCoupon adultsMainFoodCoupon kidsMainFoodCoupon upgrades')
        .lean()
        .maxTimeMS(10000)
    ]);
    
    console.log('📊 Today entries found:', todayEntries.length);
    console.log('📊 Today entries sample:', todayEntries.slice(0, 3).map(e => ({
      id: e._id,
      createdAt: e.createdAt,
      ticketType: e.ticketType,
      finalAmount: e.finalAmount
    })));
    
    const todayCouponCounts = aggregateCouponCounts(todayEntries);
    const totalCouponCounts = aggregateCouponCounts(allEntries);
    
    // Calculate ticket type breakdown statistics
    const calculateTicketTypeStats = (entries, prefix = 'today') => {
      const ticketTypes = ['100', '150', '300', '450', '600'];
      const stats = {};
      
      ticketTypes.forEach(type => {
        const typeEntries = entries.filter(e => e.ticketType === type);
        const typeStats = typeEntries.reduce((acc, entry) => {
          let entryAdults = entry.adults || 0;
          let entryKids = entry.kids || 0;
          let entryPeople = entry.totalPeople || 0;
          
          // Include people from upgrades
          if (entry.upgrades) {
            entry.upgrades.forEach((upgrade) => {
              entryPeople += (upgrade.adults || 0) + (upgrade.kids || 0);
              if (upgrade.ticketType !== '150') {
                entryAdults += upgrade.adults || 0;
              }
              entryKids += upgrade.kids || 0;
            });
          }
          
          return {
            entries: acc.entries + 1,
            adults: acc.adults + entryAdults,
            kids: acc.kids + entryKids,
            people: acc.people + entryPeople
          };
        }, { entries: 0, adults: 0, kids: 0, people: 0 });
        
        stats[`${prefix}${type}`] = typeStats.entries;
        stats[`${prefix}${type}Adults`] = typeStats.adults;
        stats[`${prefix}${type}Kids`] = typeStats.kids;
      });
      
      return stats;
    };
    
    const todayTicketStats = calculateTicketTypeStats(todayEntries, 'today');
    const totalTicketStats = calculateTicketTypeStats(allEntries, 'total');
    
    // Log ticket type stats for debugging
    console.log('🎫 Ticket Type Stats - Today:', {
      today150: todayTicketStats.today150,
      today300: todayTicketStats.today300,
      today450: todayTicketStats.today450,
      today600: todayTicketStats.today600,
      today100: todayTicketStats.today100,
      todayEntriesCount: todayEntries.length
    });
    
    console.log('🎫 Ticket Type Stats - Total:', {
      total150: totalTicketStats.total150,
      total300: totalTicketStats.total300,
      total450: totalTicketStats.total450,
      total600: totalTicketStats.total600,
      total100: totalTicketStats.total100,
      totalEntriesCount: allEntries.length
    });
    
    // Manual calculations for stats
    const calculatePeopleStats = (entries) => {
      return entries.reduce((acc, entry) => {
        let entryPeople = entry.totalPeople || 0;
        let entryAdults = entry.adults || 0;
        let entryKids = entry.kids || 0;
        
        // Exclude 150 ticket adults from general adults count (they are counted separately)
        if (entry.ticketType === '150') {
          entryAdults = 0; // Don't count 150 ticket adults in general adults
        }
        
        // Include people from upgrades (but exclude 150 ticket upgrades from general adults)
        if (entry.upgrades) {
          entry.upgrades.forEach((upgrade) => {
            entryPeople += (upgrade.adults || 0) + (upgrade.kids || 0);
            if (upgrade.ticketType !== '150') {
              entryAdults += upgrade.adults || 0;
            }
            entryKids += upgrade.kids || 0;
          });
        }
        
        return {
          totalPeople: acc.totalPeople + entryPeople,
          adults: acc.adults + entryAdults,
          kids: acc.kids + entryKids
        };
      }, { totalPeople: 0, adults: 0, kids: 0 });
    };
    
    const todayPeopleStats = calculatePeopleStats(todayEntries);
    const totalPeopleStats = calculatePeopleStats(allEntries);
    
    const manualTodayStats = {
      totalPeople: todayPeopleStats.totalPeople,
      adults: todayPeopleStats.adults,
      kids: todayPeopleStats.kids,
      finalAmount: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      cashAmount: todayEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0),
      upiAmount: todayEntries.reduce((sum, e) => sum + (e.upiAmount || 0), 0),
      advanceAmount: todayEntries.reduce((sum, e) => sum + (e.advanceAmount || 0), 0),
      kidDiscount: todayEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
      additionalDiscount: todayEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0),
    };
    
    console.log('📊 Manual today stats calculated:', {
      totalEntries: todayEntries.length,
      totalPeople: manualTodayStats.totalPeople,
      totalRevenue: manualTodayStats.finalAmount,
      totalCash: manualTodayStats.cashAmount,
      totalUPI: manualTodayStats.upiAmount,
      totalAdvance: manualTodayStats.advanceAmount
    });
    
    const manualTotalStats = {
      totalPeople: totalPeopleStats.totalPeople,
      adults: totalPeopleStats.adults,
      kids: totalPeopleStats.kids,
      finalAmount: allEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      cashAmount: allEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0),
      upiAmount: allEntries.reduce((sum, e) => sum + (e.upiAmount || 0), 0),
      advanceAmount: allEntries.reduce((sum, e) => sum + (e.advanceAmount || 0), 0),
      kidDiscount: allEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
      additionalDiscount: allEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0),
    };
    
    // SIMPLE PROFESSIONAL FIX: Check for force reset parameter
    const forceReset = req.query.forceReset === 'true';
    
    // SIMPLE PROFESSIONAL FIX: Force all today stats to 0 when forceReset=true
    if (forceReset) {
      console.log('🚨 SIMPLE PROFESSIONAL FIX: Force reset parameter detected - forcing all today stats to 0');
      
      // Return forced reset response
      const resetResponse = {
        success: true,
        data: {
          todayEntries: 0,
          totalEntries: totalCount,
          todayPeople: 0,
          totalPeople: manualTotalStats.totalPeople,
          todayAdults: 0,
          totalAdults: manualTotalStats.adults,
          todayKids: 0,
          totalKids: manualTotalStats.kids,
          todayAmount: 0,
          totalAmount: manualTotalStats.finalAmount,
          todayCash: 0,
          totalCash: manualTotalStats.cashAmount,
          todayUpi: 0,
          totalUpi: manualTotalStats.upiAmount,
          todayAdvance: 0,
          totalAdvance: manualTotalStats.advanceAmount,
          // FORCE ALL TICKET TYPES TO 0
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
          resetTrigger: 'simple-force-parameter'
        }
      };
      
      console.log('🚀 SIMPLE PROFESSIONAL FIX: Response prepared with all today stats = 0');
      return res.json(resetResponse);
    }

    const result = {
      success: true,
      data: {
        todayEntries: todayCount,
        totalEntries: totalCount,
        todayPeople: manualTodayStats.totalPeople,
        totalPeople: manualTotalStats.totalPeople,
        todayAdults: manualTodayStats.adults,
        totalAdults: manualTotalStats.adults,
        todayKids: manualTodayStats.kids,
        totalKids: manualTotalStats.kids,
        // Add ticket type breakdown statistics
        ...todayTicketStats,
        ...totalTicketStats,
        // Only provide financial data to admin
        ...(isAdmin ? {
          todayAmount: manualTodayStats.finalAmount,
          todayCash: manualTodayStats.cashAmount,
          todayUpi: manualTodayStats.upiAmount,
          todayAdvance: manualTodayStats.advanceAmount,
          totalAmount: manualTotalStats.finalAmount,
          totalCash: manualTotalStats.cashAmount,
          totalUpi: manualTotalStats.upiAmount,
          totalAdvance: manualTotalStats.advanceAmount,
          averageTicketValue: manualTotalStats.finalAmount / Math.max(1, totalCount),
          // Add discount statistics
          todayKidDiscount: manualTodayStats.kidDiscount,
          todayAdditionalDiscount: manualTodayStats.additionalDiscount,
          todayTotalDiscount: manualTodayStats.kidDiscount + manualTodayStats.additionalDiscount,
          totalKidDiscount: manualTotalStats.kidDiscount,
          totalAdditionalDiscount: manualTotalStats.additionalDiscount,
          totalTotalDiscount: manualTotalStats.kidDiscount + manualTotalStats.additionalDiscount,
        } : {}),
        // Add coupon counts
        todayAdultsFastFoodCoupons: todayCouponCounts.todayAdultsFastFoodCoupons,
        todayKidsFastFoodCoupons: todayCouponCounts.todayKidsFastFoodCoupons,
        todayAdultsMainFoodCoupons: todayCouponCounts.todayAdultsMainFoodCoupons,
        todayKidsMainFoodCoupons: todayCouponCounts.todayKidsMainFoodCoupons,
        todayTotalFastFoodCoupons: todayCouponCounts.todayTotalFastFoodCoupons,
        todayTotalMainFoodCoupons: todayCouponCounts.todayTotalMainFoodCoupons,
        todayTotalFoodCoupons: todayCouponCounts.todayTotalFoodCoupons,
        totalAdultsFastFoodCoupons: totalCouponCounts.totalAdultsFastFoodCoupons,
        totalKidsFastFoodCoupons: totalCouponCounts.totalKidsFastFoodCoupons,
        totalAdultsMainFoodCoupons: totalCouponCounts.totalAdultsMainFoodCoupons,
        totalKidsMainFoodCoupons: totalCouponCounts.totalKidsMainFoodCoupons,
        totalFastFoodCoupons: totalCouponCounts.totalFastFoodCoupons,
        totalMainFoodCoupons: totalCouponCounts.totalMainFoodCoupons,
        totalFoodCoupons: totalCouponCounts.totalFoodCoupons,
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Entries stats API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch entry statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/entries/charts - Get chart data
router.get('/charts', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Entries charts API called successfully');
    const last7 = await Entry.aggregate([
      { $match: { createdAt: { $gte: dayjs().subtract(7, 'day').startOf('day').toDate() } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$finalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    
    const ticketDistribution = await Entry.aggregate([
      { $group: { _id: '$ticketType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    
    // Calculate upgrade distribution
    const upgradeDistribution = await Entry.aggregate([
      { $unwind: '$upgrades' },
      { $group: { _id: '$upgrades.ticketType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    
    const monthly = await Entry.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$finalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    
    const result = {
      success: true,
      data: {
        last7Days: last7 || [],
        ticketDistribution: ticketDistribution || [],
        upgradeDistribution: upgradeDistribution || [],
        monthly: monthly || []
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Entries charts API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch chart data',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/entries - Get all entries (admin/staff)
router.get('/', authenticate, async (req, res) => {
  try {
    console.error('Entries list API called successfully');
    const { page = 1, limit = 20, search, from, to } = req.query;
    const isAdmin = req.user?.role === 'admin';
    
    // Build query
    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } }
      ];
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Apply staff filtering for non-admin users
    if (!isAdmin) {
      query.createdBy = req.user?._id;
    }

    const skip = (page - 1) * limit;
    const entries = await Entry.find(query)
      .populate('createdBy', 'username fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .maxTimeMS(30000)
      .allowDiskUse(true);
    
    const total = await Entry.countDocuments(query).maxTimeMS(10000).allowDiskUse(true);
    
    // Process entries to remove sensitive data for non-admin users
    const sanitizedEntries = entries.map(entry => {
      const entryObj = entry.toObject();
      if (!isAdmin) {
        delete entryObj.finalAmount;
        delete entryObj.cashAmount;
        delete entryObj.upiAmount;
        delete entryObj.otherAmount;
        // Note: advanceAmount is NOT deleted for staff - they can see it
      }
      return entryObj;
    });
    
    const result = {
      success: true,
      data: {
        entries: sanitizedEntries || [],
        total: total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Entries list API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// GET /api/entries/:id - Get single entry
router.get('/:id', authenticate, async (req, res) => {
  try {
    console.error('Get single entry API called successfully');
    const entry = await Entry.findById(req.params.id).populate('createdBy', 'username fullName');
    if (!entry) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }
    
    const result = {
      success: true,
      data: { entry }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Get single entry API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// POST /api/entries - Create new entry
router.post('/', authenticate, async (req, res) => {
  try {
    console.error('Create entry API called successfully');
    if (!req.user?._id) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authenticated' 
      });
    }
    
    const entryData = {
      ...req.body,
      createdBy: req.user._id,
      createdAt: new Date()
    };
    
    // Generate unique receipt number
    const receiptNumber = await generateUniqueReceiptNumber();
    entryData.receiptNumber = receiptNumber;
    
    // Fetch user's full name to store as filledByFullName
    const user = await User.findById(req.user._id).select('fullName');
    entryData.filledByFullName = user?.fullName || req.user.username;
    
    const entry = await Entry.create(entryData);
    const populatedEntry = await Entry.findById(entry._id).populate('createdBy', 'username fullName');
    
    const result = {
      success: true,
      message: 'Entry created successfully',
      data: populatedEntry
    };
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Create entry API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// PUT /api/entries/:id - Update entry (admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Update entry API called successfully');
    const entry = await Entry.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'username fullName');
    
    if (!entry) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }
    
    const result = {
      success: true,
      message: 'Entry updated successfully',
      data: { entry }
    };
    
    res.json(result);
  } catch (error) {
    console.error('Update entry API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// DELETE /api/entries/:id - Delete entry (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    console.error('Delete entry API called successfully');
    const result = await Entry.deleteOne({ _id: req.params.id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Entry not found' 
      });
    }
    
    const response = {
      success: true,
      message: 'Entry deleted successfully'
    };
    
    res.json(response);
  } catch (error) {
    console.error('Delete entry API error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
