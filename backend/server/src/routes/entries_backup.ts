// This is a backup of the original working entries.ts
// We'll restore the main file from this if needed

import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { Entry, IEntry } from '../models/Entry.js';
import { aggregateCouponCounts } from '../utils/couponCounter.js';
import dayjs from 'dayjs';

const router = Router();

/** GET /api/entries - List entries (admin: all, staff: own) */
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string) || '';
    const from = req.query.from as string;
    const to = req.query.to as string;

    // Build filter
    const filter: any = isAdmin ? {} : { createdBy: req.user?._id };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { ticketType: { $regex: search, $options: 'i' } }
      ];
    }

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }

    const entries = await Entry.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Entry.countDocuments(filter);

    // Sanitize entries for staff (remove amounts)
    const sanitized = entries.map((entry: any) => {
      if (!isAdmin) {
        delete entry.finalAmount;
        delete entry.cashAmount;
        delete entry.upiAmount;
        delete entry.otherAmount;
        delete entry.baseAmount;
        delete entry.kidDiscount;
        delete entry.additionalDiscount;
      }
      return entry;
    });

    res.json({ entries: sanitized, total });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
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
    
    const entry = new Entry({
      ...body,
      totalPeople,
      createdBy: req.user._id,
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

    // Get today's entries and all entries for coupon counting
    const [todayCount, totalCount, todayEntries, allEntries] = await Promise.all([
      Entry.countDocuments(todayStaffFilter),
      Entry.countDocuments(staffFilter),
      Entry.find(todayStaffFilter).lean(),
      Entry.find(staffFilter).lean(),
    ]);

    // Calculate coupon counts using the utility function
    const todayCouponCounts = aggregateCouponCounts(todayEntries);
    const totalCouponCounts = aggregateCouponCounts(allEntries);
    
    // Manual calculations for stats
    const manualTodayStats = {
      totalPeople: todayEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0),
      adults: todayEntries.reduce((sum, e) => sum + (e.adults || 0), 0),
      kids: todayEntries.reduce((sum, e) => sum + (e.kids || 0), 0),
      finalAmount: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      cashAmount: todayEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0),
      upiAmount: todayEntries.reduce((sum, e) => sum + (e.upiAmount || 0), 0),
      kidDiscount: todayEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
      additionalDiscount: todayEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0),
    };
    
    const manualTotalStats = {
      totalPeople: allEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0),
      adults: allEntries.reduce((sum, e) => sum + (e.adults || 0), 0),
      kids: allEntries.reduce((sum, e) => sum + (e.kids || 0), 0),
      finalAmount: allEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      cashAmount: allEntries.reduce((sum, e) => sum + (e.cashAmount || 0), 0),
      upiAmount: allEntries.reduce((sum, e) => sum + (e.upiAmount || 0), 0),
      kidDiscount: allEntries.reduce((sum, e) => sum + (e.kidDiscount || 0), 0),
      additionalDiscount: allEntries.reduce((sum, e) => sum + (e.additionalDiscount || 0), 0),
    };
    
    const result: Record<string, unknown> = {
      todayEntries: todayCount,
      totalEntries: totalCount,
      todayPeople: manualTodayStats.totalPeople,
      totalPeople: manualTotalStats.totalPeople,
      todayAdults: manualTodayStats.adults,
      totalAdults: manualTotalStats.adults,
      todayKids: manualTodayStats.kids,
      totalKids: manualTotalStats.kids,
      // Add detailed ticket type counts with adults/kids breakdown
      today150: todayEntries.filter(e => e.ticketType === '150').length,
      total150: allEntries.filter(e => e.ticketType === '150').length,
      today150Adults: todayEntries.filter(e => e.ticketType === '150').reduce((sum, e) => sum + (e.adults || 0), 0),
      total150Adults: allEntries.filter(e => e.ticketType === '150').reduce((sum, e) => sum + (e.adults || 0), 0),
      today150Kids: todayEntries.filter(e => e.ticketType === '150').reduce((sum, e) => sum + (e.kids || 0), 0),
      total150Kids: allEntries.filter(e => e.ticketType === '150').reduce((sum, e) => sum + (e.kids || 0), 0),
      // 300 ticket type
      today300: todayEntries.filter(e => e.ticketType === '300').length,
      total300: allEntries.filter(e => e.ticketType === '300').length,
      today300Adults: todayEntries.filter(e => e.ticketType === '300').reduce((sum, e) => sum + (e.adults || 0), 0),
      total300Adults: allEntries.filter(e => e.ticketType === '300').reduce((sum, e) => sum + (e.adults || 0), 0),
      today300Kids: todayEntries.filter(e => e.ticketType === '300').reduce((sum, e) => sum + (e.kids || 0), 0),
      total300Kids: allEntries.filter(e => e.ticketType === '300').reduce((sum, e) => sum + (e.kids || 0), 0),
      // 450 ticket type
      today450: todayEntries.filter(e => e.ticketType === '450').length,
      total450: allEntries.filter(e => e.ticketType === '450').length,
      today450Adults: todayEntries.filter(e => e.ticketType === '450').reduce((sum, e) => sum + (e.adults || 0), 0),
      total450Adults: allEntries.filter(e => e.ticketType === '450').reduce((sum, e) => sum + (e.adults || 0), 0),
      today450Kids: todayEntries.filter(e => e.ticketType === '450').reduce((sum, e) => sum + (e.kids || 0), 0),
      total450Kids: allEntries.filter(e => e.ticketType === '450').reduce((sum, e) => sum + (e.kids || 0), 0),
      // 600 ticket type
      today600: todayEntries.filter(e => e.ticketType === '600').length,
      total600: allEntries.filter(e => e.ticketType === '600').length,
      today600Adults: todayEntries.filter(e => e.ticketType === '600').reduce((sum, e) => sum + (e.adults || 0), 0),
      total600Adults: allEntries.filter(e => e.ticketType === '600').reduce((sum, e) => sum + (e.adults || 0), 0),
      today600Kids: todayEntries.filter(e => e.ticketType === '600').reduce((sum, e) => sum + (e.kids || 0), 0),
      total600Kids: allEntries.filter(e => e.ticketType === '600').reduce((sum, e) => sum + (e.kids || 0), 0),
      // 100 ticket type
      today100: todayEntries.filter(e => e.ticketType === '100').length,
      total100: allEntries.filter(e => e.ticketType === '100').length,
      today100Adults: todayEntries.filter(e => e.ticketType === '100').reduce((sum, e) => sum + (e.adults || 0), 0),
      total100Adults: allEntries.filter(e => e.ticketType === '100').reduce((sum, e) => sum + (e.adults || 0), 0),
      today100Kids: todayEntries.filter(e => e.ticketType === '100').reduce((sum, e) => sum + (e.kids || 0), 0),
      total100Kids: allEntries.filter(e => e.ticketType === '100').reduce((sum, e) => sum + (e.kids || 0), 0),
    };
    
    // Only provide financial data to admin
    if (isAdmin) {
      result.todayAmount = manualTodayStats.finalAmount;
      result.todayCash = manualTodayStats.cashAmount;
      result.todayUpi = manualTodayStats.upiAmount;
      result.totalAmount = manualTotalStats.finalAmount;
      result.totalCash = manualTotalStats.cashAmount;
      result.totalUpi = manualTotalStats.upiAmount;
      
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
    
    const monthly = await Entry.aggregate([
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 }, amount: { $sum: '$finalAmount' } } },
      { $sort: { _id: 1 } },
    ]);
    
    res.json({ last7Days: last7, ticketDistribution, monthly });
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

export default router;
