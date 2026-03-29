import { TICKET_OPTIONS, KID_DISCOUNT, TicketConfig, DayWisePricing } from '@/types';
export { TICKET_OPTIONS };
import type { TicketType, UpgradeItem } from '@/types';
import { API_BASE } from './api';

// Cache for ticket configurations
let ticketConfigs: TicketConfig[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Function to invalidate cache manually
export function invalidateTicketConfigCache() {
  console.log('🔄 Invalidating ticket configuration cache...');
  ticketConfigs = [];
  lastFetchTime = 0;
}

// Listen for ticket config updates from server
if (typeof window !== 'undefined') {
  window.addEventListener('ticket-config-updated', () => {
    console.log('📡 Received ticket config update event, invalidating cache...');
    invalidateTicketConfigCache();
  });
}

// Helper function to check if today is Sunday
function isSunday(): boolean {
  const today = new Date();
  return today.getDay() === 0; // 0 = Sunday
}

// Helper function to get current day name
function getDayName(): 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday' {
  const today = new Date();
  const dayIndex = today.getDay();
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex] as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
}

// Export isSunday so other components can use it
export { isSunday, getDayName };

// Fetch ticket configurations from API - FIXED VERSION
async function fetchTicketConfigs(): Promise<TicketConfig[]> {
  const now = Date.now();
  if (ticketConfigs.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return ticketConfigs;
  }

  try {
    // Fetch full configs, not just current day pricing
    const response = await fetch(`${API_BASE}/ticket-config`);
    if (response.ok) {
      const apiResponse = await response.json();
      // Handle wrapped response format
      let configs = apiResponse;
      if (apiResponse && typeof apiResponse === 'object' && 'data' in apiResponse) {
        configs = apiResponse.data;
      }
      
      // Ensure configs is an array before calling .map()
      if (Array.isArray(configs)) {
        // Ensure proper dayWisePricing structure
        ticketConfigs = configs.map((config: any) => ({
          ...config,
          dayWisePricing: config.dayWisePricing || []
        }));
        lastFetchTime = now;
      } else {
        console.warn('Ticket configs API did not return an array:', configs);
        // Use fallback if API returns non-array
        throw new Error('Invalid response format');
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to fetch ticket configs:', error);
    // Fallback to static TICKET_OPTIONS converted to TicketConfig format
    ticketConfigs = TICKET_OPTIONS.map(option => ({
      ticketType: option.value,
      basePrice: option.price,
      label: option.label.replace(/^₹\d+\s*–\s*/, ''),
      hasKids: option.hasKids,
      description: option.label,
      dayWisePricing: [],
      isActive: true,
      foodIncluded: option.label.includes('Food')
    }));
  }

  return ticketConfigs;
}

// Get current day name
function getDayNameForPricing(): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()];
}

// Helper function to get Sunday pricing (add ₹50 for 300, 450, 600 tickets)
function getSundayPrice(basePrice: number, ticketType: TicketType): number {
  if (!isSunday()) return basePrice;
  
  // Don't increase prices for 150 and 100 tickets
  if (ticketType === '150' || ticketType === '100') return basePrice;
  
  // Add ₹50 for 300, 450, 600 tickets
  return basePrice + 50;
}

export async function getTicketPrice(type: TicketType): Promise<number> {
  // Try to get from dynamic config first
  const configs = await fetchTicketConfigs();
  const config = configs.find(c => c.ticketType === type);
  
  if (config && config.dayWisePricing.length > 0) {
    // Get current day name
    const today = getDayName();
    const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
    
    if (todayPricing) {
      if (todayPricing.fixedAmount !== undefined) {
        return todayPricing.fixedAmount;
      }
      return Math.round(config.basePrice * todayPricing.priceMultiplier);
    }
    // If day-wise pricing exists but today is not enabled, use base price
    return config.basePrice;
  }
  
  // Fallback to static pricing with Sunday rule
  const basePrice = TICKET_OPTIONS.find((t) => t.value === type)?.price ?? 0;
  return getSundayPrice(basePrice, type);
}

export async function getTicketLabel(type: TicketType): Promise<string> {
  // Try to get from dynamic config first
  const configs = await fetchTicketConfigs();
  const config = configs.find(c => c.ticketType === type);
  
  if (config && config.dayWisePricing.length > 0) {
    // Get current day name
    const today = getDayName();
    const todayPricing = config.dayWisePricing.find(dp => dp.day === today && dp.enabled);
    
    if (todayPricing) {
      const finalPrice = todayPricing.fixedAmount !== undefined 
        ? todayPricing.fixedAmount 
        : Math.round(config.basePrice * todayPricing.priceMultiplier);
      
      const baseOption = TICKET_OPTIONS.find((t) => t.value === type);
      if (finalPrice !== config.basePrice) {
        const difference = finalPrice - config.basePrice;
        const label = baseOption?.label?.replace('₹' + config.basePrice, '') || config.label;
        const dayName = today.charAt(0).toUpperCase() + today.slice(1);
        if (difference > 0) {
          return `₹${finalPrice} – ${label} (+₹${difference} ${dayName})`;
        } else if (difference < 0) {
          return `₹${finalPrice} – ${label} (₹${Math.abs(difference)} OFF ${dayName})`;
        }
      }
      return `₹${finalPrice} – ${config.label}`;
    }
  }
  
  // Fallback to static label with Sunday rule
  const option = TICKET_OPTIONS.find((t) => t.value === type);
  const basePrice = option?.price ?? 0;
  const currentPrice = await getTicketPrice(type);
  
  // If it's Sunday and price is different, show the Sunday price
  if (isSunday() && currentPrice !== basePrice) {
    return `₹${currentPrice} – ${option?.label?.replace('₹', '')} (+₹50 Sunday)`;
  }
  
  return option?.label ?? type;
}

