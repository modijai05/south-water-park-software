import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { Entry, IEntry } from '../models/Entry.js';
import dayjs from 'dayjs';

const router = Router();

interface TicketDemandData {
  ticketType: string;
  ticketName: string;
  totalBookings: number;
  totalPeople: number;
  totalAdults: number;
  totalKids: number;
  revenue: number;
  averagePeoplePerBooking: number;
  demandScore: number;
  upgradePotential: number;
  peakHours: string[];
  weeklyTrend: number[];
  monthlyTrend: number[];
}

interface UpgradeInsight {
  fromTicketType: string;
  toTicketType: string;
  upgradeCount: number;
  upgradeRevenue: number;
  upgradeRate: number;
  potentialRevenue: number;
}

router.get('/analysis', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = dayjs().subtract(days, 'day').startOf('day').toDate();
    
    // For demo purposes, get all entries (remove authentication requirement)
    const dateFilter = { createdAt: { $gte: startDate } };
    
    const entries = await Entry.find(dateFilter)
      .select('ticketType adults kids totalPeople finalAmount createdAt upgrades')
      .lean()
      .maxTimeMS(30000);
    
    // Ticket type definitions
    const ticketDefinitions = {
      '150': { name: 'Without Food 1hr', price: 150 },
      '300': { name: 'Without Food 3-4hr', price: 300 },
      '450': { name: 'With Fast Food', price: 450 },
      '600': { name: 'With Main Food', price: 600 },
      '100': { name: 'Sitting Only', price: 100 }
    };
    
    // Calculate demand data for each ticket type
    const demandData: TicketDemandData[] = [];
    
    for (const [ticketType, definition] of Object.entries(ticketDefinitions)) {
      const mainEntries = entries.filter(e => e.ticketType === ticketType);
      const upgradeEntries = entries.reduce((acc, entry) => {
        if (entry.upgrades) {
          entry.upgrades.forEach((upgrade: any) => {
            if (upgrade.ticketType === ticketType) {
              acc.push({
                adults: upgrade.adults || 0,
                kids: upgrade.kids || 0,
                finalAmount: definition.price * ((upgrade.adults || 0) + (upgrade.kids || 0))
              });
            }
          });
        }
        return acc;
      }, [] as any[]);
      
      const totalBookings = mainEntries.length + upgradeEntries.length;
      const totalAdults = mainEntries.reduce((sum, e) => sum + (e.adults || 0), 0) + 
                          upgradeEntries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const totalKids = mainEntries.reduce((sum, e) => sum + (e.kids || 0), 0) + 
                       upgradeEntries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const totalPeople = totalAdults + totalKids;
      const revenue = mainEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0) + 
                     upgradeEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0);
      
      // Calculate peak hours
      const hourlyData = new Array(24).fill(0);
      mainEntries.forEach(entry => {
        const hour = dayjs(entry.createdAt).hour();
        hourlyData[hour]++;
      });
      const peakHours = hourlyData
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(item => `${item.hour}:00`);
      
      // Calculate weekly trend (last 7 days)
      const weeklyTrend = new Array(7).fill(0);
      for (let i = 0; i < 7; i++) {
        const dayStart = dayjs().subtract(i, 'day').startOf('day').toDate();
        const dayEnd = dayjs().subtract(i, 'day').endOf('day').toDate();
        const dayEntries = mainEntries.filter(e => 
          e.createdAt >= dayStart && e.createdAt <= dayEnd
        );
        weeklyTrend[6 - i] = dayEntries.length;
      }
      
      // Calculate monthly trend (last 4 weeks)
      const monthlyTrend = new Array(4).fill(0);
      for (let i = 0; i < 4; i++) {
        const weekStart = dayjs().subtract(i * 7, 'day').startOf('day').toDate();
        const weekEnd = dayjs().subtract(i * 7 - 6, 'day').endOf('day').toDate();
        const weekEntries = mainEntries.filter(e => 
          e.createdAt >= weekStart && e.createdAt <= weekEnd
        );
        monthlyTrend[3 - i] = weekEntries.length;
      }
      
      // Calculate demand score (weighted by bookings, people, and revenue)
      const demandScore = (totalBookings * 0.3 + totalPeople * 0.4 + (revenue / definition.price) * 0.3);
      
      // Calculate upgrade potential (based on lower ticket types that could upgrade)
      const upgradePotential = calculateUpgradePotential(ticketType, entries, ticketDefinitions);
      
      demandData.push({
        ticketType,
        ticketName: definition.name,
        totalBookings,
        totalPeople,
        totalAdults,
        totalKids,
        revenue,
        averagePeoplePerBooking: totalBookings > 0 ? totalPeople / totalBookings : 0,
        demandScore,
        upgradePotential,
        peakHours,
        weeklyTrend,
        monthlyTrend
      });
    }
    
    // Sort by demand score
    demandData.sort((a, b) => b.demandScore - a.demandScore);
    
    // Calculate upgrade insights
    const upgradeInsights = calculateUpgradeInsights(entries, ticketDefinitions);
    
    // Generate recommendations
    const recommendations = generateRecommendations(demandData, upgradeInsights);
    
    res.json({
      period: `Last ${days} days`,
      highestDemand: demandData[0],
      ranking: demandData,
      upgradeInsights,
      recommendations,
      summary: {
        totalBookings: demandData.reduce((sum, d) => sum + d.totalBookings, 0),
        totalPeople: demandData.reduce((sum, d) => sum + d.totalPeople, 0),
        totalRevenue: demandData.reduce((sum, d) => sum + d.revenue, 0),
        mostPopularHour: findMostPopularHour(entries),
        growthRate: calculateGrowthRate(entries)
      }
    });
  } catch (err) {
    res.status(500).json({ message: (err as Error).message });
  }
});

