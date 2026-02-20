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
    return response.json();
  },

  // Get single ticket configuration
  get: async (ticketType: string): Promise<TicketConfig> => {
    const response = await fetch(`${API_BASE}/ticket-config/${ticketType}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (!response.ok) throw new Error('Failed to fetch ticket configuration');
    return response.json();
  },

  // Update ticket configuration
  update: async (ticketType: string, config: Partial<TicketConfig>): Promise<TicketConfig> => {
    const response = await fetch(`${API_BASE}/ticket-config/${ticketType}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error('Failed to update ticket configuration');
    return response.json();
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
    const response = await fetch(`${API_BASE}/ticket-config/pricing/${day}`);
    if (!response.ok) throw new Error('Failed to fetch pricing');
    return response.json();
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
    return response.json();
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
    return response.json();
  }
};
