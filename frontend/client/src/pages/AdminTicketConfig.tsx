import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/store/authStore';
import { ticketConfigApi } from '@/lib/ticketApi';

interface DayWisePricing {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  priceMultiplier: number;
  fixedAmount?: number;
  enabled: boolean;
}

interface TicketConfig {
  ticketType: '100' | '150' | '300' | '450' | '600';
  basePrice: number;
  label: string;
  hasKids: boolean;
  description: string;
  dayWisePricing: DayWisePricing[];
  isActive: boolean;
  maxAdults?: number;
  maxKids?: number;
  timeLimit?: number;
  foodIncluded?: boolean;
}

const days: DayWisePricing['day'][] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels = {
  monday: 'Monday',
  tuesday: 'Tuesday', 
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

export function AdminTicketConfig() {
  const { user } = useAuthStore();
  const [configs, setConfigs] = useState<TicketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTicket, setEditingTicket] = useState<string | null>(null);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  
  // Excel states
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<any>(null);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      console.log('🔄 AdminTicketConfig: Fetching configs...');
      const data = await ticketConfigApi.getAll();
      console.log('✅ AdminTicketConfig: Fetched configs:', data);
      
      // Ensure day-wise pricing has all required fields
      const processedData = data.map(config => ({
        ...config,
        dayWisePricing: config.dayWisePricing ? config.dayWisePricing.map(dp => ({
          day: dp.day,
          priceMultiplier: dp.priceMultiplier || 1.0,
          fixedAmount: dp.fixedAmount,
          enabled: dp.enabled !== undefined ? dp.enabled : true
        })) : days.map(day => ({
          day,
          priceMultiplier: 1.0,
          enabled: true
        }))
      }));
      
      setConfigs(processedData);
    } catch (error) {
      console.error('❌ AdminTicketConfig: Error fetching ticket configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaults = async () => {
    try {
      setSaving(true);
      await ticketConfigApi.initialize();
      await fetchConfigs();
        
        // Show success notification
        setSuccessNotification('✅ Default ticket configurations initialized successfully!');
        
        // Trigger real-time sync event for ticket forms with enhanced data
        console.log('🔄 AdminTicketConfig: Dispatching ticket-config-updated event', {
          action: 'initialize',
          timestamp: new Date().toISOString(),
          source: 'admin-config-initialize'
        });
        
        window.dispatchEvent(new CustomEvent('ticket-config-updated', {
          detail: { 
            action: 'initialize',
            timestamp: new Date().toISOString(),
            source: 'admin-config-initialize'
          }
        }));
        
        // Also trigger global sync for dashboards
        window.dispatchEvent(new CustomEvent('dashboard-synced', {
          detail: { 
            timestamp: new Date().toISOString(),
            source: 'ticket-config-initialize'
          }
        }));
        
        // Hide notification after 3 seconds
        setTimeout(() => {
          setSuccessNotification(null);
        }, 3000);
    } catch (error) {
      console.error('Error initializing configs:', error);
      setSuccessNotification('❌ Failed to initialize default configurations');
      setTimeout(() => {
        setSuccessNotification(null);
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = async (ticketType: string, config: Partial<TicketConfig>) => {
    try {
      setSaving(true);
      const updatedConfig = await ticketConfigApi.update(ticketType, config);
      
      await fetchConfigs();
      setEditingTicket(null);
      
      // Show success notification
      setSuccessNotification(`✅ ${config.label || ticketType} configuration updated successfully!`);
        
        // Trigger real-time sync event for ticket forms with enhanced data
        console.log('🔄 AdminTicketConfig: Dispatching ticket-config-updated event', {
          action: 'update',
          ticketType,
          config,
          timestamp: new Date().toISOString(),
          source: 'admin-config-update'
        });
        
        window.dispatchEvent(new CustomEvent('ticket-config-updated', {
          detail: { 
            action: 'update',
            ticketType,
            config,
            timestamp: new Date().toISOString(),
            source: 'admin-config-update'
          }
        }));
        
        // Also trigger global sync for dashboards
        window.dispatchEvent(new CustomEvent('dashboard-synced', {
          detail: { 
            timestamp: new Date().toISOString(),
            source: 'ticket-config-update'
          }
        }));
        
        // Hide notification after 3 seconds
        setTimeout(() => {
          setSuccessNotification(null);
        }, 3000);
    } catch (error) {
      console.error('Error updating config:', error);
      setSuccessNotification(`❌ Failed to update ${ticketType} configuration`);
      setTimeout(() => {
        setSuccessNotification(null);
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const updateDayPricing = (ticketType: string, day: DayWisePricing['day'], field: keyof DayWisePricing, value: any) => {
    setConfigs(prev => prev.map(config => {
      if (config.ticketType === ticketType) {
        const updatedDayWise = config.dayWisePricing.map(dp => 
          dp.day === day ? { ...dp, [field]: value } : dp
        );
        return { ...config, dayWisePricing: updatedDayWise };
      }
      return config;
    }));
  };

  // Quick price set function for any specific day
  const setDayPrice = (ticketType: string, day: DayWisePricing['day'], price: number) => {
    setConfigs(prev => prev.map(config => {
      if (config.ticketType === ticketType) {
        const updatedDayWise = config.dayWisePricing.map(dp => 
          dp.day === day ? { 
            ...dp, 
            fixedAmount: price, 
            priceMultiplier: 1,
            enabled: true 
          } : dp
        );
        return { ...config, dayWisePricing: updatedDayWise };
      }
      return config;
    }));
  };

  // Quick multiplier set function for any specific day
  const setDayMultiplier = (ticketType: string, day: DayWisePricing['day'], multiplier: number) => {
    setConfigs(prev => prev.map(config => {
      if (config.ticketType === ticketType) {
        const updatedDayWise = config.dayWisePricing.map(dp => 
          dp.day === day ? { 
            ...dp, 
            priceMultiplier: multiplier, 
            fixedAmount: undefined,
            enabled: true 
          } : dp
        );
        return { ...config, dayWisePricing: updatedDayWise };
      }
      return config;
    }));
  };

  const resetToDefaults = (ticketType: string) => {
    setConfigs(prev => prev.map(config => {
      if (config.ticketType === ticketType) {
        const defaultDayWise = days.map(day => ({
          day,
          priceMultiplier: 1.0,
          enabled: true
        }));
        return { ...config, dayWisePricing: defaultDayWise };
      }
      return config;
    }));
  };
  
  // Excel Export Function
  const exportToExcel = async () => {
    setExporting(true);
    try {
      console.log('🔄 AdminTicketConfig: Exporting to Excel...');
      const excelData = await ticketConfigApi.exportToExcel();
      
      // Convert to CSV format for download
      const headers = Object.keys(excelData[0] || {});
      const csvContent = [
        headers.join(','),
        ...excelData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || '';
          }).join(',')
        )
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `ticket-configs-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ AdminTicketConfig: Excel export completed');
      setSuccessNotification('Ticket configurations exported successfully!');
      setTimeout(() => setSuccessNotification(null), 3000);
      
    } catch (error) {
      console.error('❌ AdminTicketConfig: Export failed:', error);
      alert('Failed to export ticket configurations. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  // Excel Import Function
  const importFromExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    setImportResults(null);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        console.log('🔄 AdminTicketConfig: Reading Excel file...');
        
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('File is empty or invalid');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const row: any = {};
          headers.forEach((header, index) => {
            let value = values[index] || '';
            // Remove quotes and clean value
            value = value.replace(/^"|"$/g, '').replace(/""/g, '"');
            // Convert numeric values
            if (value && !isNaN(Number(value)) && value !== '') {
              row[header] = Number(value);
            } else {
              row[header] = value;
            }
          });
          return row;
        });
        
        console.log('📝 AdminTicketConfig: Parsed data:', data.length, 'rows');
        
        // Import to server
        const result = await ticketConfigApi.importFromExcel(data);
        console.log('✅ AdminTicketConfig: Import completed:', result);
        
        setImportResults(result);
        setSuccessNotification(`Import completed: ${result.successCount} updated, ${result.failureCount} failed`);
        setTimeout(() => setSuccessNotification(null), 5000);
        
        // Refresh configs
        await fetchConfigs();
        
      } catch (error) {
        console.error('❌ AdminTicketConfig: Import failed:', error);
        alert('Failed to import ticket configurations. Please check the file format and try again.');
      } finally {
        setImporting(false);
        // Reset file input
        event.target.value = '';
      }
    };
    
    reader.onerror = () => {
      console.error('❌ AdminTicketConfig: File read error');
      alert('Failed to read file. Please try again.');
      setImporting(false);
      event.target.value = '';
    };
    
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <Layout title="Ticket Configuration">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Ticket Configuration">
      {/* Real-time Sync Status */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed top-4 left-4 z-40 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium shadow-lg flex items-center gap-2"
      >
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        Real-time Sync Active
      </motion.div>
      
      {/* Success Notification */}
      {successNotification && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.8 }}
          className="fixed top-4 right-4 z-50 bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl border-2 border-green-400 flex items-center gap-3"
        >
          <motion.div
            className="w-3 h-3 bg-white rounded-full animate-pulse"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="font-bold text-sm">{successNotification}</span>
        </motion.div>
      )}
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Ticket Configuration Management</h2>
          <div className="space-x-4">
            {/* Excel Export Button */}
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export to Excel
                </>
              )}
            </button>
            
            {/* Excel Import Button */}
            <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 cursor-pointer">
              {importing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Importing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Import from Excel
                </>
              )}
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={importFromExcel}
                disabled={importing}
                className="hidden"
              />
            </label>
            
            <button
              onClick={initializeDefaults}
              disabled={saving}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              {saving ? 'Initializing...' : 'Initialize Defaults'}
            </button>
          </div>
        </div>
        
        {/* Import Results */}
        {importResults && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-blue-50 border border-blue-200 rounded-lg p-4"
          >
            <h3 className="font-semibold text-blue-900 mb-2">📊 Import Results</h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{importResults.successCount}</div>
                <div className="text-gray-600">Successfully Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{importResults.failureCount}</div>
                <div className="text-gray-600">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{importResults.totalProcessed}</div>
                <div className="text-gray-600">Total Processed</div>
              </div>
            </div>
            
            {importResults.failureCount > 0 && (
              <div className="mt-3">
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-600 font-medium hover:text-red-700">
                    View Failed Items ({importResults.failureCount})
                  </summary>
                  <div className="mt-2 bg-white rounded border border-red-200 p-2 max-h-32 overflow-y-auto">
                    {importResults.results
                      .filter((r: any) => !r.success)
                      .map((result: any, index: number) => (
                        <div key={index} className="text-xs text-red-600 border-b border-red-100 pb-1">
                          <strong>{result.ticketType}:</strong> {result.message}
                        </div>
                      ))}
                  </div>
                </details>
              </div>
            )}
            
            <button
              onClick={() => setImportResults(null)}
              className="mt-3 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {configs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No ticket configurations found</p>
            <button
              onClick={initializeDefaults}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Initialize Default Configurations
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {configs.map((config) => (
              <motion.div
                key={config.ticketType}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex-1">
                    {editingTicket === config.ticketType ? (
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={config.label}
                          onChange={(e) => setConfigs(prev => prev.map(c => 
                            c.ticketType === config.ticketType ? { ...c, label: e.target.value } : c
                          ))}
                          className="text-xl font-bold text-gray-900 border border-gray-300 rounded px-3 py-2 w-full"
                          placeholder="Ticket Label"
                        />
                        <textarea
                          value={config.description}
                          onChange={(e) => setConfigs(prev => prev.map(c => 
                            c.ticketType === config.ticketType ? { ...c, description: e.target.value } : c
                          ))}
                          className="text-gray-600 border border-gray-300 rounded px-3 py-2 w-full"
                          rows={2}
                          placeholder="Description"
                        />
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-500">Base Price:</span>
                            <input
                              type="number"
                              value={config.basePrice}
                              onChange={(e) => setConfigs(prev => prev.map(c => 
                                c.ticketType === config.ticketType ? { ...c, basePrice: parseInt(e.target.value) || 0 } : c
                              ))}
                              className="border border-gray-300 rounded px-3 py-2 w-24"
                              min="0"
                            />
                          </div>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={config.isActive}
                              onChange={(e) => setConfigs(prev => prev.map(c => 
                                c.ticketType === config.ticketType ? { ...c, isActive: e.target.checked } : c
                              ))}
                              className="rounded"
                            />
                            <span className="text-sm">Active</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={config.hasKids}
                              onChange={(e) => setConfigs(prev => prev.map(c => 
                                c.ticketType === config.ticketType ? { ...c, hasKids: e.target.checked } : c
                              ))}
                              className="rounded"
                            />
                            <span className="text-sm">Kids Allowed</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={config.foodIncluded}
                              onChange={(e) => setConfigs(prev => prev.map(c => 
                                c.ticketType === config.ticketType ? { ...c, foodIncluded: e.target.checked } : c
                              ))}
                              className="rounded"
                            />
                            <span className="text-sm">Food Included</span>
                          </label>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-bold text-gray-900">{config.label}</h3>
                        <p className="text-gray-600 mt-1">{config.description}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <span className="text-sm font-medium text-gray-500">
                            Base Price: ₹{config.basePrice}
                          </span>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            config.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {config.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {config.hasKids && (
                            <span className="text-sm px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                              Kids Allowed
                            </span>
                          )}
                          {config.foodIncluded && (
                            <span className="text-sm px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
                              Food Included
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {editingTicket === config.ticketType ? (
                      <>
                        <button
                          onClick={() => updateConfig(config.ticketType, config)}
                          disabled={saving}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingTicket(null)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingTicket(config.ticketType)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => resetToDefaults(config.ticketType)}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                        >
                          Reset Pricing
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Day-wise Pricing */}
                <div className={`space-y-4 mt-6 ${editingTicket === config.ticketType ? 'ring-2 ring-blue-500 rounded-lg p-4' : ''}`}>
                  <h4 className="text-lg font-semibold text-gray-900">Day-wise Pricing</h4>
                  {editingTicket === config.ticketType && (
                    <div className="text-sm text-blue-600 mb-2">
                      Day-wise pricing is now editable for {config.label}
                    </div>
                  )}
                  {/* Debug info */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-500 mb-2">
                      Debug: editingTicket={editingTicket}, config.ticketType={config.ticketType}, canEdit={editingTicket === config.ticketType}
                    </div>
                  )}
                  
                  {/* Quick Price Set Section */}
                  {editingTicket === config.ticketType && (
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h5 className="text-md font-semibold text-gray-800 mb-3">Quick Price Set</h5>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {days.map(day => {
                          const dayPricing = config.dayWisePricing.find(dp => dp.day === day);
                          const currentPrice = dayPricing?.fixedAmount !== undefined 
                            ? dayPricing.fixedAmount 
                            : Math.round(config.basePrice * (dayPricing?.priceMultiplier || 1));
                          
                          return (
                            <div key={day} className="text-center">
                              <div className="text-sm font-medium text-gray-700 mb-1 capitalize">
                                {dayLabels[day].slice(0, 3)}
                                {day === 'sunday' && ' 🎉'}
                              </div>
                              <input
                                type="number"
                                value={currentPrice}
                                onChange={(e) => setDayPrice(config.ticketType, day, parseInt(e.target.value) || 0)}
                                disabled={editingTicket === null}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="₹0"
                              />
                              <div className="text-xs text-gray-500 mt-1">₹{currentPrice}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            days.forEach(day => setDayPrice(config.ticketType, day, config.basePrice));
                          }}
                          disabled={editingTicket === null}
                          className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        >
                          Reset All to Base
                        </button>
                        <button
                          onClick={() => {
                            setDayPrice(config.ticketType, 'saturday', Math.round(config.basePrice * 2));
                            setDayPrice(config.ticketType, 'sunday', Math.round(config.basePrice * 2));
                          }}
                          disabled={editingTicket === null}
                          className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          Weekend 2x
                        </button>
                        <button
                          onClick={() => {
                            days.forEach(day => setDayMultiplier(config.ticketType, day, 1));
                          }}
                          disabled={editingTicket === null}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Use Multipliers
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {config.dayWisePricing.map((dayPricing) => {
                      const finalPrice = dayPricing.fixedAmount !== undefined 
                        ? dayPricing.fixedAmount 
                        : Math.round(config.basePrice * dayPricing.priceMultiplier);
                      
                      return (
                        <div
                          key={dayPricing.day}
                          className={`border rounded-lg p-4 ${
                            dayPricing.day === 'sunday' ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="font-medium text-gray-900 capitalize">
                              {dayLabels[dayPricing.day]}
                              {dayPricing.day === 'sunday' && ' 🎉'}
                            </h5>
                            <label className="flex items-center">
                              <input
                                type="checkbox"
                                checked={dayPricing.enabled}
                                onChange={(e) => updateDayPricing(config.ticketType, dayPricing.day, 'enabled', e.target.checked)}
                                disabled={editingTicket === null}
                                className="mr-2"
                                title={editingTicket !== null ? "Enable day-wise pricing" : "Click Edit to enable day-wise pricing"}
                              />
                              <span className="text-sm text-gray-600">Enable</span>
                            </label>
                          </div>
                          
                          {dayPricing.enabled && (
                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Pricing Type
                                </label>
                                <select
                                  value={dayPricing.fixedAmount !== undefined ? 'fixed' : 'multiplier'}
                                  onChange={(e) => {
                                    if (e.target.value === 'fixed') {
                                      updateDayPricing(config.ticketType, dayPricing.day, 'fixedAmount', config.basePrice);
                                      updateDayPricing(config.ticketType, dayPricing.day, 'priceMultiplier', 1);
                                    } else {
                                      updateDayPricing(config.ticketType, dayPricing.day, 'fixedAmount', undefined);
                                      updateDayPricing(config.ticketType, dayPricing.day, 'priceMultiplier', 1);
                                    }
                                  }}
                                  disabled={editingTicket === null}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="multiplier">Multiplier</option>
                                  <option value="fixed">Fixed Amount</option>
                                </select>
                              </div>

                              {dayPricing.fixedAmount !== undefined ? (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fixed Amount (₹)
                                  </label>
                                  <input
                                    type="number"
                                    value={dayPricing.fixedAmount}
                                    onChange={(e) => updateDayPricing(config.ticketType, dayPricing.day, 'fixedAmount', parseInt(e.target.value) || 0)}
                                    disabled={editingTicket === null}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                              ) : (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Multiplier ({dayPricing.priceMultiplier}x)
                                  </label>
                                  <input
                                    type="range"
                                    min="0.5"
                                    max="3"
                                    step="0.1"
                                    value={dayPricing.priceMultiplier}
                                    onChange={(e) => updateDayPricing(config.ticketType, dayPricing.day, 'priceMultiplier', parseFloat(e.target.value))}
                                    disabled={editingTicket === null}
                                    className="w-full"
                                  />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>50% OFF</span>
                                    <span>Normal</span>
                                    <span>3x Price</span>
                                  </div>
                                </div>
                              )}

                              <div className="pt-2 border-t">
                                <div className="text-sm font-medium text-gray-700">Final Price:</div>
                                <div className="text-lg font-bold text-green-600">₹{finalPrice}</div>
                                {finalPrice !== config.basePrice && (
                                  <div className="text-xs text-gray-500">
                                    {finalPrice > config.basePrice ? '+' : '-'}₹{Math.abs(finalPrice - config.basePrice)} from base
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
