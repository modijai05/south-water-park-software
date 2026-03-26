/**
 * Comprehensive logging utility for production debugging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  component?: string;
  userId?: string;
  sessionId: string;
}

class Logger {
  private static sessionId: string = Logger.generateSessionId();
  private static isDevelopment = import.meta.env.DEV;
  private static logQueue: LogEntry[] = [];
  private static maxQueueSize = 100;

  private static generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static shouldLog(level: LogLevel): boolean {
    if (Logger.isDevelopment) return true;
    
    // In production, only log warnings and errors by default
    const productionLevels: LogLevel[] = ['warn', 'error'];
    return productionLevels.includes(level);
  }

  private static formatMessage(entry: LogEntry): string {
    const emoji = Logger.getEmojiForLevel(entry.level);
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const component = entry.component ? `[${entry.component}]` : '';
    const userId = entry.userId ? ` [User:${entry.userId.substr(0, 8)}...]` : '';
    
    return `${emoji} ${time} ${component}${userId} ${entry.level.toUpperCase()}: ${entry.message}`;
  }

  private static getEmojiForLevel(level: LogLevel): string {
    const emojis = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '🚨'
    };
    return emojis[level] || 'ℹ️';
  }

  private static addToQueue(entry: LogEntry): void {
    Logger.logQueue.push(entry);
    
    // Keep queue size limited
    if (Logger.logQueue.length > Logger.maxQueueSize) {
      Logger.logQueue.shift();
    }
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem('debug_logs', JSON.stringify(Logger.logQueue));
    } catch (error) {
      console.warn('Failed to store logs in localStorage:', error);
    }
  }

  static debug(message: string, data?: any, component?: string): void {
    if (!Logger.shouldLog('debug')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      data,
      component,
      sessionId: Logger.sessionId,
      userId: Logger.getCurrentUserId()
    };
    
    console.debug(Logger.formatMessage(entry), data);
    Logger.addToQueue(entry);
  }

  static info(message: string, data?: any, component?: string): void {
    if (!Logger.shouldLog('info')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      data,
      component,
      sessionId: Logger.sessionId,
      userId: Logger.getCurrentUserId()
    };
    
    console.info(Logger.formatMessage(entry), data);
    Logger.addToQueue(entry);
  }

  static warn(message: string, data?: any, component?: string): void {
    if (!Logger.shouldLog('warn')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      data,
      component,
      sessionId: Logger.sessionId,
      userId: Logger.getCurrentUserId()
    };
    
    console.warn(Logger.formatMessage(entry), data);
    Logger.addToQueue(entry);
  }

  static error(message: string, error?: Error | any, component?: string): void {
    if (!Logger.shouldLog('error')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      data: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      component,
      sessionId: Logger.sessionId,
      userId: Logger.getCurrentUserId()
    };
    
    console.error(Logger.formatMessage(entry), error);
    Logger.addToQueue(entry);
    
    // In production, send critical errors to monitoring service
    if (!Logger.isDevelopment) {
      Logger.sendToMonitoring(entry);
    }
  }

  private static getCurrentUserId(): string | undefined {
    try {
      const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
      return user.id || user.username;
    } catch {
      return undefined;
    }
  }

  private static sendToMonitoring(entry: LogEntry): void {
    // Send to external monitoring service (implement as needed)
    try {
      // Example: Send to Sentry, LogRocket, or custom endpoint
      if ((window as any).gtag) {
        (window as any).gtag('event', 'error', {
          event_category: 'javascript',
          event_label: entry.message,
          custom_map: {
            component: entry.component,
            sessionId: entry.sessionId
          }
        });
      }
    } catch (error) {
      console.warn('Failed to send error to monitoring:', error);
    }
  }

  // Specialized logging methods
  static api(method: string, url: string, status?: number, error?: any): void {
    Logger.info(`API Call: ${method} ${url}`, {
      method,
      url,
      status,
      error: error?.message || error
    }, 'API');
  }

  static forEach(collection: any, operation: string, index?: number, item?: any): void {
    Logger.debug(`forEach iteration: ${operation}`, {
      collectionLength: Array.isArray(collection) ? collection.length : 'not-array',
      collectionType: typeof collection,
      index,
      itemType: item ? typeof item : 'undefined'
    }, 'DataProcessing');
  }

  static state(component: string, state: string, data?: any): void {
    Logger.debug(`State change: ${state}`, {
      component,
      stateData: data
    }, 'State');
  }

  static performance(operation: string, duration: number, details?: any): void {
    Logger.info(`Performance: ${operation} took ${duration}ms`, {
      duration,
      operation,
      details
    }, 'Performance');
  }

  // Utility methods
  static getLogs(): LogEntry[] {
    try {
      const stored = localStorage.getItem('debug_logs');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static clearLogs(): void {
    Logger.logQueue = [];
    try {
      localStorage.removeItem('debug_logs');
    } catch (error) {
      console.warn('Failed to clear logs:', error);
    }
  }

  static exportLogs(): string {
    const logs = Logger.getLogs();
    const header = `South Water Park Debug Logs - ${new Date().toISOString()}\n`;
    const content = logs.map(log => 
      `${log.timestamp} [${log.level.toUpperCase()}] [${log.component || 'APP'}] ${log.message}\n` +
      (log.data ? `  Data: ${JSON.stringify(log.data, null, 2)}\n` : '')
    ).join('\n');
    
    return header + content;
  }

  // Initialize on load
  static {
    // Load existing logs from localStorage
    try {
      const stored = localStorage.getItem('debug_logs');
      if (stored) {
        Logger.logQueue = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load existing logs:', error);
    }

    // Set up global error handlers
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        Logger.error('Global JavaScript Error', event.error, 'GlobalHandler');
      });

      window.addEventListener('unhandledrejection', (event) => {
        Logger.error('Unhandled Promise Rejection', event.reason, 'PromiseHandler');
      });
    }
  }
}

export default Logger;
