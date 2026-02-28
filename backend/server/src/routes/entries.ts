import { Router } from 'express';
import { Entry, IEntry } from '../models/Entry.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';
import { aggregateCouponCounts } from '../utils/couponCounter.js';
import { generateUniqueReceiptNumber, generateReceiptNumberForExistingEntry } from '../utils/receiptNumberGenerator.js';

const router = Router();

/** GET /api/entries - List entries (admin: all + amounts, staff: no amounts) */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { search, from, to, page = '1', limit = '50', crossUser } = req.query;
    const isAdmin = req.user?.role === 'admin';
    const isCrossUserSearch = crossUser === 'true' && !isAdmin; // Allow staff to search all users for receipt generation
    
    console.log('🔍 Server: Request received - search:', search, 'crossUser:', crossUser, 'user:', req.user?.username, 'role:', req.user?.role);
    console.log('🔍 Server: isAdmin:', isAdmin, 'isCrossUserSearch:', isCrossUserSearch);
    
    // Validate and sanitize inputs
    const sanitizedPage = Math.max(1, Math.min(10000, parseInt(String(page), 10)));
    const sanitizedLimit = Math.max(1, Math.min(1000, parseInt(String(limit), 10)));
    
    const filter: Record<string, unknown> = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const fromDate = new Date(from as string);
        if (!isNaN(fromDate.getTime())) {
          (filter.createdAt as Record<string, Date>).$gte = fromDate;
        }
      }
      if (to) {
        const toDate = new Date(to as string);
        if (!isNaN(toDate.getTime())) {
          (filter.createdAt as Record<string, Date>).$lte = toDate;
        }
      }
    }
    if (search && typeof search === 'string' && search.trim()) {
      const trimmedSearch = search.trim().substring(0, 100); // Limit search length
      filter.$or = [
        { name: { $regex: trimmedSearch, $options: 'i' } },
        { mobile: { $regex: trimmedSearch, $options: 'i' } },
      ];
    }
    // Apply staff filtering for non-admin users (unless crossUserSearch is enabled)
    const staffFilter = (isAdmin || isCrossUserSearch) ? {} : { createdBy: req.user?._id };
    const finalFilter = { ...filter, ...staffFilter };
    
    // Log cross-user search for debugging
    if (isCrossUserSearch) {
      console.log('🔍 Server: Cross-user search enabled for staff:', req.user?.username);
    }
    
    // Optimized pagination with cursor for large datasets
    const skip = (sanitizedPage - 1) * sanitizedLimit;
    
    // Use lean() for better performance and only select needed fields
    const entries = await Entry.find(finalFilter)
      .select('createdAt name mobile ticketType adults kids totalPeople baseAmount kidDiscount additionalDiscount finalAmount cashAmount upiAmount advanceAmount otherAmount notes upgrades adultsFastFoodCoupon kidsFastFoodCoupon adultsMainFoodCoupon kidsMainFoodCoupon filledByFullName createdBy receiptNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(sanitizedLimit)
      .populate('createdBy', 'username fullName')
      .lean()
      .maxTimeMS(30000) // 30 second timeout to prevent hanging
      .allowDiskUse(true); // Allow disk use for large queries
    
    const total = await Entry.countDocuments(finalFilter).maxTimeMS(10000).allowDiskUse(true);
    
    // Process entries with error handling
    const sanitized = entries.map((e) => {
      try {
        const o = { ...e, id: (e as { _id: unknown })._id };
        if (!isAdmin) {
          delete (o as Record<string, unknown>).finalAmount;
          delete (o as Record<string, unknown>).cashAmount;
          delete (o as Record<string, unknown>).upiAmount;
          delete (o as Record<string, unknown>).otherAmount;
          // Note: advanceAmount is NOT deleted for staff - they can see it
        }
        // Debug: Log advanceAmount values
        if ((o as any).advanceAmount !== undefined && (o as any).advanceAmount !== null) {
          console.log(`🔍 Server: Entry ${(o as any).id || 'unknown'} has advanceAmount: ${(o as any).advanceAmount}`);
        }
        return o;
      } catch (err) {
        console.error('Error processing entry:', err);
        return null;
      }
    }).filter(Boolean); // Remove null entries
    
    res.json({
      entries: sanitized,
      total,
      page: sanitizedPage,
      limit: sanitizedLimit,
      totalPages: Math.ceil(total / sanitizedLimit)
    });
  } catch (error) {
    console.error('Entries fetch error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch entries',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : 'Internal server error'
    });
  }
});

