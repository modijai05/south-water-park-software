const mongoose = require('mongoose');

export interface DatabaseHealth {
  connected: boolean;
  readyState: number;
  host?: string;
  name?: string;
  lastPing?: Date;
  error?: string;
}

class DatabaseHealthMonitor {
  private healthCheckInterval: any = null;
  private isHealthy = false;
  private lastHealthCheck: Date | null = null;

  startMonitoring(intervalMs: number = 30000) { // Check every 30 seconds
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth();
    }, intervalMs);

    // Initial health check
    this.checkHealth();
  }

  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private async checkHealth(): Promise<void> {
    try {
      if (mongoose.connection.readyState !== 1) {
        this.isHealthy = false;
        console.warn('⚠️ Database not connected, readyState:', mongoose.connection.readyState);
        return;
      }

      // Ping database to check connectivity
      await mongoose.connection.db.admin().ping();
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('💚 Database health check passed');
      }
    } catch (error) {
      this.isHealthy = false;
      console.error('❌ Database health check failed:', error instanceof Error ? error.message : error);
      
      // In production, we might want to attempt reconnection
      if (process.env.NODE_ENV === 'production') {
        console.log('🔄 Production mode: Attempting to reconnect...');
        // The connection retry logic in index.ts will handle reconnection
      }
    }
  }

  getHealth(): DatabaseHealth {
    return {
      connected: this.isHealthy,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      lastPing: this.lastHealthCheck || undefined,
      error: this.isHealthy ? undefined : 'Database connection unhealthy'
    };
  }

  isConnectionHealthy(): boolean {
    return this.isHealthy && mongoose.connection.readyState === 1;
  }
}

export const dbHealthMonitor = new DatabaseHealthMonitor();

// Health check endpoint middleware
export function requireHealthyDatabase(req: any, res: any, next: any) {
  if (!dbHealthMonitor.isConnectionHealthy()) {
    return res.status(503).json({ 
      message: 'Database temporarily unavailable',
      health: dbHealthMonitor.getHealth()
    });
  }
  next();
}
