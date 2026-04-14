// Test the coupon range parsing logic

// Backend function (updated)
const countCouponsFromRange = (couponRange) => {
  if (!couponRange && couponRange !== 0) return 0;
  if (typeof couponRange === 'number') return couponRange;
  if (typeof couponRange === 'string') {
    const match = couponRange.match(/(\d+)-(\d+)/);
    if (match) {
      return parseInt(match[2]) - parseInt(match[1]) + 1;
    }
    // If it's a simple number as string
    const num = parseInt(couponRange);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Frontend function
const countCouponsFromRangeFrontend = (couponRange) => {
  if (!couponRange && couponRange !== 0) return 0;
  if (typeof couponRange === 'number') return couponRange;
  if (typeof couponRange === 'string') {
    const match = couponRange.match(/(\d+)-(\d+)/);
    if (match) {
      return parseInt(match[2]) - parseInt(match[1]) + 1;
    }
    // If it's a simple number as string
    const num = parseInt(couponRange);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

// Test cases
const testCases = [
  "1231-1233", // Should be 3
  "1001-1005", // Should be 5
  "2001-2001", // Should be 1
  "1231",     // Should be 1231 (simple number)
  "",         // Should be 0
  null,       // Should be 0
  undefined,  // Should be 0
  5,          // Should be 5 (number)
  "0",        // Should be 0
  "abc-def",  // Should be 0
];

console.log("Testing coupon range parsing logic:");
console.log("=====================================");

testCases.forEach((testCase, index) => {
  const backendResult = countCouponsFromRange(testCase);
  const frontendResult = countCouponsFromRangeFrontend(testCase);
  const match = backendResult === frontendResult ? "PASS" : "FAIL";
  
  console.log(`Test ${index + 1}: ${JSON.stringify(testCase)} -> Backend: ${backendResult}, Frontend: ${frontendResult} [${match}]`);
});

console.log("\nExpected results:");
console.log("1231-1233 -> 3 (1233 - 1231 + 1)");
console.log("1001-1005 -> 5 (1005 - 1001 + 1)");
console.log("2001-2001 -> 1 (2001 - 2001 + 1)");
console.log("1231 -> 1231 (simple number)");
console.log("Empty/null/undefined -> 0");
