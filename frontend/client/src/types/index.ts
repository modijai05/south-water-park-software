export type Role = 'admin' | 'staff';

export type TicketType = '150' | '300' | '450' | '600' | '100';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayWisePricing {
  day: DayOfWeek;
  priceMultiplier: number;
  fixedAmount?: number;
  enabled?: boolean;
}

export interface TicketConfig {
  _id?: string;
  ticketType: TicketType;
  basePrice: number;
  label: string;
  hasKids?: boolean;
  description?: string;
  dayWisePricing?: DayWisePricing[];
  enabled?: boolean;
  isActive?: boolean;
  maxAdults?: number;
  maxKids?: number;
  timeLimit?: number;
  foodIncluded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id?: string;
  id?: string;
  username: string;
  fullName?: string;
  role: Role;
  active?: boolean;
  email?: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface UpgradeItem {
  ticketType: TicketType;
  adults: number;
  kids: number;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
  finalAmount?: number;
}

export interface EntryFormData {
  name: string;
  mobile: string;
  ticketType: TicketType;
  adults: number;
  kids: number;
  upgrades: UpgradeItem[];
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
  additionalDiscount?: number;
}

export interface PaymentFormData {
  cashAmount: number;
  upiAmount: number;
  advanceAmount: number;
  additionalDiscount: number;
  otherAmount: number;
  notes?: string;
}

export interface EntryRecord {
  _id: string;
  id?: string;
  name: string;
  mobile: string;
  ticketType: TicketType;
  adults: number;
  kids: number;
  upgrades?: UpgradeItem[];
  totalPeople?: number;
  baseAmount?: number;
  kidDiscount?: number;
  additionalDiscount?: number;
  finalAmount?: number;
  cashAmount?: number;
  upiAmount?: number;
  advanceAmount?: number;
  otherAmount?: number;
  notes?: string;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
  receiptNumber?: string;
  createdAt: string;
  createdBy?: User | { username: string; fullName?: string };
  filledByFullName?: string;
  _updated?: boolean; // For tracking updated entries in real-time
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    entries: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Stats {
  todayEntries: number;
  totalEntries: number;
  todayPeople: number;
  totalPeople: number;
  adults: {
    today: number;
    total: number;
  };
  kids: {
    today: number;
    total: number;
  };
  cash: {
    today: number;
    total: number;
  };
  upi: {
    today: number;
    total: number;
  };
  advance: {
    today: number;
    total: number;
  };
  amount: {
    today: number;
    total: number;
  };
  today150: number;
  total150: number;
  today150Adults: number;
  total150Adults: number;
  today300: number;
  total300: number;
  today300Adults: number;
  today300Kids: number;
  today450: number;
  total450: number;
  today450Adults: number;
  total450Kids: number;
  today600: number;
  total600: number;
  today600Adults: number;
  total600Kids: number;
  today100: number;
  total100: number;
  today100Adults: number;
  today100Kids: number;
  // Food coupon statistics
  todayAdultsFastFoodCoupons: number;
  todayKidsFastFoodCoupons: number;
  todayAdultsMainFoodCoupons: number;
  todayKidsMainFoodCoupons: number;
  todayTotalFastFoodCoupons: number;
  todayTotalMainFoodCoupons: number;
  todayTotalFoodCoupons: number;
  totalAdultsFastFoodCoupons: number;
  totalKidsFastFoodCoupons: number;
  totalAdultsMainFoodCoupons: number;
  totalKidsMainFoodCoupons: number;
  totalFastFoodCoupons: number;
  totalMainFoodCoupons: number;
  totalFoodCoupons: number;
  // Performance metrics
  averageTicketValue: number;
  peakHour: string;
  conversionRate: number;
  // Discount statistics
  todayAdditionalDiscount: number;
  todayTotalDiscount: number;
  totalAdditionalDiscount: number;
  totalTotalDiscount: number;
}

export interface ChartData {
  last7Days: Array<{
    _id: string;
    count: number;
    amount: number;
  }>;
  ticketDistribution: Array<{
    _id: string;
    count: number;
  }>;
  monthly: Array<{
    _id: string;
    count: number;
    amount: number;
  }>;
}

export interface AnalyticsData {
  todayAnalytics: Array<{
    ticketType: string;
    revenue: number;
    entries: number;
  }>;
  historicalAnalytics: Array<{
    ticketType: string;
    revenue: number;
    entries: number;
  }>;
  summary: {
    today: {
      totalRevenue: number;
      totalEntries: number;
      averageTicketValue: number;
    };
    historical: {
      totalRevenue: number;
      totalEntries: number;
      averageTicketValue: number;
    };
  };
}

export interface DemandAnalysis {
  ticketType: string;
  totalEntries: number;
  revenue: number;
  avgPeoplePerEntry: number;
  growthRate: number;
  marketShare: number;
  seasonality: number;
}

export interface UpgradeInsight {
  fromTicket: string;
  toTicket: string;
  upgradeCount: number;
  upgradeRevenue: number;
  conversionRate: number;
  avgUpgradeValue: number;
  timeToUpgrade: number;
}

export interface TimeSeriesData {
  date: string;
  [key: string]: string | number;
}

export interface RevenueBreakdown {
  ticketType: string;
  revenue: number;
  percentage: number;
  entries: number;
}

export interface CustomerPreference {
  ticketType: string;
  adults: number;
  kids: number;
  groups: number;
  soloVisitors: number;
  repeatCustomers: number;
}

export interface PeakHourData {
  hour: number;
  entries: number;
  revenue: number;
  ticketTypes: Record<string, number>;
}

export interface CustomEventData {
  [key: string]: unknown;
  timestamp?: string;
  reason?: string;
  source?: string;
}

export interface UserLog {
  timestamp: string;
  success: boolean;
}

export const TICKET_OPTIONS: { value: TicketType; label: string; price: number; hasKids: boolean }[] = [
  { value: '150', label: '₹150 – Without Food (1 Hour)', price: 150, hasKids: false },
  { value: '300', label: '₹350 – Without Food (3–4 Hours)', price: 350, hasKids: true },
  { value: '450', label: '₹500 – With Fast Food (3–4 Hours)', price: 500, hasKids: true },
  { value: '600', label: '₹700 – With Main Food (4–5 Hours)', price: 700, hasKids: true },
  { value: '100', label: '₹100 – Sitting Only', price: 100, hasKids: false },
];

export const KID_DISCOUNT = 100;
