import { Router } from 'express';
import { Entry, IEntry } from '../models/Entry.js';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import dayjs from 'dayjs';

const router = Router();

/** GET /api/analytics/demand - Get ticket demand analysis */
router.get('/demand', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
    }

    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();

    const ticketTypes = ['150', '300', '450', '600', '100'];
    const demandAnalysis = ticketTypes.map(type => {
      const typeEntries = entries.filter(e => e.ticketType === type);
      const totalEntries = typeEntries.length;
      const revenue = typeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      const totalPeople = typeEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
      const avgPeoplePerEntry = totalEntries > 0 ? totalPeople / totalEntries : 0;
      
      // Calculate growth rate
      const midPoint = now.subtract(15, 'day');
      const recentEntries = typeEntries.filter(e => dayjs(e.createdAt).isAfter(midPoint));
      const olderEntries = typeEntries.filter(e => dayjs(e.createdAt).isBefore(midPoint));
      const growthRate = olderEntries.length > 0 
        ? ((recentEntries.length - olderEntries.length) / olderEntries.length) * 100 
        : 0;
      
      const marketShare = entries.length > 0 ? (totalEntries / entries.length) * 100 : 0;
      
      // Seasonality (weekend vs weekday)
      const weekendEntries = typeEntries.filter(e => {
        const day = dayjs(e.createdAt).day();
        return day === 0 || day === 6;
      });
      const seasonality = totalEntries > 0 ? (weekendEntries.length / totalEntries) * 100 : 0;

      return {
        ticketType: type,
        totalEntries,
        revenue,
        avgPeoplePerEntry: Math.round(avgPeoplePerEntry * 100) / 100,
        growthRate: Math.round(growthRate * 100) / 100,
        marketShare: Math.round(marketShare * 100) / 100,
        seasonality: Math.round(seasonality * 100) / 100
      };
    });

    res.json(demandAnalysis);
  } catch (error) {
    console.error('Demand analysis error:', error);
    res.status(500).json({ message: 'Failed to fetch demand analysis' });
  }
});

/** GET /api/analytics/upgrades - Get upgrade insights */
router.get('/upgrades', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
    }

    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();

    const upgradeMap = new Map<string, {
      fromTicket: string;
      toTicket: string;
      upgradeCount: number;
      upgradeRevenue: number;
      entries: any[];
    }>();

    entries.forEach(entry => {
      if (entry.upgrades && entry.upgrades.length > 0) {
        entry.upgrades.forEach((upgrade: any) => {
          const key = `${entry.ticketType}-${upgrade.ticketType}`;
          
          if (!upgradeMap.has(key)) {
            upgradeMap.set(key, {
              fromTicket: entry.ticketType,
              toTicket: upgrade.ticketType,
              upgradeCount: 0,
              upgradeRevenue: 0,
              entries: []
            });
          }
          
          const data = upgradeMap.get(key)!;
          data.upgradeCount++;
          data.upgradeRevenue += upgrade.finalAmount || 0;
          data.entries.push(entry);
        });
      }
    });

    const upgradeInsights = Array.from(upgradeMap.values()).map(insight => {
      const fromTicketEntries = entries.filter(e => e.ticketType === insight.fromTicket);
      const conversionRate = fromTicketEntries.length > 0 
        ? (insight.upgradeCount / fromTicketEntries.length) * 100 
        : 0;
      
      const avgUpgradeValue = insight.upgradeCount > 0 
        ? insight.upgradeRevenue / insight.upgradeCount 
        : 0;

      // Calculate average time to upgrade (in minutes)
      let totalTimeToUpgrade = 0;
      let validUpgrades = 0;
      
      insight.entries.forEach(entry => {
        if (entry.upgrades && entry.upgrades.length > 0) {
          const entryTime = dayjs(entry.createdAt);
          const upgradeTime = dayjs(entry.updatedAt || entry.createdAt);
          const diffMinutes = upgradeTime.diff(entryTime, 'minute');
          
          if (diffMinutes >= 0 && diffMinutes <= 1440) { // Within 24 hours
            totalTimeToUpgrade += diffMinutes;
            validUpgrades++;
          }
        }
      });
      
      const avgTimeToUpgrade = validUpgrades > 0 ? totalTimeToUpgrade / validUpgrades : 0;

      return {
        fromTicket: insight.fromTicket,
        toTicket: insight.toTicket,
        upgradeCount: insight.upgradeCount,
        upgradeRevenue: insight.upgradeRevenue,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgUpgradeValue: Math.round(avgUpgradeValue * 100) / 100,
        timeToUpgrade: Math.round(avgTimeToUpgrade * 100) / 100
      };
    }).sort((a, b) => b.upgradeCount - a.upgradeCount);

    res.json(upgradeInsights);
  } catch (error) {
    console.error('Upgrade insights error:', error);
    res.status(500).json({ message: 'Failed to fetch upgrade insights' });
  }
});