// Synchronous version for backward compatibility - FIXED with proper day-wise pricing
export function getTicketPriceSync(type: TicketType): number {
  // First try to get from cached ticket configs
  const config = ticketConfigs.find(t => t.ticketType === type);
  if (config) {
    // Use dynamic pricing from database
    const today = getDayNameForPricing();
    const dayPricing = config.dayWisePricing?.find(dp => dp.day === today);
    if (dayPricing && dayPricing.enabled) {
      if (dayPricing.fixedAmount !== undefined) {
        return dayPricing.fixedAmount;
      } else {
        return Math.round(config.basePrice * dayPricing.priceMultiplier);
      }
    }
    // Fallback to base price if no day-wise pricing or disabled
    return config.basePrice;
  }
  
  // Fallback to static price if no config found
  const basePrice = TICKET_OPTIONS.find((t) => t.value === type)?.price ?? 0;
  return getSundayPrice(basePrice, type);
}

export function getTicketLabelSync(type: TicketType): string {
  const option = TICKET_OPTIONS.find((t) => t.value === type);
  const basePrice = option?.price ?? 0;
  const currentPrice = getTicketPriceSync(type);
  
  // If it's Sunday and price is different, show the Sunday price
  if (isSunday() && currentPrice !== basePrice) {
    return `₹${currentPrice} – ${option?.label?.replace('₹', '')} (+₹50 Sunday)`;
  }
  
  return option?.label ?? type;
}

export function getHigherTicketTypes(current: TicketType): TicketType[] {
  const prices = ['100', '150', '300', '450', '600'] as TicketType[];
  const idx = prices.indexOf(current);
  return idx < 0 ? [] : prices.slice(idx + 1);
}

/** Base amount from main ticket + upgrades; kidDiscount = 100 per kid; additionalDiscount from form. */
export async function computeAmounts(
  ticketType: TicketType,
  adults: number,
  kids: number,
  upgrades: UpgradeItem[],
  additionalDiscount: number
): Promise<{ baseAmount: number; kidDiscount: number; totalPeople: number; finalAmount: number }> {
  const mainPrice = await getTicketPrice(ticketType);
  const option = TICKET_OPTIONS.find((t) => t.value === ticketType);
  const mainHasKids = option?.hasKids ?? true;

  let baseAmount = adults * mainPrice + (mainHasKids ? kids * mainPrice : 0);
  // For 150 and 100 ticket types, totalPeople should only include adults (no kids allowed)
  let totalPeople = (ticketType === '150' || ticketType === '100') ? adults : adults + (mainHasKids ? kids : 0);

  for (const u of upgrades) {
    const upPrice = await getTicketPrice(u.ticketType);
    baseAmount += u.adults * upPrice + u.kids * upPrice;
    totalPeople += u.adults + u.kids;
  }

  const upgradeKids = upgrades.reduce((s, u) => s + (u.kids ?? 0), 0);
  const kidCount = (option?.hasKids ? kids : 0) + upgradeKids;
  const kidDiscount = kidCount * KID_DISCOUNT;
  const finalAmount = Math.max(0, baseAmount - kidDiscount - additionalDiscount);

  return { baseAmount, kidDiscount, totalPeople, finalAmount };
}

// Synchronous version for backward compatibility
export function computeAmountsSync(
  ticketType: TicketType,
  adults: number,
  kids: number,
  upgrades: UpgradeItem[],
  additionalDiscount: number
): { baseAmount: number; kidDiscount: number; totalPeople: number; finalAmount: number } {
  const mainPrice = getTicketPriceSync(ticketType);
  const option = TICKET_OPTIONS.find((t) => t.value === ticketType);
  const mainHasKids = option?.hasKids ?? true;

  let baseAmount = adults * mainPrice + (mainHasKids ? kids * mainPrice : 0);
  // For 150 and 100 ticket types, totalPeople should only include adults (no kids allowed)
  let totalPeople = (ticketType === '150' || ticketType === '100') ? adults : adults + (mainHasKids ? kids : 0);

  for (const u of upgrades) {
    const upPrice = getTicketPriceSync(u.ticketType);
    baseAmount += u.adults * upPrice + u.kids * upPrice;
    totalPeople += u.adults + u.kids;
  }

  const upgradeKids = upgrades.reduce((s, u) => s + (u.kids ?? 0), 0);
  const kidCount = (option?.hasKids ? kids : 0) + upgradeKids;
  const kidDiscount = kidCount * KID_DISCOUNT;
  const finalAmount = Math.max(0, baseAmount - kidDiscount - additionalDiscount);

  return { baseAmount, kidDiscount, totalPeople, finalAmount };
}
