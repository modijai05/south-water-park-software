/**
 * Food Coupon Range Counter Utility
 * Counts the number of coupons from range strings like "4201-5205"
 */

/**
 * Count coupons from a range string (e.g., "4201-5205" returns 5)
 */
function countCouponsFromRange(range) {
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
function calculateCouponCounts(entry) {
  const counts = {
    adultsFastFood: 0,
    kidsFastFood: 0,
    adultsMainFood: 0,
    kidsMainFood: 0,
    totalFastFood: 0,
    totalMainFood: 0,
    totalCoupons: 0
  };

  // Count coupons from main ticket (450 and 600 tickets include food)
  if (entry.ticketType === '450' || entry.ticketType === '600') {
    const isMainFood = entry.ticketType === '600';
    
    // Count main ticket coupons
    counts.adultsFastFood += countCouponsFromRange(entry.adultsFastFoodCoupon) || 0;
    counts.kidsFastFood += countCouponsFromRange(entry.kidsFastFoodCoupon) || 0;
    counts.adultsMainFood += countCouponsFromRange(entry.adultsMainFoodCoupon) || 0;
    counts.kidsMainFood += countCouponsFromRange(entry.kidsMainFoodCoupon) || 0;
  }

  // Count coupons from upgrades
  if (entry.upgrades && Array.isArray(entry.upgrades)) {
    (entry.upgrades || []).forEach(upgrade => {
      if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
        counts.adultsFastFood += countCouponsFromRange(upgrade.adultsFastFoodCoupon) || 0;
        counts.kidsFastFood += countCouponsFromRange(upgrade.kidsFastFoodCoupon) || 0;
        counts.adultsMainFood += countCouponsFromRange(upgrade.adultsMainFoodCoupon) || 0;
        counts.kidsMainFood += countCouponsFromRange(upgrade.kidsMainFoodCoupon) || 0;
      }
    });
  }

  // Calculate totals
  counts.totalFastFood = counts.adultsFastFood + counts.kidsFastFood;
  counts.totalMainFood = counts.adultsMainFood + counts.kidsMainFood;
  counts.totalCoupons = counts.totalFastFood + counts.totalMainFood;

  return counts;
}

/**
 * Aggregate coupon counts for multiple entries
 */
function aggregateCouponCounts(entries) {
  const totals = {
    adultsFastFood: 0,
    kidsFastFood: 0,
    adultsMainFood: 0,
    kidsMainFood: 0,
    totalFastFood: 0,
    totalMainFood: 0,
    totalCoupons: 0
  };

  if (!Array.isArray(entries)) {
    return totals;
  }

  (entries || []).forEach(entry => {
    const counts = calculateCouponCounts(entry);
    totals.adultsFastFood += counts.adultsFastFood;
    totals.kidsFastFood += counts.kidsFastFood;
    totals.adultsMainFood += counts.adultsMainFood;
    totals.kidsMainFood += counts.kidsMainFood;
    totals.totalFastFood += counts.totalFastFood;
    totals.totalMainFood += counts.totalMainFood;
    totals.totalCoupons += counts.totalCoupons;
  });

  return totals;
}

module.exports = {
  countCouponsFromRange,
  calculateCouponCounts,
  aggregateCouponCounts
};