/** GET /api/analytics/timeseries - Get time series data */
router.get('/timeseries', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = dayjs();
    let startDate = now;
    let groupFormat = '%Y-%m-%d';
    
    switch (timeRange) {
      case '7d': 
        startDate = now.subtract(7, 'day');
        groupFormat = '%Y-%m-%d';
        break;
      case '30d': 
        startDate = now.subtract(30, 'day');
        groupFormat = '%Y-%m-%d';
        break;
      case '90d': 
        startDate = now.subtract(90, 'day');
        groupFormat = '%Y-%U'; // Weekly
        break;
      case '1y': 
        startDate = now.subtract(1, 'year');
        groupFormat = '%Y-%m'; // Monthly
        break;
    }

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate.toDate() }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupFormat,
              date: '$createdAt'
            }
          },
          totalRevenue: { $sum: '$finalAmount' },
          totalEntries: { $sum: 1 },
          '150': {
            $sum: {
              $cond: [{ $eq: ['$ticketType', '150'] }, '$finalAmount', 0]
            }
          },
          '300': {
            $sum: {
              $cond: [{ $eq: ['$ticketType', '300'] }, '$finalAmount', 0]
            }
          },
          '450': {
            $sum: {
              $cond: [{ $eq: ['$ticketType', '450'] }, '$finalAmount', 0]
            }
          },
          '600': {
            $sum: {
              $cond: [{ $eq: ['$ticketType', '600'] }, '$finalAmount', 0]
            }
          },
          '100': {
            $sum: {
              $cond: [{ $eq: ['$ticketType', '100'] }, '$finalAmount', 0]
            }
          }
        }
      },
      { $sort: { _id: 1 as const } }
    ];

    const result = await Entry.aggregate(pipeline);
    
    const timeSeriesData = result.map(item => ({
      date: item._id,
      totalRevenue: item.totalRevenue,
      totalEntries: item.totalEntries,
      '150': item['150'],
      '300': item['300'],
      '450': item['450'],
      '600': item['600'],
      '100': item['100']
    }));

    res.json(timeSeriesData);
  } catch (error) {
    console.error('Time series error:', error);
    res.status(500).json({ message: 'Failed to fetch time series data' });
  }
});

/** GET /api/analytics/peak-hours - Get peak hours analysis */
router.get('/peak-hours', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
    }

    const pipeline = [
      {
        $match: {
          createdAt: { $gte: startDate.toDate() }
        }
      },
      {
        $group: {
          _id: {
            $hour: '$createdAt'
          },
          entries: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
          ticketTypes: {
            $push: '$ticketType'
          }
        }
      },
      { $sort: { _id: 1 as const } }
    ];

    const result = await Entry.aggregate(pipeline);
    
    const peakHoursData = result.map(item => {
      const ticketTypeCounts: { [key: string]: number } = {};
      item.ticketTypes.forEach((type: string) => {
        ticketTypeCounts[type] = (ticketTypeCounts[type] || 0) + 1;
      });

      return {
        hour: item._id,
        entries: item.entries,
        revenue: item.revenue,
        ticketTypes: ticketTypeCounts
      };
    });

    // Fill in missing hours with zero values
    const completeHours = [];
    for (let i = 0; i < 24; i++) {
      const existing = peakHoursData.find(h => h.hour === i);
      completeHours.push(existing || {
        hour: i,
        entries: 0,
        revenue: 0,
        ticketTypes: {}
      });
    }

    res.json(completeHours);
  } catch (error) {
    console.error('Peak hours error:', error);
    res.status(500).json({ message: 'Failed to fetch peak hours data' });
  }
});

/** GET /api/analytics/customer-preferences - Get customer preferences analysis */
router.get('/customer-preferences', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    
    const now = dayjs();
    let startDate = now;
    
    switch (timeRange) {
      case '7d': startDate = now.subtract(7, 'day'); break;
      case '30d': startDate = now.subtract(30, 'day'); break;
      case '90d': startDate = now.subtract(90, 'day'); break;
      case '1y': startDate = now.subtract(1, 'year'); break;
    }

    const entries = await Entry.find({
      createdAt: { $gte: startDate.toDate() }
    }).lean();

    const preferences: { [key: string]: any } = {};
    
    entries.forEach(entry => {
      const type = entry.ticketType;
      if (!preferences[type]) {
        preferences[type] = {
          ticketType: type,
          adults: 0,
          kids: 0,
          groups: 0,
          soloVisitors: 0,
          couples: 0,
          families: 0,
          repeatCustomers: 0
        };
      }
      
      preferences[type].adults += entry.adults || 0;
      preferences[type].kids += entry.kids || 0;
      
      const totalPeople = (entry.adults || 0) + (entry.kids || 0);
      if (totalPeople === 1) {
        preferences[type].soloVisitors++;
      } else if (totalPeople === 2) {
        preferences[type].couples++;
      } else if (totalPeople > 2) {
        preferences[type].families++;
      }
    });

    const customerPreferences = Object.values(preferences);
    res.json(customerPreferences);
  } catch (error) {
    console.error('Customer preferences error:', error);
    res.status(500).json({ message: 'Failed to fetch customer preferences' });
  }
});

export { router as analyticsRouter };
