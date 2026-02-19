# Comprehensive Test Entry Plan

## Test Entry Details

### Main Ticket
- **Name**: Test User
- **Mobile**: 9876543210
- **Ticket Type**: ₹300
- **Adults**: 2
- **Kids**: 1
- **Food Coupons**:
  - Adults Fast Food: AFF001, AFF002
  - Kids Fast Food: KFF001, KFF002, KFF003
  - Adults Main Food: AMF001, AMF002
  - Kids Main Food: KMF001, KMF002

### Upgrade Ticket 1
- **Ticket Type**: ₹450
- **Adults**: 1
- **Kids**: 2
- **Food Coupons**:
  - Adults Fast Food: AFF003
  - Kids Fast Food: KFF004, KFF005
  - Adults Main Food: AMF003
  - Kids Main Food: KMF003, KMF004

### Upgrade Ticket 2
- **Ticket Type**: ₹600
- **Adults**: 1
- **Kids**: 0
- **Food Coupons**:
  - Adults Fast Food: AFF004, AFF005
  - Kids Fast Food: (none)
  - Adults Main Food: AMF004, AMF005
  - Kids Main Food: (none)

### Payment Details
- **Additional Discount**: 150
- **Cash Amount**: 1000
- **UPI Amount**: 500
- **Notes**: Comprehensive test entry with food coupons and upgrades

## Expected Dashboard Results

### Price Sections Should Show:
- **₹100**: 0 entries, 0 adults, 0 kids
- **₹150**: 0 entries, 0 adults, 0 kids
- **₹300**: 1 entry, 2 adults, 1 kid
- **₹450**: 1 entry, 1 adult, 2 kids
- **₹600**: 1 entry, 1 adult, 0 kids

### Overall Statistics Should Show:
- **Today's Entries**: 1
- **Today's Adults**: 4 (2+1+1+0)
- **Today's Kids**: 3 (1+2+0)
- **Today's People**: 7
- **Today's Discounts**: ₹150

### Food Coupon Counts Should Show:
- **Adults Fast Food**: 5 total (AFF001, AFF002, AFF003, AFF004, AFF005)
- **Kids Fast Food**: 5 total (KFF001, KFF002, KFF003, KFF004, KFF005)
- **Adults Main Food**: 5 total (AMF001, AMF002, AMF003, AMF004, AMF005)
- **Kids Main Food**: 4 total (KMF001, KMF002, KMF003, KMF004)

## Test Steps
1. Navigate to /ticket
2. Fill in main ticket details
3. Add two upgrade tickets
4. Fill in all food coupon fields
5. Proceed to payment
6. Enter payment details
7. Submit and save
8. Navigate to admin dashboard
9. Verify all statistics are correct
10. Check that people are properly separated by price type
11. Verify discount calculations
12. Verify food coupon counts
