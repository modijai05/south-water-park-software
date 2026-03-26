import { TicketConfig } from '@/types';
import { API_BASE, api } from './api';

export const ticketConfigApi = {
  // Get all ticket configurations
  getAll: async (): Promise<TicketConfig[]> => {
    try {
      const response = await api<{ success: boolean; data: TicketConfig[] }>('/ticket-config');
      console.log('🎫 Ticket API Response:', response);
      
      // Handle both direct array and wrapped response formats
      if (response.success && Array.isArray(response.data)) {
        return response.data;
      } else if (Array.isArray(response)) {
        // Direct array response fallback
        return response;
      } else if (response && Array.isArray(response.data)) {
        return response.data;
      } else {
        console.warn('⚠️ Unexpected ticket config response format:', response);
        return [];
      }
    } catch (error) {
      console.error('❌ Ticket config fetch error:', error);
      return [];
    }
  },

  // Get single ticket configuration
  get: async (ticketType: string): Promise<TicketConfig> => {
    const response = await fetch(`${API_BASE}/ticket-config/${ticketType}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch ticket configuration');
    const result = await response.json();
    return (result && typeof result === 'object' && 'success' in result) ? (result.data || null) : null;
  },

  // Update ticket configuration
  update: async (ticketType: string, config: Partial<TicketConfig>): Promise<TicketConfig> => {
    // Use professional endpoint guaranteed to work
    console.log('🔧 Using professional endpoint for ticket config save');
    console.log('🔧 Ticket type:', ticketType);
    console.log('🔧 Config data:', config);
    
    const response = await api<{ success: boolean; data: TicketConfig; message: string }>(`/save-ticket/${ticketType}`, {
      method: 'PUT',
      body: JSON.stringify(config)
    });
    
    console.log('🔧 Ticket config save response:', response);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update ticket configuration');
    }
    
    return response.data;
  },

  // Delete ticket configuration
  delete: async (ticketType: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/ticket-config/${ticketType}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to delete ticket configuration');
  },

  // Get pricing for specific day
  getPricing: async (day: string): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/ticket-config/pricing/${day}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch pricing');
    const result = await response.json();
    return Array.isArray(result) ? result : [];
  },

  // Initialize default configurations
  initialize: async (): Promise<void> => {
    const response = await fetch(`${API_BASE}/ticket-config/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to initialize configurations');
  },

  // Export ticket configurations to Excel format
  exportToExcel: async (): Promise<any[]> => {
    const response = await fetch(`${API_BASE}/ticket-config/export`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to export ticket configurations');
    const result = await response.json();
    return Array.isArray(result) ? result : [];
  },

  // Import ticket configurations from Excel
  importFromExcel: async (data: any[]): Promise<{ message: string; results: any[]; totalProcessed: number; successCount: number; failureCount: number }> => {
    const response = await fetch(`${API_BASE}/ticket-config/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to import ticket configurations');
    const result = await response.json();
    return result.success ? result : { message: 'Import failed', results: [], totalProcessed: 0, successCount: 0, failureCount: 0 };
  }
};