/** POST /api/entries - Create entry (admin + staff) */
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const body = req.body as Partial<IEntry>;
    if (!req.user?._id) {
      res.status(401).json({ message: 'Not authenticated' });
      return;
    }
    
    // Calculate totalPeople correctly for 150 tickets (adults only, no kids)
    let totalPeople = body.totalPeople || 0;
    if (body.ticketType === '150') {
      totalPeople = body.adults || 0;
    } else {
      totalPeople = (body.adults || 0) + (body.kids || 0);
    }
    
    // Generate unique receipt number
    const receiptNumber = await generateUniqueReceiptNumber();
    
    // Fetch user's full name to store as filledByFullName
    const User = (await import('../models/User.js')).User;
    const user = await User.findById(req.user._id).select('fullName');
    
    const entry = new Entry({
      ...body,
      totalPeople,
      receiptNumber,
      createdBy: req.user._id,
      filledByFullName: user?.fullName || req.user.username, // Use fullName if available, fallback to username
    });
    await entry.save();
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ message: (err as Error).message });
  }
});

/** GET /api/entries/stats - Stats (admin: full, staff: counts only) */
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const todayStart = dayjs().startOf('day').toDate();
    const todayEnd = dayjs().endOf('day').toDate();
    const todayFilter = { createdAt: { $gte: todayStart, $lte: todayEnd } };

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
    
    const todayCouponCounts = aggregateCouponCounts(todayEntries);
    const totalCouponCounts = aggregateCouponCounts(allEntries);
    
    // Manual calculations for stats
    const calculatePeopleStats = (entries: any[]) => {
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
          entry.upgrades.forEach((upgrade: any) => {
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
    
    console.log('📊 Server: Today stats calculated - advanceAmount:', manualTodayStats.advanceAmount);
    
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
    
    console.log('📊 Server: Total stats calculated - advanceAmount:', manualTotalStats.advanceAmount);
    
    // Helper function to calculate ticket stats including upgrades
    const calculateTicketStats = (entries: any[], ticketType: string) => {
      const mainEntries = entries.filter(e => e.ticketType === ticketType);
      const upgradeStats = entries.reduce((acc, entry) => {
        if (entry.upgrades) {
          entry.upgrades.forEach((upgrade: any) => {
            if (upgrade.ticketType === ticketType) {
              acc.adults += upgrade.adults || 0;
              acc.kids += upgrade.kids || 0;
              acc.count += 1;
            }
          });
        }
        return acc;
      }, { adults: 0, kids: 0, count: 0 });
      
      return {
        count: mainEntries.length + upgradeStats.count,
        adults: mainEntries.reduce((sum, e) => sum + (e.adults || 0), 0) + upgradeStats.adults,
        kids: mainEntries.reduce((sum, e) => sum + (e.kids || 0), 0) + upgradeStats.kids,
      };
    };
    
    // Calculate stats for each ticket type
    const today150Stats = calculateTicketStats(todayEntries, '150');
    const total150Stats = calculateTicketStats(allEntries, '150');
    const today300Stats = calculateTicketStats(todayEntries, '300');
    const total300Stats = calculateTicketStats(allEntries, '300');
    const today450Stats = calculateTicketStats(todayEntries, '450');
    const total450Stats = calculateTicketStats(allEntries, '450');
    const today600Stats = calculateTicketStats(todayEntries, '600');
    const total600Stats = calculateTicketStats(allEntries, '600');
    const today100Stats = calculateTicketStats(todayEntries, '100');
    const total100Stats = calculateTicketStats(allEntries, '100');
    
    const result: Record<string, unknown> = {
      todayEntries: todayCount,
      totalEntries: totalCount,
      todayPeople: manualTodayStats.totalPeople,
      totalPeople: manualTotalStats.totalPeople,
      todayAdults: manualTodayStats.adults,
      totalAdults: manualTotalStats.adults,
      todayKids: manualTodayStats.kids,
      totalKids: manualTotalStats.kids,
      // 150 ticket type
      today150: today150Stats.count,
      total150: total150Stats.count,
      today150Adults: today150Stats.adults,
      total150Adults: total150Stats.adults,
      today150Kids: today150Stats.kids,
      total150Kids: total150Stats.kids,
      // 300 ticket type
      today300: today300Stats.count,
      total300: total300Stats.count,
      today300Adults: today300Stats.adults,
      total300Adults: total300Stats.adults,
      today300Kids: today300Stats.kids,
      total300Kids: total300Stats.kids,
      // 450 ticket type
      today450: today450Stats.count,
      total450: total450Stats.count,
      today450Adults: today450Stats.adults,
      total450Adults: total450Stats.adults,
      today450Kids: today450Stats.kids,
      total450Kids: total450Stats.kids,
      // 600 ticket type
      today600: today600Stats.count,
      total600: total600Stats.count,
      today600Adults: today600Stats.adults,
      total600Adults: total600Stats.adults,
      today600Kids: today600Stats.kids,
      total600Kids: total600Stats.kids,
      // 100 ticket type
      today100: today100Stats.count,
      total100: total100Stats.count,
      today100Adults: today100Stats.adults,
      total100Adults: total100Stats.adults,
      today100Kids: today100Stats.kids,
      total100Kids: total100Stats.kids,
    };
    
    // Only provide financial data to admin
    if (isAdmin) {
      result.todayAmount = manualTodayStats.finalAmount;
      result.todayCash = manualTodayStats.cashAmount;
      result.todayUpi = manualTodayStats.upiAmount;
      result.todayAdvance = manualTodayStats.advanceAmount;
      result.totalAmount = manualTotalStats.finalAmount;
      result.totalCash = manualTotalStats.cashAmount;
      result.totalUpi = manualTotalStats.upiAmount;
      result.totalAdvance = manualTotalStats.advanceAmount;
      
      // Add discount statistics
      result.todayAdditionalDiscount = manualTodayStats.additionalDiscount;
      result.todayTotalDiscount = manualTodayStats.kidDiscount + manualTodayStats.additionalDiscount;
      result.totalAdditionalDiscount = manualTotalStats.additionalDiscount;
      result.totalTotalDiscount = manualTotalStats.kidDiscount + manualTotalStats.additionalDiscount;
      
      result.averageTicketValue = (result.totalAmount as number) / Math.max(1, result.totalEntries as number);
      result.peakHour = '12:00';
      result.conversionRate = 0.95;
    } else {
      result.averageTicketValue = 0;
      result.peakHour = '12:00';
      result.conversionRate = 0.95;
    }
    
    // Add proper coupon counts for all users
    result.todayAdultsFastFoodCoupons = todayCouponCounts.todayAdultsFastFoodCoupons;
    result.todayKidsFastFoodCoupons = todayCouponCounts.todayKidsFastFoodCoupons;
    result.todayAdultsMainFoodCoupons = todayCouponCounts.todayAdultsMainFoodCoupons;
    result.todayKidsMainFoodCoupons = todayCouponCounts.todayKidsMainFoodCoupons;
    result.todayTotalFastFoodCoupons = todayCouponCounts.todayTotalFastFoodCoupons;
    result.todayTotalMainFoodCoupons = todayCouponCounts.todayTotalMainFoodCoupons;
    result.todayTotalFoodCoupons = todayCouponCounts.todayTotalFoodCoupons;
    
    result.totalAdultsFastFoodCoupons = totalCouponCounts.totalAdultsFastFoodCoupons;
    result.totalKidsFastFoodCoupons = totalCouponCounts.totalKidsFastFoodCoupons;
    result.totalAdultsMainFoodCoupons = totalCouponCounts.totalAdultsMainFoodCoupons;
    result.totalKidsMainFoodCoupons = totalCouponCounts.totalKidsMainFoodCoupons;
    result.totalFastFoodCoupons = totalCouponCounts.totalFastFoodCoupons;
    result.totalMainFoodCoupons = totalCouponCounts.totalMainFoodCoupons;
    result.totalFoodCoupons = totalCouponCounts.totalFoodCoupons;
    
    // Calculate upgrade statistics
    const calculateUpgradeStats = (entries: any[]) => {
      return entries.reduce((acc, entry) => {
        if (entry.upgrades && Array.isArray(entry.upgrades)) {
          entry.upgrades.forEach((upgrade: any) => {
            acc.totalUpgrades += 1;
          });
        }
        return acc;
      }, { totalUpgrades: 0 });
    };
    
    const todayUpgradeStats = calculateUpgradeStats(todayEntries);
    const totalUpgradeStats = calculateUpgradeStats(allEntries);
    
    result.todayUpgrades = todayUpgradeStats.totalUpgrades;
    result.totalUpgrades = totalUpgradeStats.totalUpgrades;
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** GET /api/entries/charts - Chart data (admin only) */
router.get('/charts', authenticate, requireAdmin, async (_req, res) => {
  try {
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
    
    // Create comparison data
    const comparisonData = [
      { name: 'Main Tickets', value: ticketDistribution.reduce((sum: number, item: any) => sum + item.count, 0) },
      { name: 'Upgrade Tickets', value: upgradeDistribution.reduce((sum: number, item: any) => sum + item.count, 0) }
    ];
    
    const monthly = await Entry.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$finalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    
    res.json({ last7Days: last7, ticketDistribution, upgradeDistribution, comparisonData, monthly });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** PUT /api/entries/:id - Admin only */
router.put('/:id', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    console.log('PUT /api/entries/:id - Request params:', req.params.id);
    console.log('PUT /api/entries/:id - Request body:', JSON.stringify(req.body, null, 2));
    console.log('PUT /api/entries/:id - Upgrades in request:', req.body.upgrades);
    
    // Calculate totalPeople correctly for 150 tickets (adults only, no kids)
    const updateData = { ...req.body };
    if (updateData.ticketType === '150') {
      updateData.totalPeople = updateData.adults || 0;
    } else {
      updateData.totalPeople = (updateData.adults || 0) + (updateData.kids || 0);
    }
    
    // Fetch user's full name if not already provided in update
    if (!updateData.filledByFullName && req.user?._id) {
      const User = (await import('../models/User.js')).User;
      const user = await User.findById(req.user._id).select('fullName');
      updateData.filledByFullName = user?.fullName || req.user.username;
    }
    
    const entry = await Entry.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    if (!entry) {
      console.log('Entry not found with ID:', req.params.id);
      res.status(404).json({ message: 'Entry not found' });
      return;
    }
    console.log('Entry updated successfully:', entry._id);
    console.log('Updated entry upgrades:', entry.upgrades);
    res.json(entry);
  } catch (err) {
    console.error('Error updating entry:', err);
    res.status(500).json({ message: (err as Error).message });
  }
});

/** DELETE /api/entries/clear-all - Admin only */
router.delete('/clear-all', authenticate, requireAdmin, async (req, res) => {
  try {
    console.log('DELETE /api/entries/clear-all - Clearing all entries');
    const result = await Entry.deleteMany({});
    console.log(`Deleted ${result.deletedCount} entries`);
    res.json({ message: 'All entries cleared successfully', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('Error clearing all entries:', err);
    res.status(500).json({ message: (err as Error).message });
  }
});

/** DELETE /api/entries/:id - Admin only */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const entry = await Entry.findByIdAndDelete(req.params.id);
    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

/** POST /api/entries/:id/generate-receipt - Generate receipt number for existing entry */
router.post('/:id/generate-receipt', authenticate, async (req: AuthRequest, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry) {
      res.status(404).json({ message: 'Entry not found' });
      return;
    }
    
    // If entry already has a receipt number, return it
    if (entry.receiptNumber) {
      res.json({ receiptNumber: entry.receiptNumber, message: 'Receipt number already exists' });
      return;
    }
    
    // Generate new receipt number for existing entry
    const receiptNumber = await generateReceiptNumberForExistingEntry();
    
    // Update the entry with the receipt number
    entry.receiptNumber = receiptNumber;
    await entry.save();
    
    res.json({ receiptNumber, message: 'Receipt number generated successfully' });
  } catch (err) {
    console.error('Error generating receipt number:', err);
    res.status(500).json({ message: (err as Error).message });
  }
});

export default router;
