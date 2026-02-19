// Global Sync Coordinator - Ensures 24/7 real-time sync across all components
class GlobalSyncCoordinator {
  private static instance: GlobalSyncCoordinator;
  private syncInterval: number | null = null;
  private isRunning = false;
  private lastSyncTime: string = '';
  private syncErrors: number = 0;
  private maxErrors = 5;

  private constructor() {
    this.startSyncSystem();
  }

  static getInstance(): GlobalSyncCoordinator {
    if (!GlobalSyncCoordinator.instance) {
      GlobalSyncCoordinator.instance = new GlobalSyncCoordinator();
    }
    return GlobalSyncCoordinator.instance;
  }

  private startSyncSystem() {
    if (this.isRunning) return;

    console.log('🌐 Global Sync Coordinator: Starting 24/7 sync system...');
    this.isRunning = true;

    // Listen for all sync events
    this.setupEventListeners();

    // Start continuous sync every 3 seconds
    this.syncInterval = setInterval(() => {
      this.performGlobalSync();
    }, 3000) as unknown as number;

    // Initial sync
    this.performGlobalSync();
  }

  private setupEventListeners() {
    // Listen for entry events
    window.addEventListener('entry-created', this.handleSyncEvent.bind(this));
    window.addEventListener('entry-updated', this.handleSyncEvent.bind(this));
    window.addEventListener('entry-deleted', this.handleSyncEvent.bind(this));
    window.addEventListener('payment-completed', this.handleSyncEvent.bind(this));
    window.addEventListener('user-updated', this.handleSyncEvent.bind(this));

    console.log('🌐 Global Sync Coordinator: Event listeners setup complete');
  }

  private handleSyncEvent(event: CustomEvent) {
    console.log(`🌐 Global Sync Coordinator: Received ${event.type} event`);
    this.lastSyncTime = new Date().toISOString();
    this.syncErrors = 0; // Reset error count on successful sync

    // Immediately trigger global sync when events occur
    setTimeout(() => this.performGlobalSync(), 100);
  }

  private async performGlobalSync() {
    try {
      console.log('🌐 Global Sync Coordinator: Performing global sync...');
      
      // Dispatch global sync event to all components
      window.dispatchEvent(new CustomEvent('global-sync', {
        detail: {
          timestamp: new Date().toISOString(),
          lastSyncTime: this.lastSyncTime,
          syncErrors: this.syncErrors
        }
      }));

      // Dispatch specific sync events for different components
      window.dispatchEvent(new CustomEvent('dashboard-sync-required', {
        detail: { timestamp: new Date().toISOString() }
      }));

      window.dispatchEvent(new CustomEvent('export-sync-required', {
        detail: { timestamp: new Date().toISOString() }
      }));

      window.dispatchEvent(new CustomEvent('excel-sync-required', {
        detail: { timestamp: new Date().toISOString() }
      }));

      this.lastSyncTime = new Date().toISOString();
      console.log('✅ Global Sync Coordinator: Global sync completed');

    } catch (error) {
      this.syncErrors++;
      console.error('❌ Global Sync Coordinator: Sync error:', error);
      
      if (this.syncErrors >= this.maxErrors) {
        console.error('🚨 Global Sync Coordinator: Too many errors, stopping sync');
        this.stopSyncSystem();
      }
    }
  }

  private stopSyncSystem() {
    if (!this.isRunning) return;

    console.log('🌐 Global Sync Coordinator: Stopping sync system...');
    this.isRunning = false;

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Remove event listeners
    window.removeEventListener('entry-created', this.handleSyncEvent.bind(this));
    window.removeEventListener('entry-updated', this.handleSyncEvent.bind(this));
    window.removeEventListener('entry-deleted', this.handleSyncEvent.bind(this));
    window.removeEventListener('payment-completed', this.handleSyncEvent.bind(this));
    window.removeEventListener('user-updated', this.handleSyncEvent.bind(this));
  }

  public getSyncStatus() {
    return {
      isRunning: this.isRunning,
      lastSyncTime: this.lastSyncTime,
      syncErrors: this.syncErrors
    };
  }

  public restartSync() {
    this.stopSyncSystem();
    this.syncErrors = 0;
    this.startSyncSystem();
  }
}

// Initialize the global sync coordinator
const globalSyncCoordinator = GlobalSyncCoordinator.getInstance();

export default globalSyncCoordinator;
export { GlobalSyncCoordinator };
