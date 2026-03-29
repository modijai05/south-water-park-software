// 🚀 PRODUCTION FIX: Temporary workaround for Render deployment delay
// This handles the fallback mode issue while Render deploys latest code

export interface ProductionFix {
  isFallbackMode: boolean;
  deploymentStatus: 'updating' | 'ready' | 'unknown';
  message: string;
}

export function detectProductionFallback(response: any): ProductionFix {
  // Check if response indicates fallback mode
  if (response?.data?.fallbackMode === true) {
    return {
      isFallbackMode: true,
      deploymentStatus: 'updating',
      message: '🔄 Backend is updating. Forms will submit properly but data display may be delayed.'
    };
  }
  
  // Check if response has proper structure
  if (response?.data?.stats && !response?.data?.fallbackMode) {
    return {
      isFallbackMode: false,
      deploymentStatus: 'ready',
      message: '✅ Backend is fully operational.'
    };
  }
  
  return {
    isFallbackMode: false,
    deploymentStatus: 'unknown',
    message: '⚠️ Backend status unknown. Please try again.'
  };
}

export function getFallbackStats() {
  return {
    todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
    todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
    todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
    todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
    today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
    total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
    today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
    today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
    today100Adults: 0, today100Kids: 0,
    total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
    total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
    total100Adults: 0, total100Kids: 0,
    // Food coupon stats
    todayAdultsFastFoodCoupons: 0, todayKidsFastFoodCoupons: 0,
    todayAdultsMainFoodCoupons: 0, todayKidsMainFoodCoupons: 0,
    todayTotalFastFoodCoupons: 0, todayTotalMainFoodCoupons: 0, todayTotalFoodCoupons: 0,
    totalAdultsFastFoodCoupons: 0, totalKidsFastFoodCoupons: 0,
    totalAdultsMainFoodCoupons: 0, totalKidsMainFoodCoupons: 0,
    totalFastFoodCoupons: 0, totalMainFoodCoupons: 0, totalFoodCoupons: 0,
    // Performance metrics
    averageTicketValue: 0, peakHour: 'N/A', conversionRate: 0,
    lastUpdated: new Date().toISOString(),
    dataFreshness: 'deployment-in-progress',
    source: 'professional-fix',
    syncStatus: 'updating'
  };
}

export function showProductionAlert(fix: ProductionFix) {
  if (fix.isFallbackMode) {
    console.log('🔄 PRODUCTION UPDATE:', fix.message);
    
    // Show user-friendly notification
    if (typeof window !== 'undefined') {
      const alertDiv = document.createElement('div');
      alertDiv.className = 'production-alert';
      alertDiv.innerHTML = `
        <div style="
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f59e0b;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 9999;
          font-family: system-ui;
          max-width: 300px;
        ">
          <strong>🔄 System Update</strong><br>
          ${fix.message}
        </div>
      `;
      document.body.appendChild(alertDiv);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (alertDiv.parentNode) {
          alertDiv.parentNode.removeChild(alertDiv);
        }
      }, 5000);
    }
  }
}
