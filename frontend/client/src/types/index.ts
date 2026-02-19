export type Role = 'admin' | 'staff';

export type TicketType = '150' | '300' | '450' | '600' | '100';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DayWisePricing {
  day: DayOfWeek;
  priceMultiplier: number;
  fixedAmount?: number;
  enabled: boolean;
}

export interface TicketConfig {
  ticketType: TicketType;
  basePrice: number;
  label: string;
  hasKids: boolean;
  description: string;
  dayWisePricing: DayWisePricing[];
  isActive: boolean;
  maxAdults?: number;
  maxKids?: number;
  timeLimit?: number;
  foodIncluded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  username: string;
  fullName?: string;
  role: Role;
}

export interface UpgradeItem {
  ticketType: TicketType;
  adults: number;
  kids: number;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
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
  totalPeople: number;
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
  createdAt: string;
  createdBy?: { username: string; fullName?: string };
  filledByFullName?: string;
}

export const TICKET_OPTIONS: { value: TicketType; label: string; price: number; hasKids: boolean }[] = [
  { value: '150', label: '₹150 – Without Food (1 Hour)', price: 150, hasKids: false },
  { value: '300', label: '₹300 – Without Food (3–4 Hours)', price: 300, hasKids: true },
  { value: '450', label: '₹450 – With Fast Food (3–4 Hours)', price: 450, hasKids: true },
  { value: '600', label: '₹600 – With Main Food (4–5 Hours)', price: 600, hasKids: true },
  { value: '100', label: '₹100 – Sitting Only', price: 100, hasKids: false },
];

export const KID_DISCOUNT = 100;
