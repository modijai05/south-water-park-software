const mongoose = require('mongoose');

class DatabaseHealthMonitor {
  constructor() {
    this.healthCheckInterval = null;
    this.isHealthy = false;
    this.lastHealthCheck = null;
  }

  startMonitoring(intervalMs = 30000) { // Check every 30 seconds
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

  async checkHealth() {
    try {
      if (mongoose.connection.readyState !== 1) {
        this.isHealthy = false;
        return;
      }

      // Ping database to check connectivity
      await mongoose.connection.db.admin().ping();
      
      this.isHealthy = true;
      this.lastHealthCheck = new Date();
      
      // Health check passed
    } catch (error) {
      this.isHealthy = false;
    }
  }

  getHealth() {
    return {
      connected: this.isHealthy,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      lastPing: this.lastHealthCheck || undefined,
      error: this.isHealthy ? undefined : 'Database connection unhealthy'
    };
  }

  isConnectionHealthy() {
    return this.isHealthy && mongoose.connection.readyState === 1;
  }
}

const dbHealthMonitor = new DatabaseHealthMonitor();

// Health check endpoint middleware
function requireHealthyDatabase(req, res, next) {
  if (!dbHealthMonitor.isConnectionHealthy()) {
    return res.status(503).json({ 
      message: 'Database temporarily unavailable',
      health: dbHealthMonitor.getHealth()
    });
  }
  next();
}

module.exports = { dbHealthMonitor, requireHealthyDatabase };
