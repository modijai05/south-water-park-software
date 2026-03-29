// Simple Date-wise Sync Service
// Ensures dashboard components stay synchronized by date

import { entriesApi } from '@/lib/api';

class GlobalSyncService {
  private static instance: GlobalSyncService;
  private listeners: Map<string, Function[]> = new Map();
  private lastSyncDate: string = '';
  private syncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.setupDailySync();
  }

  // Simple daily sync based on date
  private setupDailySync() {
    const syncByDate = () => {
      const today = new Date().toLocaleDateString();
      
      // Only sync once per day
      if (this.lastSyncDate === today) {
        return;
      }
      
      console.log('📅 GlobalSync: Daily sync for', today);
      this.performDateSync();
      this.lastSyncDate = today;
    };

    // Check every minute for date change
    this.syncInterval = setInterval(syncByDate, 60000);
    
    // Run immediately
    syncByDate();
  }

  // Simple date-based sync
  private async performDateSync() {
    try {
      console.log('🔄 GlobalSync: Performing date-wise sync...');
      const syncData = await entriesApi.syncAll();
      
      if (syncData && syncData.stats) {
        console.log('✅ GlobalSync: Date sync completed');
        this.broadcastEvent('date-sync-complete', {
          date: new Date().toLocaleDateString(),
          stats: syncData.stats
        });
      }
    } catch (error) {
      console.error('❌ GlobalSync: Date sync failed:', error);
    }
  }

  // Simple broadcast event
  private broadcastEvent(event: string, data?: any) {
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

  // Trigger immediate sync for specific events
  public triggerImmediateSyncRequired(source: string = 'global-sync') {
    console.log(`⚡ GlobalSync: Immediate sync required from ${source}`);
    
    // Broadcast immediate sync required event
    this.broadcastEvent('immediate-sync-required', {
      source,
      timestamp: new Date().toISOString()
    });
    
    // Perform async sync in background
    this.performDateSync();
  }

  // Simple manual sync trigger
  public triggerSync() {
    console.log('🔄 GlobalSync: Manual sync triggered');
    this.performDateSync();
  }

  // Immediate sync trigger for real-time updates
  public triggerImmediateSync(source: string = 'manual') {
    console.log(`⚡ GlobalSync: Immediate sync triggered from ${source}`);
    
    // Broadcast immediate sync event for real-time listeners
    this.broadcastEvent('immediate-sync', {
      source,
      timestamp: new Date().toISOString()
    });

    // Perform async sync in background
    this.performDateSync();
  }

  // Sync specific data types
  public syncDataTypes(dataTypes: string[]) {
    console.log(`📊 GlobalSync: Syncing specific data types: ${dataTypes.join(', ')}`);
    
    // Broadcast data type specific sync events
    dataTypes.forEach(dataType => {
      this.broadcastEvent(`${dataType}-sync`, {
        dataType,
        timestamp: new Date().toISOString()
      });
    });

    // Also broadcast a general sync event
    this.broadcastEvent('data-types-synced', {
      dataTypes,
      timestamp: new Date().toISOString()
    });
  }

  // Get singleton instance
  public static getInstance(): GlobalSyncService {
    if (!GlobalSyncService.instance) {
      GlobalSyncService.instance = new GlobalSyncService();
    }
    return GlobalSyncService.instance;
  }

  // Cleanup
  public cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.listeners.clear();
    console.log('🧹 GlobalSync: Service cleaned up');
  }
}

// Export singleton instance
export const globalSyncService = GlobalSyncService.getInstance();

// Auto-initialize when module loads
console.log('🌐 GlobalSync: Simple date-wise sync service initialized');
