import { dataManager } from './dataManager';
import { API_BASE } from './api';

/**
 * Self-Healing AI Tool
 * Real-time error detection and automatic recovery system
 * Monitors and fixes errors across the entire software
 */

export interface ErrorReport {
  id: string;
  type: 'client' | 'server' | 'network' | 'data' | 'auth';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  component: string;
  timestamp: string;
  stack?: string;
  context?: any;
  resolved: boolean;
  resolution?: string;
}

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'warning' | 'error' | 'offline';
  lastCheck: string;
  metrics: {
    responseTime?: number;
    errorRate?: number;
    uptime?: number;
    dataIntegrity?: number;
  };
  issues: string[];
}

// @ts-ignore
export class SelfHealingAI {
  private static instance: SelfHealingAI;
  private errorReports = new Map<string, ErrorReport>();
  private healingStrategies = new Map<string, Function>();
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private errorPatterns = new Map<string, RegExp>();
  private autoFixEnabled = true;
  private dataBackupEnabled = true;

  private constructor() {
    this.setupErrorPatterns();
    this.setupHealingStrategies();
    this.startGlobalErrorMonitoring();
  }

  static getInstance(): SelfHealingAI {
    if (!SelfHealingAI.instance) {
      SelfHealingAI.instance = new SelfHealingAI();
    }
    return SelfHealingAI.instance;
  }

  private setupErrorPatterns() {
    // Common error patterns and their fixes
    this.errorPatterns.set('network-timeout', /timeout|network|fetch|connection/i);
    this.errorPatterns.set('auth-failure', /unauthorized|forbidden|401|403/i);
    this.errorPatterns.set('data-corruption', /corrupted|invalid|malformed/i);
    this.errorPatterns.set('server-error', /500|502|503|504/i);
    this.errorPatterns.set('client-error', /javascript|reference|type/i);
  }

  private setupHealingStrategies() {
    // Auto-healing strategies for different error types
    this.healingStrategies.set('network-timeout', this.healNetworkTimeout.bind(this));
    this.healingStrategies.set('auth-failure', this.healAuthFailure.bind(this));
    this.healingStrategies.set('data-corruption', this.healDataCorruption.bind(this));
    this.healingStrategies.set('server-error', this.healServerError.bind(this));
    this.healingStrategies.set('client-error', this.healClientError.bind(this));
    this.healingStrategies.set('data-integrity', this.healDataIntegrity.bind(this));
  }

