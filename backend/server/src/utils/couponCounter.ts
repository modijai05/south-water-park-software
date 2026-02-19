/**
 * Food Coupon Range Counter Utility
 * Counts the number of coupons from range strings like "4201-5205"
 */

export interface CouponCount {
  adultsFastFood: number;
  kidsFastFood: number;
  adultsMainFood: number;
  kidsMainFood: number;
  totalFastFood: number;
  totalMainFood: number;
  totalCoupons: number;
}

/**
 * Count coupons from a range string (e.g., "4201-5205" returns 5)
 */
export function countCouponsFromRange(range?: string): number {
  if (!range || typeof range !== 'string') {
    return 0;
  }

  // Remove any whitespace and split by hyphen
  const cleanRange = range.trim();
  if (!cleanRange.includes('-')) {
    // If it's a single number, count as 1
    const num = parseInt(cleanRange);
    return isNaN(num) ? 0 : 1;
  }

  const [start, end] = cleanRange.split('-').map(s => s.trim());
  const startNum = parseInt(start);
  const endNum = parseInt(end);

  // Validate the range
  if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) {
    return 0;
  }

  // Calculate the count (inclusive range)
  return endNum - startNum + 1;
}

/**
 * Calculate total coupon counts for an entry
 * Counts food coupons for 450 and 600 tickets, and from upgrades
 */
export function calculateCouponCounts(entry: {
  ticketType: string;
  adultsFastFoodCoupon?: string;
  kidsFastFoodCoupon?: string;
  adultsMainFoodCoupon?: string;
  kidsMainFoodCoupon?: string;
  upgrades?: Array<{
    ticketType: string;
    adultsFastFoodCoupon?: string;
    kidsFastFoodCoupon?: string;
    adultsMainFoodCoupon?: string;
    kidsMainFoodCoupon?: string;
  }>;
}): CouponCount {
  let adultsFastFood = 0;
  let kidsFastFood = 0;
  let adultsMainFood = 0;
  let kidsMainFood = 0;

  // Count food coupons from main ticket if it's 450 or 600
  const shouldCountMainFoodCoupons = entry.ticketType === '450' || entry.ticketType === '600';
  if (shouldCountMainFoodCoupons) {
    adultsFastFood += countCouponsFromRange(entry.adultsFastFoodCoupon);
    kidsFastFood += countCouponsFromRange(entry.kidsFastFoodCoupon);
    adultsMainFood += countCouponsFromRange(entry.adultsMainFoodCoupon);
    kidsMainFood += countCouponsFromRange(entry.kidsMainFoodCoupon);
  }

  // Count food coupons from upgrades if they are 450 or 600
  if (entry.upgrades && Array.isArray(entry.upgrades)) {
    entry.upgrades.forEach(upgrade => {
      const shouldCountUpgradeFoodCoupons = upgrade.ticketType === '450' || upgrade.ticketType === '600';
      if (shouldCountUpgradeFoodCoupons) {
        adultsFastFood += countCouponsFromRange(upgrade.adultsFastFoodCoupon);
        kidsFastFood += countCouponsFromRange(upgrade.kidsFastFoodCoupon);
        adultsMainFood += countCouponsFromRange(upgrade.adultsMainFoodCoupon);
        kidsMainFood += countCouponsFromRange(upgrade.kidsMainFoodCoupon);
      }
    });
  }

  const totalFastFood = adultsFastFood + kidsFastFood;
  const totalMainFood = adultsMainFood + kidsMainFood;
  const totalCoupons = totalFastFood + totalMainFood;

  return {
    adultsFastFood,
    kidsFastFood,
    adultsMainFood,
    kidsMainFood,
    totalFastFood,
    totalMainFood,
    totalCoupons
  };
}

/**
 * Aggregate coupon counts from multiple entries
 */
export function aggregateCouponCounts(entries: any[]): {
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
} {
  const totals = {
    adultsFastFood: 0,
    kidsFastFood: 0,
    adultsMainFood: 0,
    kidsMainFood: 0,
    totalFastFood: 0,
    totalMainFood: 0,
    totalCoupons: 0
  };

  entries.forEach(entry => {
    const counts = calculateCouponCounts(entry);
    
    // Add to totals
    totals.adultsFastFood += counts.adultsFastFood;
    totals.kidsFastFood += counts.kidsFastFood;
    totals.adultsMainFood += counts.adultsMainFood;
    totals.kidsMainFood += counts.kidsMainFood;
    totals.totalFastFood += counts.totalFastFood;
    totals.totalMainFood += counts.totalMainFood;
    totals.totalCoupons += counts.totalCoupons;
  });

  return {
    // When called with todayEntries, these represent today's totals
    todayAdultsFastFoodCoupons: totals.adultsFastFood,
    todayKidsFastFoodCoupons: totals.kidsFastFood,
    todayAdultsMainFoodCoupons: totals.adultsMainFood,
    todayKidsMainFoodCoupons: totals.kidsMainFood,
    todayTotalFastFoodCoupons: totals.totalFastFood,
    todayTotalMainFoodCoupons: totals.totalMainFood,
    todayTotalFoodCoupons: totals.totalCoupons,
    
    // When called with allEntries, these represent all-time totals
    totalAdultsFastFoodCoupons: totals.adultsFastFood,
    totalKidsFastFoodCoupons: totals.kidsFastFood,
    totalAdultsMainFoodCoupons: totals.adultsMainFood,
    totalKidsMainFoodCoupons: totals.kidsMainFood,
    totalFastFoodCoupons: totals.totalFastFood,
    totalMainFoodCoupons: totals.totalMainFood,
    totalFoodCoupons: totals.totalCoupons
  };
}
