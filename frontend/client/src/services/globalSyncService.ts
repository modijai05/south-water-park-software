// Global Real-Time Sync Service
// Ensures all dashboard components stay synchronized with real-time data

class GlobalSyncService {
  private static instance: GlobalSyncService;
  private listeners: Map<string, Function[]> = new Map();
  private lastSyncTime: number = 0;
  private syncInterval: NodeJS.Timeout | null = null;
  private dailyResetInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initializeDailyReset();
    this.setupPeriodicSync();
  }

  // Emergency complete reset (immediate fix)
  public emergencyResetAllData() {
    console.log('🚨🚨 EMERGENCY RESET: Clearing ALL data immediately');
    
    // Clear ALL localStorage
    localStorage.clear();
    
    // Clear all stats-related cache specifically
    localStorage.removeItem('lastResetDate');
    localStorage.removeItem('adminDashboardStats');
    localStorage.removeItem('staffDashboardStats');
    localStorage.removeItem('dashboardCache');
    localStorage.removeItem('ticketConfigs');
    localStorage.removeItem('recentEntries');
    localStorage.removeItem('searchResults');
    
    // Trigger multiple reset events
    this.triggerDailyReset();
    this.forceDailyResetNow();
    
    // Broadcast emergency reset
    this.broadcastEvent('emergency-reset-all', {
      timestamp: new Date().toISOString(),
      message: 'EMERGENCY: Complete data reset triggered',
      clearAll: true,
      immediate: true
    });
    
    // Dispatch DOM emergency reset
    window.dispatchEvent(new CustomEvent('emergency-reset-all', {
      detail: {
        timestamp: new Date().toISOString(),
        message: 'EMERGENCY RESET - Clear everything immediately',
        clearAll: true,
        immediate: true
      }
    }));
    
    console.log('🧹🧹 EMERGENCY RESET: All data cleared, events dispatched');
  }

  public static getInstance(): GlobalSyncService {
    if (!GlobalSyncService.instance) {
      GlobalSyncService.instance = new GlobalSyncService();
    }
    return GlobalSyncService.instance;
  }

  // Initialize daily reset at midnight
  private initializeDailyReset() {
    const checkAndTriggerReset = () => {
      const now = new Date();
      const today = now.toDateString();
      const storedDate = localStorage.getItem('lastResetDate');
      
      // Check if we need to reset (new day or no stored date)
      if (storedDate !== today) {
        console.log('🌅 GlobalSync: New day detected, triggering daily reset');
        this.triggerDailyReset();
        localStorage.setItem('lastResetDate', today);
      }
      
      // Schedule next check at next midnight
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      if (this.dailyResetInterval) {
        clearTimeout(this.dailyResetInterval);
      }
      
      this.dailyResetInterval = setTimeout(checkAndTriggerReset, msUntilMidnight);
      console.log('🌅 GlobalSync: Next daily reset scheduled for:', new Date(tomorrow));
    };
    
    // Trigger immediately on load
    checkAndTriggerReset();
  }

  // Trigger daily reset event
  private triggerDailyReset() {
    console.log('🌅 GlobalSync: Triggering daily reset for all dashboards');
    
    // Dispatch daily reset event
    window.dispatchEvent(new CustomEvent('daily-reset', {
      detail: {
        timestamp: new Date().toISOString(),
        source: 'global-sync-service'
      }
    }));

    // Trigger immediate refresh for all listeners
    this.broadcastEvent('daily-reset-complete', {
      timestamp: new Date().toISOString(),
      message: 'Daily performance data has been reset'
    });
  }

  // Force immediate daily reset (professional fix)
  public forceDailyResetNow() {
    console.log('🚨 GlobalSync: FORCE DAILY RESET TRIGGERED IMMEDIATELY');
    
    // Clear any existing localStorage date to force reset
    localStorage.removeItem('lastResetDate');
    
    // Clear all stats-related localStorage
    localStorage.removeItem('adminDashboardStats');
    localStorage.removeItem('staffDashboardStats');
    localStorage.removeItem('dashboardCache');
    
    // Trigger immediate reset
    this.triggerDailyReset();
    
    // Store today's date
    localStorage.setItem('lastResetDate', new Date().toDateString());
    
    // Broadcast force reset event with clear instruction
    this.broadcastEvent('force-daily-reset', {
      timestamp: new Date().toISOString(),
      message: 'Immediate daily reset triggered by professional developer',
      clearCache: true,
      forceRefresh: true
    });
    
    // Also dispatch DOM event for maximum compatibility
    window.dispatchEvent(new CustomEvent('force-daily-reset', {
      detail: {
        timestamp: new Date().toISOString(),
        message: 'FORCE RESET - Clear all data immediately',
        clearCache: true,
        forceRefresh: true
      }
    }));
    
    console.log('🧹 GlobalSync: All cache cleared, force reset events dispatched');
  }

  // Setup periodic sync every 60 seconds (reduced from 30 for performance)
  private setupPeriodicSync() {
    this.syncInterval = setInterval(() => {
      this.triggerGlobalSync();
    }, 60000); // 60 seconds instead of 30 for better performance
  }

  // Add event listener
  public addEventListener(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // Remove event listener
  public removeEventListener(event: string, callback: Function) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  // Broadcast event to all listeners
  public broadcastEvent(event: string, data?: any) {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`❌ GlobalSync: Error in event listener for ${event}:`, error);
        }
      });
    }

    // Also dispatch as DOM event for cross-component communication
    window.dispatchEvent(new CustomEvent(event, {
      detail: data || { timestamp: new Date().toISOString() }
    }));
  }

  // Trigger global sync for all dashboards
  public triggerGlobalSync() {
    const now = Date.now();
    
    // Throttle to prevent excessive syncs (minimum 5 seconds between syncs)
    if (now - this.lastSyncTime < 5000) {
      return;
    }
    
    this.lastSyncTime = now;
    
    console.log('🔄 GlobalSync: Triggering global sync for all dashboards');
    
    this.broadcastEvent('global-sync-triggered', {
      timestamp: new Date().toISOString(),
      source: 'global-sync-service'
    });
  }

  // Trigger immediate sync (for critical updates)
  public triggerImmediateSync(reason: string) {
    console.log(`🚀 GlobalSync: Immediate sync triggered - ${reason}`);
    
    this.broadcastEvent('immediate-sync-required', {
      timestamp: new Date().toISOString(),
      reason,
      source: 'global-sync-service'
    });
  }

  // Sync specific data type
  public syncDataTypes(dataTypes: string[]) {
    console.log('📊 GlobalSync: Syncing specific data types:', dataTypes);
    
    dataTypes.forEach(dataType => {
      this.broadcastEvent(`${dataType}-sync-required`, {
        timestamp: new Date().toISOString(),
        dataType
      });
    });
  }

  // Cleanup intervals and listeners
  public cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.dailyResetInterval) {
      clearTimeout(this.dailyResetInterval);
      this.dailyResetInterval = null;
    }
    
    this.listeners.clear();
    console.log('🧹 GlobalSync: Service cleaned up');
  }
}

// Export singleton instance
export const globalSyncService = GlobalSyncService.getInstance();

// Auto-initialize when module loads
console.log('🌐 GlobalSync: Real-time sync service initialized');
