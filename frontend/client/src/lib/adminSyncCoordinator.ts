/**
 * Admin Panel Sync Coordinator
 * Ensures all admin sections are always synced with each other
 */

export class AdminSyncCoordinator {
  private static instance: AdminSyncCoordinator;
  private lastSyncTimestamps: Map<string, string> = new Map();
  private syncListeners: Map<string, Function[]> = new Map();
  private isGlobalSyncEnabled = true;
  private syncInterval: number | null = null;

  private constructor() {
    this.setupGlobalSyncEvents();
    this.startContinuousSync();
  }

  static getInstance(): AdminSyncCoordinator {
    if (!AdminSyncCoordinator.instance) {
      AdminSyncCoordinator.instance = new AdminSyncCoordinator();
    }
    return AdminSyncCoordinator.instance;
  }

  private setupGlobalSyncEvents() {
    // Listen for all admin-related events
    window.addEventListener('entry-created', this.handleAdminSync as EventListener);
    window.addEventListener('entry-updated', this.handleAdminSync as EventListener);
    window.addEventListener('entry-deleted', this.handleAdminSync as EventListener);
    window.addEventListener('user-updated', this.handleAdminSync as EventListener);
    window.addEventListener('dashboard-synced', this.handleAdminSync as EventListener);
    window.addEventListener('export-synced', this.handleAdminSync as EventListener);
    window.addEventListener('staff-synced', this.handleAdminSync as EventListener);
  }

  private handleAdminSync = (event: Event) => {
    if (!this.isGlobalSyncEnabled) return;

    const customEvent = event as CustomEvent;
    const source = customEvent.type;
    const timestamp = new Date().toISOString();

    // Update last sync timestamp for source
    this.lastSyncTimestamps.set(source, timestamp);

    // Trigger global admin sync event
    window.dispatchEvent(new CustomEvent('admin-global-sync', {
      detail: {
        source: source,
        timestamp: timestamp,
        data: customEvent.detail,
        allTimestamps: Object.fromEntries(this.lastSyncTimestamps)
      }
    }));

    // Force immediate sync for all admin sections
    this.forceAdminSectionSync();
  };

  private forceAdminSectionSync() {
    // Trigger sync events for all admin sections
    const adminSections = [
      'dashboard-refresh',
      'export-refresh', 
      'entries-refresh',
      'users-refresh',
      'staff-refresh'
    ];

    adminSections.forEach(section => {
      window.dispatchEvent(new CustomEvent(section, {
        detail: {
          timestamp: new Date().toISOString(),
          force: true
        }
      }));
    });
  }

  private startContinuousSync() {
    // Sync all admin sections every 10 seconds to ensure consistency
    this.syncInterval = setInterval(() => {
      if (this.isGlobalSyncEnabled) {
        this.forceAdminSectionSync();
      }
    }, 10000) as unknown as number;
  }

  // Register a section for sync events
  registerAdminSection(sectionId: string, syncCallback: Function) {
    if (!this.syncListeners.has(sectionId)) {
      this.syncListeners.set(sectionId, []);
    }
    this.syncListeners.get(sectionId)!.push(syncCallback);

    // Listen for global admin sync events
    const handleGlobalSync = (event: Event) => {
      const customEvent = event as CustomEvent;
      syncCallback(customEvent.detail);
    };

    window.addEventListener('admin-global-sync', handleGlobalSync);
    
    return () => {
      window.removeEventListener('admin-global-sync', handleGlobalSync);
      const listeners = this.syncListeners.get(sectionId);
      if (listeners) {
        const index = listeners.indexOf(syncCallback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  // Get sync status for all admin sections
  getAdminSyncStatus() {
    return {
      isGlobalSyncEnabled: this.isGlobalSyncEnabled,
      lastSyncTimestamps: Object.fromEntries(this.lastSyncTimestamps),
      registeredSections: Array.from(this.syncListeners.keys()),
      activeIntervals: this.syncInterval ? 1 : 0
    };
  }

  // Enable/disable global admin sync
  setGlobalAdminSyncEnabled(enabled: boolean) {
    this.isGlobalSyncEnabled = enabled;
    
    if (!enabled && this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    } else if (enabled && !this.syncInterval) {
      this.startContinuousSync();
    }
  }

  // Force immediate sync of all admin sections
  forceImmediateSync() {
    this.forceAdminSectionSync();
  }

  // Cleanup
  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.syncListeners.clear();
    this.lastSyncTimestamps.clear();
  }
}

// Export singleton instance
export const adminSyncCoordinator = AdminSyncCoordinator.getInstance();
