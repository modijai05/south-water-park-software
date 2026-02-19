/**
 * 24/7 Real-time Sync Manager
 * Coordinates real-time synchronization across all components
 */

export class SyncManager {
  private static instance: SyncManager;
  private syncIntervals: Map<string, number> = new Map();
  private listeners: Map<string, Function[]> = new Map();
  private isGlobalSyncEnabled = true;

  private constructor() {
    this.setupGlobalSyncEvents();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private setupGlobalSyncEvents() {
    // Listen for sync events from any component
    window.addEventListener('entry-created', this.handleGlobalSync as EventListener);
    window.addEventListener('entry-updated', this.handleGlobalSync as EventListener);
    window.addEventListener('entry-deleted', this.handleGlobalSync as EventListener);
    window.addEventListener('dashboard-synced', this.handleGlobalSync as EventListener);
    window.addEventListener('export-synced', this.handleGlobalSync as EventListener);
    window.addEventListener('staff-synced', this.handleGlobalSync as EventListener);
  }

  private handleGlobalSync = (event: Event) => {
    if (!this.isGlobalSyncEnabled) return;

    // Trigger global sync event for all components
    window.dispatchEvent(new CustomEvent('global-sync', {
      detail: {
        source: event.type,
        timestamp: new Date().toISOString(),
        data: (event as CustomEvent).detail
      }
    }));

    // Update last sync time
    this.updateLastSyncTime();
  };

  private updateLastSyncTime() {
    window.dispatchEvent(new CustomEvent('sync-time-updated', {
      detail: { timestamp: new Date().toISOString() }
    }));
  }

  // Register a component for continuous sync
  registerContinuousSync(componentId: string, syncCallback: Function, intervalMs: number = 15000) {
    // Clear existing interval if any
    if (this.syncIntervals.has(componentId)) {
      clearInterval(this.syncIntervals.get(componentId)!);
    }

    // Set up new interval
    if (this.isGlobalSyncEnabled) {
      const interval = setInterval(() => {
        if (this.isGlobalSyncEnabled) {
          syncCallback();
        }
      }, intervalMs) as unknown as number;
      
      this.syncIntervals.set(componentId, interval);
    }
  }

  // Unregister a component from continuous sync
  unregisterContinuousSync(componentId: string) {
    if (this.syncIntervals.has(componentId)) {
      clearInterval(this.syncIntervals.get(componentId)!);
      this.syncIntervals.delete(componentId);
    }
  }

  // Enable/disable global sync
  setGlobalSyncEnabled(enabled: boolean) {
    this.isGlobalSyncEnabled = enabled;
    
    if (!enabled) {
      // Clear all intervals
      this.syncIntervals.forEach(interval => clearInterval(interval));
      this.syncIntervals.clear();
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isGlobalSyncEnabled: this.isGlobalSyncEnabled,
      activeIntervals: this.syncIntervals.size,
      registeredComponents: Array.from(this.syncIntervals.keys())
    };
  }

  // Cleanup
  cleanup() {
    this.syncIntervals.forEach(interval => clearInterval(interval));
    this.syncIntervals.clear();
    this.listeners.clear();
  }
}

// Export singleton instance
export const syncManager = SyncManager.getInstance();
