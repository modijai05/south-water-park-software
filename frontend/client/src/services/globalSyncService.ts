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

  public static getInstance(): GlobalSyncService {
    if (!GlobalSyncService.instance) {
      GlobalSyncService.instance = new GlobalSyncService();
    }
    return GlobalSyncService.instance;
  }

  // Initialize daily reset at midnight
  private initializeDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    this.dailyResetInterval = setTimeout(() => {
      this.triggerDailyReset();
      // Set up recurring daily reset
      this.dailyResetInterval = setInterval(() => {
        this.triggerDailyReset();
      }, 24 * 60 * 60 * 1000); // Every 24 hours
    }, msUntilMidnight);

    console.log('🌅 GlobalSync: Daily reset scheduled for:', new Date(tomorrow));
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

  // Setup periodic sync every 30 seconds
  private setupPeriodicSync() {
    this.syncInterval = setInterval(() => {
      this.triggerGlobalSync();
    }, 30000); // 30 seconds
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
      clearInterval(this.dailyResetInterval);
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