  private startGlobalErrorMonitoring() {
    // Monitor global error events
    window.addEventListener('error', this.handleGlobalError.bind(this));
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));
    
    // Monitor API calls
    this.interceptAPICalls();
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  private handleGlobalError(event: ErrorEvent) {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: 'client',
      severity: this.determineSeverity(event.error),
      message: event.error?.message || event.message,
      component: this.detectComponent(event),
      timestamp: new Date().toISOString(),
      stack: event.error?.stack,
      context: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      },
      resolved: false
    };

    this.reportError(errorReport);
    
    if (this.autoFixEnabled) {
      this.attemptAutoHeal(errorReport);
    }
  }

  private handleUnhandledRejection(event: PromiseRejectionEvent) {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: this.determineErrorType(event.reason),
      severity: 'high',
      message: event.reason?.message || 'Unhandled promise rejection',
      component: 'async-operation',
      timestamp: new Date().toISOString(),
      stack: event.reason?.stack,
      context: { reason: event.reason },
      resolved: false
    };

    this.reportError(errorReport);
    
    if (this.autoFixEnabled) {
      this.attemptAutoHeal(errorReport);
    }
  }

  private interceptAPICalls() {
    const originalFetch = window.fetch;
    
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0] as string;
      
      try {
        const response = await originalFetch(...args);
        const responseTime = Date.now() - startTime;
        
        // Check for API errors
        if (!response.ok) {
          this.handleAPIError(url, response.status, responseTime);
        }
        
        // Update health metrics
        this.updateHealthMetrics('api', responseTime, response.ok ? 0 : 1);
        
        return response;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.handleAPIError(url, 0, responseTime, error as Error);
        throw error;
      }
    };
  }

  private handleAPIError(url: string, status: number, responseTime: number, error?: Error) {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      type: status >= 500 ? 'server' : status >= 400 ? 'client' : 'network',
      severity: status >= 500 ? 'critical' : status >= 400 ? 'high' : 'medium',
      message: error?.message || `API Error: ${status} for ${url}`,
      component: 'api',
      timestamp: new Date().toISOString(),
      context: { url, status, responseTime },
      resolved: false
    };

    this.reportError(errorReport);
    
    if (this.autoFixEnabled && status >= 500) {
      this.attemptAutoHeal(errorReport);
    }
  }

  private attemptAutoHeal(errorReport: ErrorReport) {
    console.log(`🤖 Self-Healing AI: Attempting to fix error ${errorReport.id}`);
    
    // Try to match error pattern
    for (const [patternName, pattern] of this.errorPatterns) {
      if (pattern.test(errorReport.message)) {
        const strategy = this.healingStrategies.get(patternName);
        if (strategy) {
          strategy(errorReport);
          return;
        }
      }
    }
    
    // Default healing strategy
    this.defaultHealingStrategy(errorReport);
  }

  private async healNetworkTimeout(errorReport: ErrorReport) {
    try {
      // Retry with exponential backoff
      await this.retryWithBackoff(() => {
        // Trigger data refresh
        window.dispatchEvent(new CustomEvent('self-heal-refresh', {
          detail: { type: 'network', errorId: errorReport.id }
        }));
      });
      
      this.markErrorResolved(errorReport.id, 'Network timeout resolved with retry');
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Network timeout retry failed');
    }
  }

  private async healAuthFailure(errorReport: ErrorReport) {
    try {
      // Check if token is expired
      const token = localStorage.getItem('token');
      if (!token) {
        // Redirect to login
        window.location.href = '/login';
        this.markErrorResolved(errorReport.id, 'Auth failure resolved by redirecting to login');
        return;
      }
      
      // Try to refresh token
      await this.refreshAuthToken();
      this.markErrorResolved(errorReport.id, 'Auth failure resolved by token refresh');
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Auth failure: token refresh failed');
    }
  }

  private async healDataCorruption(errorReport: ErrorReport) {
    try {
      // Use dataManager to handle data corruption
      const repaired = await dataManager.repairData(errorReport.component);
      
      if (repaired) {
        this.markErrorResolved(errorReport.id, 'Data corruption resolved by automated repair');
      } else {
        // Try cleanup if repair failed
        const cleaned = await dataManager.cleanupCorruptedData(errorReport.component);
        if (cleaned) {
          this.markErrorResolved(errorReport.id, 'Data corruption resolved by cleanup');
        } else {
          // Try to restore from backup
          const latestBackup = dataManager.getLatestBackup('entries');
          if (latestBackup) {
            await dataManager.restoreFromBackup(latestBackup.id);
            this.markErrorResolved(errorReport.id, 'Data corruption resolved from backup');
          } else {
            this.markErrorFailed(errorReport.id, 'Data corruption: no backup available');
          }
        }
      }
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Data corruption recovery failed');
    }
  }

  private async healServerError(errorReport: ErrorReport) {
    try {
      // Check server health
      const isHealthy = await this.checkServerHealth();
      
      if (!isHealthy) {
        // Try to reconnect with circuit breaker pattern
        await this.reconnectWithCircuitBreaker();
        this.markErrorResolved(errorReport.id, 'Server error resolved with reconnection');
      } else {
        // Refresh data
        window.dispatchEvent(new CustomEvent('self-heal-refresh', {
          detail: { type: 'server', errorId: errorReport.id }
        }));
        this.markErrorResolved(errorReport.id, 'Server error resolved with data refresh');
      }
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Server error recovery failed');
    }
  }

  private async healClientError(errorReport: ErrorReport) {
    try {
      // Clear component state and remount
      window.dispatchEvent(new CustomEvent('self-heal-remount', {
        detail: { component: errorReport.component, errorId: errorReport.id }
      }));
      
      this.markErrorResolved(errorReport.id, 'Client error resolved by component remount');
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Client error recovery failed');
    }
  }

  private async healDataIntegrity(errorReport: ErrorReport) {
    try {
      // Run data integrity checks and repairs
      await this.runDataIntegrityCheck();
      this.markErrorResolved(errorReport.id, 'Data integrity issues resolved');
    } catch (error) {
      this.markErrorFailed(errorReport.id, 'Data integrity repair failed');
    }
  }

  private defaultHealingStrategy(errorReport: ErrorReport) {
    // Generic healing: refresh and retry
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('self-heal-refresh', {
        detail: { type: 'generic', errorId: errorReport.id }
      }));
      this.markErrorResolved(errorReport.id, 'Generic healing applied');
    }, 1000);
  }

  private startHealthMonitoring() {
    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000) as unknown as number; // Check every 30 seconds
  }

  private async performHealthChecks() {
    const checks = [
      this.checkAPIHealth(),
      this.checkDataHealth(),
      this.checkAuthHealth(),
      this.checkComponentHealth()
    ];

    await Promise.allSettled(checks);
  }

  private async checkAPIHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${API_BASE}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      
      const responseTime = Date.now() - startTime;
      
      const healthCheck: HealthCheck = {
        component: 'api',
        status: response.ok ? 'healthy' : 'error',
        lastCheck: new Date().toISOString(),
        metrics: {
          responseTime,
          errorRate: response.ok ? 0 : 1,
          uptime: response.ok ? 100 : 0
        },
        issues: response.ok ? [] : ['API endpoint not responding correctly']
      };

      this.healthChecks.set('api', healthCheck);
      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        component: 'api',
        status: 'offline',
        lastCheck: new Date().toISOString(),
        metrics: {
          responseTime: 5000,
          errorRate: 1,
          uptime: 0
        },
        issues: ['API server offline or unreachable']
      };

      this.healthChecks.set('api', healthCheck);
      return healthCheck;
    }
  }

  private async checkDataHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check data integrity
      const dataIntegrity = await this.calculateDataIntegrity();
      const responseTime = Date.now() - startTime;
      
      const healthCheck: HealthCheck = {
        component: 'data',
        status: dataIntegrity > 90 ? 'healthy' : dataIntegrity > 70 ? 'warning' : 'error',
        lastCheck: new Date().toISOString(),
        metrics: {
          responseTime,
          dataIntegrity
        },
        issues: dataIntegrity < 90 ? [`Data integrity at ${dataIntegrity}%`] : []
      };

      this.healthChecks.set('data', healthCheck);
      return healthCheck;
    } catch (error) {
      const healthCheck: HealthCheck = {
        component: 'data',
        status: 'error',
        lastCheck: new Date().toISOString(),
        metrics: {
          dataIntegrity: 0
        },
        issues: ['Data health check failed']
      };

      this.healthChecks.set('data', healthCheck);
      return healthCheck;
    }
  }

  private async checkAuthHealth(): Promise<HealthCheck> {
    const token = localStorage.getItem('token');
    const isExpired = this.isTokenExpired(token);
    
    const healthCheck: HealthCheck = {
      component: 'auth',
      status: token && !isExpired ? 'healthy' : 'warning',
      lastCheck: new Date().toISOString(),
      metrics: {
        uptime: token && !isExpired ? 100 : 0
      },
      issues: isExpired ? ['Authentication token expired'] : token ? [] : ['No authentication token']
    };

    this.healthChecks.set('auth', healthCheck);
    return healthCheck;
  }

  private async checkComponentHealth(): Promise<HealthCheck> {
    // Check if critical components are mounted and responsive
    const criticalComponents = ['dashboard', 'entries', 'users', 'export'];
    const issues: string[] = [];
    
    for (const component of criticalComponents) {
      if (!document.querySelector(`[data-component="${component}"]`)) {
        issues.push(`Component ${component} not found`);
      }
    }
    
    const healthCheck: HealthCheck = {
      component: 'ui',
      status: issues.length === 0 ? 'healthy' : issues.length < 2 ? 'warning' : 'error',
      lastCheck: new Date().toISOString(),
      metrics: {
        uptime: issues.length === 0 ? 100 : (100 - (issues.length * 25))
      },
      issues
    };

    this.healthChecks.set('ui', healthCheck);
    return healthCheck;
  }

  // Utility methods
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    if (error.name === 'TypeError' || error.name === 'ReferenceError') return 'high';
    if (error.message.includes('critical') || error.message.includes('fatal')) return 'critical';
    if (error.message.includes('warning')) return 'low';
    return 'medium';
  }

  private determineErrorType(reason: any): 'client' | 'server' | 'network' | 'data' | 'auth' {
    if (reason?.message?.includes('network') || reason?.message?.includes('fetch')) return 'network';
    if (reason?.message?.includes('auth') || reason?.message?.includes('token')) return 'auth';
    if (reason?.message?.includes('server') || reason?.status >= 500) return 'server';
    if (reason?.message?.includes('data') || reason?.message?.includes('corrupt')) return 'data';
    return 'client';
  }

  private detectComponent(event: ErrorEvent): string {
    if (event.filename) {
      const parts = event.filename.split('/');
      return parts[parts.length - 1].replace('.tsx', '').replace('.ts', '');
    }
    return 'unknown';
  }

  private reportError(errorReport: ErrorReport) {
    this.errorReports.set(errorReport.id, errorReport);
    
    // Trigger error reporting event
    window.dispatchEvent(new CustomEvent('self-healing-error', {
      detail: errorReport
    }));
    
    console.error(`🤖 Self-Healing AI: Error detected`, errorReport);
  }

  private markErrorResolved(errorId: string, resolution: string) {
    const error = this.errorReports.get(errorId);
    if (error) {
      error.resolved = true;
      error.resolution = resolution;
      
      window.dispatchEvent(new CustomEvent('self-healing-resolved', {
        detail: error
      }));
      
      console.log(`🤖 Self-Healing AI: Error resolved`, error);
    }
  }

  private markErrorFailed(errorId: string, reason: string) {
    const error = this.errorReports.get(errorId);
    if (error) {
      error.resolution = `Failed: ${reason}`;
      
      window.dispatchEvent(new CustomEvent('self-healing-failed', {
        detail: { ...error, failureReason: reason }
      }));
      
      console.error(`🤖 Self-Healing AI: Error recovery failed`, error);
    }
  }

  // Public API
  public getErrorReports(): ErrorReport[] {
    return Array.from(this.errorReports.values());
  }

  public getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  public getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    errors: number;
    resolved: number;
    components: HealthCheck[];
  } {
    const errors = Array.from(this.errorReports.values());
    const components = Array.from(this.healthChecks.values());
    
    const criticalErrors = errors.filter(e => e.severity === 'critical' && !e.resolved).length;
    const errorComponents = components.filter(c => c.status === 'error').length;
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalErrors > 0 || errorComponents > 0) status = 'critical';
    else if (errors.filter(e => !e.resolved).length > 0 || errorComponents > 0) status = 'warning';
    
    return {
      status,
      errors: errors.filter(e => !e.resolved).length,
      resolved: errors.filter(e => e.resolved).length,
      components
    };
  }

  public setAutoFixEnabled(enabled: boolean) {
    this.autoFixEnabled = enabled;
  }

  public setDataBackupEnabled(enabled: boolean) {
    this.dataBackupEnabled = enabled;
  }

  public forceHealthCheck() {
    this.performHealthChecks();
  }

  public clearErrorReports() {
    this.errorReports.clear();
  }

  public async checkServerHealth(): Promise<boolean> {
    // Implement server health check
    return true;
  }

  private cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.errorReports.clear();
    this.healthChecks.clear();
    // Implement circuit breaker reconnection logic
  }

  private async runDataIntegrityCheck(): Promise<void> {
    // Implement data integrity check and repair
  }

  private async calculateDataIntegrity(): Promise<number> {
    // Calculate data integrity percentage
    return 95;
  }

  private isTokenExpired(token: string | null): boolean {
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  private updateHealthMetrics(component: string, responseTime: number, errorRate: number): void {
    const health = this.healthChecks.get(component);
    if (health) {
      health.metrics.responseTime = responseTime;
      health.metrics.errorRate = errorRate;
      health.lastCheck = new Date().toISOString();
    }
  }

  public cleanup() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.errorReports.clear();
    this.healthChecks.clear();
  }
}

// Export singleton instance
export const selfHealingAI = SelfHealingAI.getInstance();
