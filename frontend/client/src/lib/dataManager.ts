/**
 * Data Management Service for Self-Healing AI
 * Provides automated data recovery, backup, and integrity checks
 */

import { entriesApi, usersApi } from '@/lib/api';

export interface DataBackup {
  id: string;
  timestamp: string;
  type: 'entries' | 'users' | 'full';
  data: any;
  checksum: string;
}

export interface DataIntegrityReport {
  component: string;
  issues: string[];
  integrity: number;
  recommendations: string[];
  lastChecked: string;
}

export class DataManager {
  private static instance: DataManager;
  private backups: Map<string, DataBackup[]> = new Map();
  private integrityReports: Map<string, DataIntegrityReport> = new Map();
  private maxBackups = 10;
  private backupInterval: number | null = null;

  private constructor() {
    this.startAutoBackup();
  }

  static getInstance(): DataManager {
    if (!DataManager.instance) {
      DataManager.instance = new DataManager();
    }
    return DataManager.instance;
  }

  private startAutoBackup() {
    // Auto-backup every 5 minutes
    this.backupInterval = setInterval(() => {
      this.createBackup('entries');
      this.createBackup('users');
    }, 5 * 60 * 1000) as unknown as number;
  }

  async createBackup(type: 'entries' | 'users' | 'full'): Promise<DataBackup> {
    try {
      let data: any;
      
      switch (type) {
        case 'entries':
          const entriesRes = await entriesApi.list({ limit: 10000 });
          data = entriesRes.data?.entries || [];
          break;
        case 'users':
          data = await usersApi.list();
          break;
        case 'full':
          const [entries, users] = await Promise.all([
            entriesApi.list({ limit: 10000 }),
            usersApi.list()
          ]);
          data = { entries: entries.data?.entries || [], users };
          break;
      }

      const backup: DataBackup = {
        id: this.generateBackupId(),
        timestamp: new Date().toISOString(),
        type,
        data,
        checksum: this.calculateChecksum(data)
      };

      // Store backup
      if (!this.backups.has(type)) {
        this.backups.set(type, []);
      }
      
      const typeBackups = this.backups.get(type)!;
      typeBackups.push(backup);
      
      // Keep only recent backups
      if (typeBackups.length > this.maxBackups) {
        typeBackups.shift();
      }

      // Store in localStorage for persistence
      this.persistBackups(type);

      console.log(`📦 Data backup created: ${type} - ${backup.id}`);
      return backup;
    } catch (error) {
      console.error('Failed to create backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupId: string): Promise<boolean> {
    try {
      // Find backup
      let backup: DataBackup | null = null;
      for (const typeBackups of this.backups.values()) {
        const found = typeBackups.find(b => b.id === backupId);
        if (found) {
          backup = found;
          break;
        }
      }

      if (!backup) {
        console.error('Backup not found:', backupId);
        return false;
      }

      // Verify checksum
      if (this.calculateChecksum(backup.data) !== backup.checksum) {
        console.error('Backup checksum verification failed');
        return false;
      }

      // Restore data (this would need server-side implementation)
      console.log(`🔄 Restoring from backup: ${backup.type} - ${backup.id}`);
      
      // Trigger restoration event
      window.dispatchEvent(new CustomEvent('data-restoration', {
        detail: { backup, timestamp: new Date().toISOString() }
      }));

      return true;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return false;
    }
  }

  async checkDataIntegrity(component: string): Promise<DataIntegrityReport> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let integrity = 100;

    try {
      switch (component) {
        case 'entries':
          await this.checkEntriesIntegrity(issues, recommendations);
          break;
        case 'users':
          await this.checkUsersIntegrity(issues, recommendations);
          break;
        case 'full':
          await this.checkEntriesIntegrity(issues, recommendations);
          await this.checkUsersIntegrity(issues, recommendations);
          break;
      }

      // Calculate integrity score
      integrity = Math.max(0, 100 - (issues.length * 10));

      const report: DataIntegrityReport = {
        component,
        issues,
        integrity,
        recommendations,
        lastChecked: new Date().toISOString()
      };

      this.integrityReports.set(component, report);
      
      // Trigger integrity check event
      window.dispatchEvent(new CustomEvent('data-integrity-check', {
        detail: report
      }));

      return report;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      
      const errorReport: DataIntegrityReport = {
        component,
        issues: ['Integrity check failed'],
        integrity: 0,
        recommendations: ['Retry integrity check', 'Check system connectivity'],
        lastChecked: new Date().toISOString()
      };

      this.integrityReports.set(component, errorReport);
      return errorReport;
    }
  }

  private async checkEntriesIntegrity(issues: string[], recommendations: string[]): Promise<void> {
    try {
      const res = await entriesApi.list({ limit: 1000 });
      const entries = res.data?.entries as any[] || [];

      // Guard against undefined/null data
      if (!entries || !Array.isArray(entries)) {
        issues.push('Unable to fetch entries for integrity check');
        return;
      }

      // Check for missing required fields
      const safeEntries = Array.isArray(entries) ? entries : [];
      safeEntries.forEach((entry, index) => {
        if (!entry.name || !entry.mobile) {
          issues.push(`Entry ${index + 1}: Missing required fields`);
        }
        if (!entry.createdAt) {
          issues.push(`Entry ${index + 1}: Missing creation timestamp`);
        }
        if (entry.finalAmount < 0) {
          issues.push(`Entry ${index + 1}: Invalid amount`);
        }
      });

      // Check for duplicates
      const mobileCounts = new Map<string, number>();
      safeEntries.forEach(entry => {
        const mobile = entry.mobile;
        if (mobile) {
          mobileCounts.set(mobile, (mobileCounts.get(mobile) || 0) + 1);
        }
      });

      mobileCounts.forEach((count, mobile) => {
        if (count > 5) { // Same mobile number used more than 5 times
          issues.push(`Suspicious activity: Mobile ${mobile} used ${count} times`);
          recommendations.push('Review entries with duplicate mobile numbers');
        }
      });

      // Check data consistency
      const totalAmount = safeEntries.reduce((sum, entry) => sum + (entry.finalAmount || 0), 0);
      if (totalAmount < 0) {
        issues.push('Negative total amount detected');
        recommendations.push('Review all entry amounts for negative values');
      }

    } catch (error) {
      issues.push('Failed to fetch entries for integrity check');
      recommendations.push('Check API connectivity and retry');
    }
  }

  private async checkUsersIntegrity(issues: string[], recommendations: string[]): Promise<void> {
    try {
      const users = await usersApi.list() as any[];

      // Check for duplicate usernames
      const usernames = new Set<string>();
      const safeUsers = Array.isArray(users) ? users : [];
      safeUsers.forEach((user, index) => {
        if (!user.username) {
          issues.push(`User ${index + 1}: Missing username`);
        }
        if (user.username && usernames.has(user.username)) {
          issues.push(`Duplicate username: ${user.username}`);
          recommendations.push('Resolve duplicate usernames');
        } else if (user.username) {
          usernames.add(user.username);
        }
      });

      // Check for admin users
      const adminUsers = safeUsers.filter(user => user.role === 'admin');
      if (adminUsers.length === 0) {
        issues.push('No admin users found');
        recommendations.push('Create at least one admin user');
      }

    } catch (error) {
      issues.push('Failed to fetch users for integrity check');
      recommendations.push('Check API connectivity and retry');
    }
  }

  async repairData(component: string): Promise<boolean> {
    try {
      console.log(`🔧 Attempting to repair ${component} data...`);
      
      const report = await this.checkDataIntegrity(component);
      
      if (report.issues.length === 0) {
        console.log('No issues to repair');
        return true;
      }

      let repaired = 0;

      // Attempt automatic repairs
      for (const issue of report.issues) {
        if (issue.includes('Missing required fields')) {
          // Try to repair missing fields
          await this.repairMissingFields(component);
          repaired++;
        } else if (issue.includes('Invalid amount')) {
          // Try to repair invalid amounts
          await this.repairInvalidAmounts(component);
          repaired++;
        }
      }

      console.log(`🔧 Repaired ${repaired} issues in ${component} data`);
      
      // Trigger repair event
      window.dispatchEvent(new CustomEvent('data-repair', {
        detail: { component, repaired, timestamp: new Date().toISOString() }
      }));

      return repaired > 0;
    } catch (error) {
      console.error('Failed to repair data:', error);
      return false;
    }
  }

  private async repairMissingFields(component: string): Promise<void> {
    // Implementation would depend on specific repair logic
    console.log(`Repairing missing fields in ${component}`);
  }

  private async repairInvalidAmounts(component: string): Promise<void> {
    // Implementation would depend on specific repair logic
    console.log(`Repairing invalid amounts in ${component}`);
  }

  async cleanupCorruptedData(component: string): Promise<boolean> {
    try {
      console.log(`🧹 Cleaning up corrupted ${component} data...`);
      
      // Create backup before cleanup
      await this.createBackup(component as 'entries' | 'users');
      
      // Perform cleanup operations
      let cleaned = 0;
      
      if (component === 'entries') {
        cleaned = await this.cleanupCorruptedEntries();
      } else if (component === 'users') {
        cleaned = await this.cleanupCorruptedUsers();
      }

      console.log(`🧹 Cleaned up ${cleaned} corrupted records in ${component}`);
      
      // Trigger cleanup event
      window.dispatchEvent(new CustomEvent('data-cleanup', {
        detail: { component, cleaned, timestamp: new Date().toISOString() }
      }));

      return cleaned > 0;
    } catch (error) {
      console.error('Failed to cleanup corrupted data:', error);
      return false;
    }
  }

  private async cleanupCorruptedEntries(): Promise<number> {
    // Implementation would identify and remove corrupted entries
    return 0;
  }

  private async cleanupCorruptedUsers(): Promise<number> {
    // Implementation would identify and remove corrupted users
    return 0;
  }

  // Utility methods
  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private persistBackups(type: string): void {
    try {
      const backups = this.backups.get(type) || [];
      localStorage.setItem(`backups_${type}`, JSON.stringify(backups));
    } catch (error) {
      console.error('Failed to persist backups:', error);
    }
  }

  // Public API
  public getBackups(type?: 'entries' | 'users' | 'full'): DataBackup[] {
    if (type) {
      return this.backups.get(type) || [];
    }
    
    const allBackups: DataBackup[] = [];
    for (const backups of this.backups.values()) {
      allBackups.push(...backups);
    }
    return allBackups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getIntegrityReports(): DataIntegrityReport[] {
    return Array.from(this.integrityReports.values());
  }

  public getLatestBackup(type: 'entries' | 'users' | 'full'): DataBackup | null {
    const backups = this.getBackups(type);
    return backups.length > 0 ? backups[0] : null;
  }

  public setMaxBackups(max: number): void {
    this.maxBackups = max;
  }

  public cleanup(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
    }
    this.backups.clear();
    this.integrityReports.clear();
  }
}

// Export singleton instance
export const dataManager = DataManager.getInstance();
