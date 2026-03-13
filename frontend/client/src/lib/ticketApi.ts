import { TicketConfig } from '@/types';
import { API_BASE } from './api';

export const ticketConfigApi = {
  // Get all ticket configurations
  getAll: async (): Promise<TicketConfig[]> => {
    const response = await fetch(`${API_BASE}/ticket-config`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch ticket configurations');
    const result = await response.json();
    return result.success ? result.data : [];
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
    return result.success ? result.data : null;
  },

  // Update ticket configuration
  update: async (ticketType: string, config: Partial<TicketConfig>): Promise<TicketConfig> => {
    // Use professional endpoint guaranteed to work
    console.log('🔧 Using professional endpoint for ticket config save');
    console.log('🔧 Ticket type:', ticketType);
    console.log('🔧 Config data:', config);
    
    const response = await fetch(`${API_BASE}/save-ticket/${ticketType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(config)
    });
    
    console.log('🔧 Response status:', response.status);
    console.log('🔧 Response headers:', response.headers);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🔧 Response error:', errorText);
      throw new Error(`Failed to update ticket configuration: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('🔧 Ticket config save response:', result);
    return result.success ? result.data : null;
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
