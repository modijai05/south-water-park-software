// Test the food coupon calculation logic
const testEntries = [
  {
    _id: "1",
    name: "Fixed Food Test",
    adultsFastFoodCoupon: "4",
    kidsFastFoodCoupon: "3", 
    adultsMainFoodCoupon: "2",
    kidsMainFoodCoupon: "2",
    createdAt: new Date()
  },
  {
    _id: "2", 
    name: "Food Test Customer",
    adultsFastFoodCoupon: "2",
    kidsFastFoodCoupon: "1",
    adultsMainFoodCoupon: "1", 
    kidsMainFoodCoupon: "1",
    createdAt: new Date()
  },
  {
    _id: "3",
    name: "Empty Entry",
    adultsFastFoodCoupon: "",
    kidsFastFoodCoupon: "",
    adultsMainFoodCoupon: "",
    kidsMainFoodCoupon: "",
    createdAt: new Date()
  }
];

// Replicate the frontend calculation logic
const calculateStatsFromEntries = (entriesData) => {
  const today = new Date().toISOString().split('T')[0];
  const todayEntries = entriesData.filter(entry => 
    entry.createdAt.toISOString().split('T')[0] === today
  );
  
  console.log('Today entries:', todayEntries.length);
  
  // Calculate food coupon stats - handle empty strings by converting to numbers
  const totalAdultsFastFoodCoupons = entriesData.reduce((sum, entry) => sum + (parseInt(entry.adultsFastFoodCoupon) || 0), 0);
  const totalKidsFastFoodCoupons = entriesData.reduce((sum, entry) => sum + (parseInt(entry.kidsFastFoodCoupon) || 0), 0);
  const totalAdultsMainFoodCoupons = entriesData.reduce((sum, entry) => sum + (parseInt(entry.adultsMainFoodCoupon) || 0), 0);
  const totalKidsMainFoodCoupons = entriesData.reduce((sum, entry) => sum + (parseInt(entry.kidsMainFoodCoupon) || 0), 0);
  const totalFastFoodCoupons = totalAdultsFastFoodCoupons + totalKidsFastFoodCoupons;
  const totalMainFoodCoupons = totalAdultsMainFoodCoupons + totalKidsMainFoodCoupons;
  const totalFoodCoupons = totalFastFoodCoupons + totalMainFoodCoupons;
  
  const todayAdultsFastFoodCoupons = todayEntries.reduce((sum, entry) => sum + (parseInt(entry.adultsFastFoodCoupon) || 0), 0);
  const todayKidsFastFoodCoupons = todayEntries.reduce((sum, entry) => sum + (parseInt(entry.kidsFastFoodCoupon) || 0), 0);
  const todayAdultsMainFoodCoupons = todayEntries.reduce((sum, entry) => sum + (parseInt(entry.adultsMainFoodCoupon) || 0), 0);
  const todayKidsMainFoodCoupons = todayEntries.reduce((sum, entry) => sum + (parseInt(entry.kidsMainFoodCoupon) || 0), 0);
  const todayFastFoodCoupons = todayAdultsFastFoodCoupons + todayKidsFastFoodCoupons;
  const todayMainFoodCoupons = todayAdultsMainFoodCoupons + todayKidsMainFoodCoupons;
  const todayTotalFoodCoupons = todayFastFoodCoupons + todayMainFoodCoupons;
  
  return {
    todayTotalFoodCoupons,
    totalFoodCoupons,
    todayAdultsFastFoodCoupons,
    todayKidsFastFoodCoupons,
    todayAdultsMainFoodCoupons,
    todayKidsMainFoodCoupons,
    totalAdultsFastFoodCoupons,
    totalKidsFastFoodCoupons,
    totalAdultsMainFoodCoupons,
    totalKidsMainFoodCoupons
  };
};

const stats = calculateStatsFromEntries(testEntries);
console.log('Calculated stats:', stats);

console.log('\nExpected results:');
console.log('Today total: (4+2+3+1+2+1+2+1) = 16');
console.log('All-time total: (4+2+3+1+2+1+2+1) = 16');