function calculateUpgradePotential(ticketType: string, entries: any[], ticketDefinitions: any): number {
  const ticketPrice = ticketDefinitions[ticketType].price;
  const lowerTicketTypes = Object.entries(ticketDefinitions)
    .filter(([type, def]) => (def as any).price < ticketPrice)
    .map(([type]) => type);
  
  let potential = 0;
  lowerTicketTypes.forEach(lowerType => {
    const lowerEntries = entries.filter(e => e.ticketType === lowerType);
    potential += lowerEntries.reduce((sum, e) => sum + (e.totalPeople || 0), 0);
  });
  
  return potential;
}

function calculateUpgradeInsights(entries: any[], ticketDefinitions: any): UpgradeInsight[] {
  const insights: UpgradeInsight[] = [];
  
  Object.entries(ticketDefinitions).forEach(([fromType, fromDef]) => {
    Object.entries(ticketDefinitions).forEach(([toType, toDef]) => {
      if ((toDef as any).price > (fromDef as any).price) {
        const fromEntries = entries.filter(e => e.ticketType === fromType);
        const upgradeCount = fromEntries.reduce((count, entry) => {
          if (entry.upgrades) {
            const hasUpgrade = entry.upgrades.some((upgrade: any) => upgrade.ticketType === toType);
            return hasUpgrade ? count + 1 : count;
          }
          return count;
        }, 0);
        
        const upgradeRevenue = upgradeCount * ((toDef as any).price - (fromDef as any).price);
        const upgradeRate = fromEntries.length > 0 ? (upgradeCount / fromEntries.length) * 100 : 0;
        const potentialRevenue = (fromEntries.length - upgradeCount) * ((toDef as any).price - (fromDef as any).price);
        
        if (upgradeCount > 0) {
          insights.push({
            fromTicketType: fromType,
            toTicketType: toType,
            upgradeCount,
            upgradeRevenue,
            upgradeRate,
            potentialRevenue
          });
        }
      }
    });
  });
  
  return insights.sort((a, b) => b.upgradeRevenue - a.upgradeRevenue).slice(0, 10);
}

function generateRecommendations(demandData: TicketDemandData[], upgradeInsights: UpgradeInsight[]): string[] {
  const recommendations: string[] = [];
  
  // Highest demand recommendation
  const highest = demandData[0];
  recommendations.push(`${highest.ticketName} (₹${highest.ticketType}) has the highest demand with ${highest.totalBookings} bookings and ${highest.totalPeople} visitors.`);
  
  // Low demand recommendation
  const lowest = demandData[demandData.length - 1];
  if (lowest.totalBookings < highest.totalBookings * 0.3) {
    recommendations.push(`${lowest.ticketName} (₹${lowest.ticketType}) has low demand (${lowest.totalBookings} bookings). Consider promotional offers or bundling.`);
  }
  
  // Upgrade potential recommendation
  const highUpgradePotential = demandData.filter(d => d.upgradePotential > 10);
  if (highUpgradePotential.length > 0) {
    recommendations.push(`${highUpgradePotential[0].ticketName} has high upgrade potential (${highUpgradePotential[0].upgradePotential} people could upgrade from lower tiers).`);
  }
  
  // Peak hour recommendation
  const peakHours = demandData.flatMap(d => d.peakHours);
  const mostCommonHour = getMostCommonHour(peakHours);
  recommendations.push(`Peak booking time is around ${mostCommonHour}. Ensure adequate staffing during this period.`);
  
  // Upgrade path recommendation
  if (upgradeInsights.length > 0) {
    const topUpgrade = upgradeInsights[0];
    recommendations.push(`Most profitable upgrade path: ₹${topUpgrade.fromTicketType} → ₹${topUpgrade.toTicketType} (${topUpgrade.upgradeRate.toFixed(1)}% upgrade rate, ₹${topUpgrade.upgradeRevenue} revenue).`);
  }
  
  return recommendations;
}

function findMostPopularHour(entries: any[]): string {
  const hourlyData = new Array(24).fill(0);
  entries.forEach(entry => {
    const hour = dayjs(entry.createdAt).hour();
    hourlyData[hour]++;
  });
  
  const maxHour = hourlyData.indexOf(Math.max(...hourlyData));
  return `${maxHour}:00`;
}

function calculateGrowthRate(entries: any[]): number {
  const now = dayjs();
  const lastWeekStart = now.subtract(7, 'day').startOf('day');
  const lastWeekEnd = now.subtract(0, 'day').endOf('day');
  const prevWeekStart = now.subtract(14, 'day').startOf('day');
  const prevWeekEnd = now.subtract(7, 'day').endOf('day');
  
  const lastWeekCount = entries.filter(e => 
    dayjs(e.createdAt).isAfter(lastWeekStart) && dayjs(e.createdAt).isBefore(lastWeekEnd)
  ).length;
  
  const prevWeekCount = entries.filter(e => 
    dayjs(e.createdAt).isAfter(prevWeekStart) && dayjs(e.createdAt).isBefore(prevWeekEnd)
  ).length;
  
  if (prevWeekCount === 0) return 0;
  return ((lastWeekCount - prevWeekCount) / prevWeekCount) * 100;
}

function getMostCommonHour(hours: string[]): string {
  const hourCounts: Record<string, number> = {};
  hours.forEach(hour => {
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  return Object.entries(hourCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || '12:00';
}

export default router;
