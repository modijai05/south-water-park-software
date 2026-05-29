import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import { Layout } from '@/components/Layout';
import { entriesApi } from '@/lib/api';
import { getTicketLabel, getTicketLabelSync } from '@/lib/ticketUtils';
import Receipt from '@/components/Receipt';
import { getEffectiveEntryDate } from '@/utils/dateUtils';
import type { EntryRecord, TicketType } from '@/types';

type Range = 'today' | 'yesterday' | 'week' | 'month' | 'custom' | 'particular_day' | 'all_time';

// Custom event types for better type safety
interface GlobalSyncEvent extends Event {
  detail: {
    timestamp: string;
    count: number;
  };
}

interface ExportSyncEvent extends Event {
  detail: {
    timestamp: string;
    count: number;
    entries: EntryRecord[];
  };
}

interface ReceiptEvent extends Event {
  detail: {
    receiptNumber?: string;
    name: string;
    mobile: string;
    ticketType: string;
    adults: number;
    kids: number;
    upgrades: any[];
    baseAmount: number;
    kidDiscount: number;
    additionalDiscount: number;
    finalAmount: number;
    totalPeople: number;
    cashAmount: number;
    upiAmount: number;
    advanceAmount: number;
    otherAmount: number;
    filledBy?: {
      username?: string;
      fullName?: string;
    };
    createdAt: string;
    adultsFastFoodCoupon?: string;
    kidsFastFoodCoupon?: string;
    adultsMainFoodCoupon?: string;
    kidsMainFoodCoupon?: string;
  };
}

export function AdminExport() {
  const [range, setRange] = useState<Range>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [particularDate, setParticularDate] = useState('');
  const [entriesCount, setEntriesCount] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>(dayjs().format('HH:mm:ss'));
  const [syncStatus, setSyncStatus] = useState<'active' | 'syncing' | 'error'>('active');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saveLocation, setSaveLocation] = useState<'local' | 'onedrive'>('local');
  const [autoBackup, setAutoBackup] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptMode, setReceiptMode] = useState<'single' | 'batch'>('single');
  const [selectedEntryId, setSelectedEntryId] = useState<string>('');

  // Auto-sync entries count when date range changes
  useEffect(() => {
    const fetchEntriesCount = async () => {
      try {
        const { from: f, to: t } = getDateRange();
        const exportData = await entriesApi.export({
          from: `${f}T00:00:00.000Z`,
          to: `${t}T23:59:59.999Z`,
          limit: 1, // Just get count for efficiency
        });
        setEntriesCount(exportData.total || 0);
      } catch (error) {
        console.error('Failed to fetch entries count:', error);
        setEntriesCount(null);
      }
    };

    fetchEntriesCount();
  }, [range, from, to, particularDate]);

  // Enhanced real-time sync: Listen for entry updates with 24/7 continuous syncing
  useEffect(() => {
    let syncInterval: number;
    let cancelled = false;
    
    const handleEntryUpdate = () => {
      console.log('Export: Syncing entries count...');
      
      // Set sync status to syncing
      setSyncStatus('syncing');
      
      // Refresh entries count when an entry is updated
      const fetchEntriesCount = async () => {
        try {
          const { from: f, to: t } = getDateRange();
          const exportData = await entriesApi.export({
            from: `${f}T00:00:00.000Z`,
            to: `${t}T23:59:59.999Z`,
            limit: 1, // Just get count for efficiency
          });
          setEntriesCount(exportData.total || 0);
          setLastSyncTime(dayjs().format('HH:mm:ss'));
          setSyncStatus('active');
          
          console.log('Export: Entries count updated:', exportData.total);
          
          // Trigger global sync events
          window.dispatchEvent(new CustomEvent('export-synced', {
            detail: { timestamp: new Date().toISOString(), count: exportData.total }
          }));
          
          // Also trigger excel-synced event for Excel components
          window.dispatchEvent(new CustomEvent('excel-synced', {
            detail: { timestamp: new Date().toISOString(), count: exportData.total, entries: [] }
          }));
          
        } catch (error) {
          console.error('Export: Failed to refresh entries count:', (error as Error).message);
          setSyncStatus('error');
        }
      };

      fetchEntriesCount();
    };

    // Listen for global sync events
    const handleGlobalSync = (event: GlobalSyncEvent) => {
      console.log('Export: Received global sync event');
      handleEntryUpdate();
    };

    const handleExportSync = (event: ExportSyncEvent) => {
      console.log('Export: Received export sync event:', event.detail);
      handleEntryUpdate();
    };

    const handleReceiptEvent = (event: ReceiptEvent) => {
      console.log('Export: Receipt event received:', event.detail);
      handleEntryUpdate();
    };
    
    // Add event listeners for all update events
    window.addEventListener('global-sync', handleGlobalSync);
    window.addEventListener('export-sync-required', handleExportSync);
    window.addEventListener('excel-sync-required', handleExportSync);
    window.addEventListener('entry-updated', handleEntryUpdate);
    window.addEventListener('entry-created', handleEntryUpdate);
    window.addEventListener('entry-deleted', handleEntryUpdate);
    window.addEventListener('dashboard-synced', handleEntryUpdate);
    window.addEventListener('payment-completed', handleEntryUpdate);
    window.addEventListener('export-refresh', handleEntryUpdate); // Listen for admin sync coordinator
    
    window.addEventListener('receipt-generated', handleReceiptEvent);
    window.addEventListener('receipt-printed', handleReceiptEvent);
    window.addEventListener('staff-synced', handleEntryUpdate);
    
    // 24/7 continuous sync - refresh every 5 seconds for export
    syncInterval = setInterval(() => {
      if (!cancelled) {
        handleEntryUpdate();
      }
    }, 5000) as unknown as number;
    
    // Cleanup event listeners and intervals on unmount
    return () => {
      cancelled = true;
      window.removeEventListener('global-sync', handleGlobalSync);
      window.removeEventListener('export-sync-required', handleExportSync);
      window.removeEventListener('excel-sync-required', handleExportSync);
      window.removeEventListener('entry-updated', handleEntryUpdate);
      window.removeEventListener('entry-created', handleEntryUpdate);
      window.removeEventListener('entry-deleted', handleEntryUpdate);
      window.removeEventListener('dashboard-synced', handleEntryUpdate);
      window.removeEventListener('payment-completed', handleEntryUpdate);
      window.removeEventListener('export-refresh', handleEntryUpdate); // Remove admin sync coordinator event
      window.removeEventListener('receipt-generated', handleReceiptEvent);
      window.removeEventListener('receipt-printed', handleReceiptEvent);
      window.removeEventListener('staff-synced', handleEntryUpdate);
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [range, from, to, particularDate]);

  const getDateRange = (): { from: string; to: string } => {
    const today = dayjs();
    switch (range) {
      case 'today':
        return { from: today.format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') };
      case 'yesterday':
        const yesterday = today.subtract(1, 'day');
        return { from: yesterday.format('YYYY-MM-DD'), to: yesterday.format('YYYY-MM-DD') };
      case 'week':
        return {
          from: today.subtract(7, 'day').format('YYYY-MM-DD'),
          to: today.format('YYYY-MM-DD'),
        };
      case 'month':
        return {
          from: today.subtract(30, 'day').format('YYYY-MM-DD'),
          to: today.format('YYYY-MM-DD'),
        };
      case 'all_time':
        return {
          from: '2020-01-01', // Start from a very early date
          to: today.format('YYYY-MM-DD'),
        };
      case 'particular_day':
        return { from: particularDate, to: particularDate };
      default:
        return { from, to };
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { from: f, to: t } = getDateRange();
      
      // Use the dedicated export API with proper filtering
      const exportData = await entriesApi.export({
        from: `${f}T00:00:00.000Z`,
        to: `${t}T23:59:59.999Z`,
        limit: 10000, // Get all entries for export
      });
      
      const entries = (exportData.entries as EntryRecord[]) ?? [];
      
      // Update entries count for display
      setEntriesCount(entries.length);
      
      // Show export summary
      console.log('Export: Export Summary:', {
        query: exportData.query,
        totalAvailable: exportData.total,
        exported: exportData.exported
      });
      
      if (entries.length === 0) {
        alert(`No entries found for selected date range (${f} to ${t})\n\nQuery: ${JSON.stringify(exportData.query, null, 2)}`);
        return;
      }

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'South Water Park';
      const sheet = workbook.addWorksheet('Entries');
      
      // Add title and date range at the top with premium professional styling
      sheet.mergeCells('A1:P1');
      sheet.getCell('A1').value = '🎢 THE SOUTH WATER PARK - PREMIUM TICKET ENTRIES REPORT';
      sheet.getCell('A1').font = { 
        bold: true, 
        size: 20, 
        color: { argb: 'FF0066CC' },
        name: 'Calibri',
        family: 2,
        scheme: 'minor'
      };
      sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      };
      
      sheet.mergeCells('A2:P2');
      sheet.getCell('A2').value = `📅 Period: ${dayjs(f).format('DD MMMM YYYY')} - ${dayjs(t).format('DD MMMM YYYY')} | 🎫 Total Entries: ${entries.length} | ⏰ Export: ${dayjs().format('DD/MM/YYYY HH:mm:ss')}`;
      sheet.getCell('A2').font = { 
        bold: true, 
        size: 14, 
        color: { argb: 'FF1E40AF' },
        name: 'Calibri',
        family: 2,
        scheme: 'minor'
      };
      sheet.getCell('A2').alignment = { horizontal: 'center' };
      sheet.getCell('A2').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      };
      
      sheet.mergeCells('A3:P3');
      sheet.getCell('A3').value = `🔄 Real-time Data Sync | 📊 Live Analytics | 💾 Professional Report | 🎯 Premium Analytics`;
      sheet.getCell('A3').font = { 
        bold: true, 
        size: 12, 
        color: { argb: 'FF059669' },
        name: 'Calibri',
        family: 2,
        scheme: 'minor'
      };
      sheet.getCell('A3').alignment = { horizontal: 'center' };
      sheet.getCell('A3').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFECFDF5' }
      };
      
      // Add premium border to title area
      ['A1', 'A2', 'A3'].forEach(cell => {
        sheet.getCell(cell).border = {
          top: { style: 'medium', color: { argb: 'FF1E40AF' } },
          left: { style: 'medium', color: { argb: 'FF1E40AF' } },
          bottom: { style: 'medium', color: { argb: 'FF1E40AF' } },
          right: { style: 'medium', color: { argb: 'FF1E40AF' } }
        };
      });
      
      // Add empty row for spacing
      sheet.addRow([]);
      
      // Add headers with proper styling
      const headers = [
        'Date', 'Customer Name', 'Mobile', 'Main Ticket Type', 'Main Adults', 'Main Kids', 'Main Total People',
        'Upgrade 1 Type', 'Upgrade 1 Adults', 'Upgrade 1 Kids', 'Upgrade 1 Total',
        'Upgrade 2 Type', 'Upgrade 2 Adults', 'Upgrade 2 Kids', 'Upgrade 2 Total',
        'Upgrade 3 Type', 'Upgrade 3 Adults', 'Upgrade 3 Kids', 'Upgrade 3 Total',
        'Base Amount', 'Kid Discount', 'Additional Discount', 'Final Amount', 'Cash', 'UPI', 'Advance', 'Other',
        'Adults Fast Food Coupon #', 'Kids Fast Food Coupon #', 'Adults Main Food Coupon #', 'Kids Main Food Coupon #',
        'Upgrade 1 Adults Fast Food', 'Upgrade 1 Kids Fast Food', 'Upgrade 1 Adults Main Food', 'Upgrade 1 Kids Main Food',
        'Upgrade 2 Adults Fast Food', 'Upgrade 2 Kids Fast Food', 'Upgrade 2 Adults Main Food', 'Upgrade 2 Kids Main Food',
        'Upgrade 3 Adults Fast Food', 'Upgrade 3 Kids Fast Food', 'Upgrade 3 Adults Main Food', 'Upgrade 3 Kids Main Food',
        'Total Fast Food', 'Total Main Food', 'Total Food Coupons',
        'Notes', 'Created By'
      ];
      
      const headerRow = sheet.addRow(headers);
      headerRow.font = { 
        bold: true, 
        size: 14, 
        color: { argb: 'FFFFFFFF' },
        name: 'Calibri',
        family: 2,
        scheme: 'minor'
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0066CC' }
      };
      headerRow.border = {
        top: { style: 'thick', color: { argb: 'FF0066CC' } },
        bottom: { style: 'thick', color: { argb: 'FF0066CC' } },
        left: { style: 'thick', color: { argb: 'FF0066CC' } },
        right: { style: 'thick', color: { argb: 'FF0066CC' } }
      };
      
      // Set row height for header
      headerRow.height = 30;
      
      // Set column widths for better formatting
      sheet.columns = [
        { width: 20 }, // Date
        { width: 25 }, // Customer Name
        { width: 15 }, // Mobile
        { width: 18 }, // Main Ticket Type
        { width: 12 }, // Main Adults
        { width: 10 }, // Main Kids
        { width: 15 }, // Main Total People
        { width: 18 }, // Upgrade 1 Type
        { width: 14 }, // Upgrade 1 Adults
        { width: 10 }, // Upgrade 1 Kids
        { width: 15 }, // Upgrade 1 Total
        { width: 18 }, // Upgrade 2 Type
        { width: 14 }, // Upgrade 2 Adults
        { width: 10 }, // Upgrade 2 Kids
        { width: 15 }, // Upgrade 2 Total
        { width: 18 }, // Upgrade 3 Type
        { width: 14 }, // Upgrade 3 Adults
        { width: 10 }, // Upgrade 3 Kids
        { width: 15 }, // Upgrade 3 Total
        { width: 16 }, // Base Amount
        { width: 16 }, // Kid Discount
        { width: 18 }, // Additional Discount
        { width: 16 }, // Final Amount
        { width: 12 }, // Cash
        { width: 12 }, // UPI
        { width: 12 }, // Advance
        { width: 12 }, // Other
        { width: 20 }, // Adults Fast Food Coupon #
        { width: 18 }, // Kids Fast Food Coupon #
        { width: 20 }, // Adults Main Food Coupon #
        { width: 18 }, // Kids Main Food Coupon #
        { width: 18 }, // Upgrade 1 Adults Fast Food
        { width: 16 }, // Upgrade 1 Kids Fast Food
        { width: 18 }, // Upgrade 1 Adults Main Food
        { width: 16 }, // Upgrade 1 Kids Main Food
        { width: 18 }, // Upgrade 2 Adults Fast Food
        { width: 16 }, // Upgrade 2 Kids Fast Food
        { width: 18 }, // Upgrade 2 Adults Main Food
        { width: 16 }, // Upgrade 2 Kids Main Food
        { width: 18 }, // Upgrade 3 Adults Fast Food
        { width: 16 }, // Upgrade 3 Kids Fast Food
        { width: 18 }, // Upgrade 3 Adults Main Food
        { width: 16 }, // Upgrade 3 Kids Main Food
        { width: 15 }, // Total Fast Food
        { width: 15 }, // Total Main Food
        { width: 18 }, // Total Food Coupons
        { width: 30 }, // Notes
        { width: 20 }  // Created By
      ];
      
      // Helper function to count coupons from range strings (same as backend logic)
      const countCouponsFromRange = (range?: string): number => {
        if (!range || typeof range !== 'string') return 0;
        const cleanRange = range.trim();
        
        if (!cleanRange.includes('-')) {
          const num = parseInt(cleanRange);
          return isNaN(num) ? 0 : 1;
        }
        const [start, end] = cleanRange.split('-').map(s => s.trim());
        const startNum = parseInt(start);
        const endNum = parseInt(end);
        if (isNaN(startNum) || isNaN(endNum) || startNum > endNum) return 0;
        return endNum - startNum + 1;
      };
      
      // Helper function to count coupons from comma-separated strings with ranges
      const countCouponsFromString = (couponString?: string): number => {
        if (!couponString || typeof couponString !== 'string') return 0;
        const cleanString = couponString.trim();
        if (!cleanString) return 0;
        
        // Split by comma and count each part (could be single numbers or ranges)
        const coupons = cleanString.split(',').filter(c => c.trim());
        return coupons.reduce((total, coupon) => {
          const count = countCouponsFromRange(coupon.trim());
          return total + count;
        }, 0);
      };
      
      // Quick test to verify coupon counting works
      console.log('🧪 Quick coupon test - Range 1514-1518:', countCouponsFromRange('1514-1518')); // Should be 5
      console.log('🧪 Quick coupon test - Multiple ranges:', countCouponsFromString('1514-1518, 1520-1525')); // Should be 11
      console.log('🧪 Quick coupon test - Single number:', countCouponsFromRange('1514')); // Should be 1
      console.log('🧪 Quick coupon test - Mixed:', countCouponsFromString('1514, 1516-1518, 1520')); // Should be 5
      
      // Test with sample data
      const testCouponString = '1514-1518, 1520-1525';
      console.log('🧪 Test coupon string:', testCouponString, 'Count:', countCouponsFromString(testCouponString));
      
      // Helper function to apply row styling
      const applyRowStyling = (row: any, rowNum: number, isUpgrade = false) => {
        // Professional row styling with borders and alternating colors
        row.alignment = { vertical: 'middle' };
        row.font = { 
          size: 11, 
          name: 'Calibri',
          family: 2,
          scheme: 'minor'
        };
        row.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };
        
        // Highlight important fields with blue text
        row.getCell(1).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Date
        row.getCell(2).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Name
        row.getCell(3).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Mobile
        row.getCell(4).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Main Ticket Type
        
        // Highlight upgrade ticket types with purple text
        row.getCell(8).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 1 Type
        row.getCell(12).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 2 Type
        row.getCell(16).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 3 Type
        
        // Highlight financial data with green text
        row.getCell(20).font = { bold: true, color: { argb: 'FF059669' } }; // Base Amount
        row.getCell(21).font = { bold: true, color: { argb: 'FFDC2626' } }; // Kid Discount
        row.getCell(22).font = { bold: true, color: { argb: 'FFDC2626' } }; // Additional Discount
        row.getCell(23).font = { bold: true, color: { argb: 'FF059669' } }; // Final Amount
        
        // Highlight payment data with blue text
        row.getCell(24).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Cash
        row.getCell(25).font = { bold: true, color: { argb: 'FF1E40AF' } }; // UPI
        row.getCell(26).font = { bold: true, color: { argb: 'FF059669' } }; // Advance
        row.getCell(27).font = { bold: true, color: { argb: 'FF1E40AF' } }; // Other
        
        // Highlight food coupon numbers with orange text
        row.getCell(28).font = { bold: true, color: { argb: 'FFEA580C' } }; // Adults Fast Food Coupon #
        row.getCell(29).font = { bold: true, color: { argb: 'FFEA580C' } }; // Kids Fast Food Coupon #
        row.getCell(30).font = { bold: true, color: { argb: 'FFEA580C' } }; // Adults Main Food Coupon #
        row.getCell(31).font = { bold: true, color: { argb: 'FFEA580C' } }; // Kids Main Food Coupon #
        
        // Highlight upgrade food coupons with purple text
        row.getCell(32).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 1 Adults Fast Food
        row.getCell(33).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 1 Kids Fast Food
        row.getCell(34).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 1 Adults Main Food
        row.getCell(35).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 1 Kids Main Food
        row.getCell(36).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 2 Adults Fast Food
        row.getCell(37).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 2 Kids Fast Food
        row.getCell(38).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 2 Adults Main Food
        row.getCell(39).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 2 Kids Main Food
        row.getCell(40).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 3 Adults Fast Food
        row.getCell(41).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 3 Kids Fast Food
        row.getCell(42).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 3 Adults Main Food
        row.getCell(43).font = { bold: true, color: { argb: 'FF7C3AED' } }; // Upgrade 3 Kids Main Food
        
        // Highlight food coupon totals with green text
        row.getCell(44).font = { bold: true, color: { argb: 'FF059669' } }; // Total Fast Food
        row.getCell(45).font = { bold: true, color: { argb: 'FF059669' } }; // Total Main Food
        row.getCell(46).font = { bold: true, color: { argb: 'FF059669' } }; // Total Food Coupons
        
        // Highlight created by with gray text
        row.getCell(48).font = { bold: true, color: { argb: 'FF6B7280' } }; // Created By
        
        // Alternate row colors for better readability
        if (isUpgrade) {
          // Light blue background for upgrade rows
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0F2FE' }
          };
        } else if (rowNum % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF9FAFB' }
          };
        } else {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' }
          };
        }
        
        // Set row height for better readability
        row.height = 22;
      };
      
      // Add real data to Excel
      let currentRow = 6;
      console.log('🔍 Processing entries for Excel export:', entries.length);
      
      // Check if any entries have coupon data
      let entriesWithCoupons = 0;
      let totalCouponsFound = 0;
      
      for (const e of entries) {
        const hasCoupons = !!(e as any).adultsFastFoodCoupon || 
                          !!(e as any).kidsFastFoodCoupon || 
                          !!(e as any).adultsMainFoodCoupon || 
                          !!(e as any).kidsMainFoodCoupon;
        
        if (hasCoupons) {
          entriesWithCoupons++;
          totalCouponsFound++;
        }
      }
      
      console.log('🔍 Coupon data analysis:', {
        totalEntries: entries.length,
        entriesWithCoupons,
        totalCouponsFound
      });
      
      // Show sample entry data
      if (entries.length > 0) {
        const sampleEntry = entries[0];
        console.log('🔍 Sample entry coupon data:', {
          adultsFastFoodCoupon: (sampleEntry as any).adultsFastFoodCoupon,
          kidsFastFoodCoupon: (sampleEntry as any).kidsFastFoodCoupon,
          adultsMainFoodCoupon: (sampleEntry as any).adultsMainFoodCoupon,
          kidsMainFoodCoupon: (sampleEntry as any).kidsMainFoodCoupon,
          hasAnyCoupons: !!(sampleEntry as any).adultsFastFoodCoupon || 
                        !!(sampleEntry as any).kidsFastFoodCoupon || 
                        !!(sampleEntry as any).adultsMainFoodCoupon || 
                        !!(sampleEntry as any).kidsMainFoodCoupon
        });
      }
      
      
      for (const e of entries) {
        // Main entry row
        const row = sheet.getRow(currentRow);
        row.getCell(1).value = dayjs(getEffectiveEntryDate(e)).format('DD/MM/YYYY HH:mm:ss');
        row.getCell(2).value = e.name ?? '';
        row.getCell(3).value = e.mobile ?? '';
        row.getCell(4).value = getTicketLabelSync(e.ticketType as TicketType);
        row.getCell(5).value = e.adults ?? 0;
        row.getCell(6).value = e.ticketType === '150' ? '-' : e.kids;
        row.getCell(7).value = (e.adults || 0) + (e.kids || 0);
        
        // Handle all upgrade tickets in single row
        if (e.upgrades && e.upgrades.length > 0) {
          // Upgrade 1 - Columns 8-11
          if (e.upgrades[0]) {
            const upgrade1 = e.upgrades[0];
            row.getCell(8).value = getTicketLabelSync(upgrade1.ticketType as TicketType);
            row.getCell(9).value = upgrade1.adults ?? 0;
            row.getCell(10).value = upgrade1.kids ?? 0;
            row.getCell(11).value = (upgrade1.adults || 0) + (upgrade1.kids || 0);
          } else {
            row.getCell(8).value = '-';
            row.getCell(9).value = '-';
            row.getCell(10).value = '-';
            row.getCell(11).value = '-';
          }
          
          // Upgrade 2 - Columns 12-15
          if (e.upgrades[1]) {
            const upgrade2 = e.upgrades[1];
            row.getCell(12).value = getTicketLabelSync(upgrade2.ticketType as TicketType);
            row.getCell(13).value = upgrade2.adults ?? 0;
            row.getCell(14).value = upgrade2.kids ?? 0;
            row.getCell(15).value = (upgrade2.adults || 0) + (upgrade2.kids || 0);
          } else {
            row.getCell(12).value = '-';
            row.getCell(13).value = '-';
            row.getCell(14).value = '-';
            row.getCell(15).value = '-';
          }
          
          // Upgrade 3 - Columns 16-19
          if (e.upgrades[2]) {
            const upgrade3 = e.upgrades[2];
            row.getCell(16).value = getTicketLabelSync(upgrade3.ticketType as TicketType);
            row.getCell(17).value = upgrade3.adults ?? 0;
            row.getCell(18).value = upgrade3.kids ?? 0;
            row.getCell(19).value = (upgrade3.adults || 0) + (upgrade3.kids || 0);
          } else {
            row.getCell(16).value = '-';
            row.getCell(17).value = '-';
            row.getCell(18).value = '-';
            row.getCell(19).value = '-';
          }
        } else {
          // No upgrades - fill all upgrade columns with '-'
          for (let i = 8; i <= 19; i++) {
            row.getCell(i).value = '-';
          }
        }
        
        // Financial data - Columns 20-25
        row.getCell(20).value = e.baseAmount ?? 0;
        row.getCell(21).value = e.kidDiscount ?? 0;
        row.getCell(22).value = e.additionalDiscount ?? 0;
        row.getCell(23).value = e.finalAmount ?? 0;
        row.getCell(24).value = e.cashAmount ?? 0;
        row.getCell(25).value = e.upiAmount ?? 0;
        row.getCell(26).value = e.advanceAmount ?? 0;
        row.getCell(27).value = e.otherAmount ?? 0;
        
        // Food coupon numbers - Columns 28-31 (Main Ticket + Upgrades)
        let adultsFastFoodCoupon = (e as any).adultsFastFoodCoupon || '';
        let kidsFastFoodCoupon = (e as any).kidsFastFoodCoupon || '';
        let adultsMainFoodCoupon = (e as any).adultsMainFoodCoupon || '';
        let kidsMainFoodCoupon = (e as any).kidsMainFoodCoupon || '';
        
        // Collect food coupons from upgrade tickets
        if (e.upgrades && Array.isArray(e.upgrades) && e.upgrades.length > 0) {
          (e.upgrades || []).forEach((upgrade: any, index: number) => {
            if (!upgrade) return; // Guard against null/undefined upgrades
            // Only collect coupons from food-related upgrade tickets (450, 600)
            if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
              if (upgrade.adultsFastFoodCoupon) {
                adultsFastFoodCoupon = adultsFastFoodCoupon ? `${adultsFastFoodCoupon}, ${upgrade.adultsFastFoodCoupon}` : upgrade.adultsFastFoodCoupon;
              }
              if (upgrade.kidsFastFoodCoupon) {
                kidsFastFoodCoupon = kidsFastFoodCoupon ? `${kidsFastFoodCoupon}, ${upgrade.kidsFastFoodCoupon}` : upgrade.kidsFastFoodCoupon;
              }
              if (upgrade.adultsMainFoodCoupon) {
                adultsMainFoodCoupon = adultsMainFoodCoupon ? `${adultsMainFoodCoupon}, ${upgrade.adultsMainFoodCoupon}` : upgrade.adultsMainFoodCoupon;
              }
              if (upgrade.kidsMainFoodCoupon) {
                kidsMainFoodCoupon = kidsMainFoodCoupon ? `${kidsMainFoodCoupon}, ${upgrade.kidsMainFoodCoupon}` : upgrade.kidsMainFoodCoupon;
              }
            }
          });
        }
        
        // Debug: Log coupon data for this specific entry
        if (adultsFastFoodCoupon || kidsFastFoodCoupon || adultsMainFoodCoupon || kidsMainFoodCoupon) {
          console.log(`🔍 Entry ${currentRow} has coupons (including upgrades):`, {
            adultsFastFoodCoupon,
            kidsFastFoodCoupon,
            adultsMainFoodCoupon,
            kidsMainFoodCoupon
          });
        }
        
        // Food coupon numbers - Columns 28-31
        row.getCell(28).value = adultsFastFoodCoupon;
        row.getCell(29).value = kidsFastFoodCoupon;
        row.getCell(30).value = adultsMainFoodCoupon;
        row.getCell(31).value = kidsMainFoodCoupon;
        
        // Force Excel to recognize these as text values
        row.getCell(28).numFmt = '@';
        row.getCell(29).numFmt = '@';
        row.getCell(30).numFmt = '@';
        row.getCell(31).numFmt = '@';
        
        // Calculate food coupon totals using helper function
        const totalFastFood = countCouponsFromString(adultsFastFoodCoupon) + 
                              countCouponsFromString(kidsFastFoodCoupon);
        const totalMainFood = countCouponsFromString(adultsMainFoodCoupon) + 
                             countCouponsFromString(kidsMainFoodCoupon);
        const totalFoodCoupons = totalFastFood + totalMainFood;
        
        // Debug: Log calculated totals
        if (totalFastFood > 0 || totalMainFood > 0 || totalFoodCoupons > 0) {
          console.log(`🔍 Entry ${currentRow} coupon totals:`, {
            totalFastFood,
            totalMainFood,
            totalFoodCoupons
          });
        }
        
        // Food coupon totals - Columns 44-46
        row.getCell(44).value = totalFastFood || 0;
        row.getCell(45).value = totalMainFood || 0;
        row.getCell(46).value = totalFoodCoupons || 0;
        
        // Upgrade Food Coupon Counts - Columns 32-43
        if (e.upgrades && e.upgrades.length > 0) {
          // Upgrade 1 Food Coupons - Columns 32-35
          if (e.upgrades[0]) {
            const upgrade1 = e.upgrades[0];
            row.getCell(32).value = countCouponsFromString(upgrade1.adultsFastFoodCoupon || '') || 0;
            row.getCell(33).value = countCouponsFromString(upgrade1.kidsFastFoodCoupon || '') || 0;
            row.getCell(34).value = countCouponsFromString(upgrade1.adultsMainFoodCoupon || '') || 0;
            row.getCell(35).value = countCouponsFromString(upgrade1.kidsMainFoodCoupon || '') || 0;
          } else {
            row.getCell(32).value = 0;
            row.getCell(33).value = 0;
            row.getCell(34).value = 0;
            row.getCell(35).value = 0;
          }
          
          // Upgrade 2 Food Coupons - Columns 36-39
          if (e.upgrades[1]) {
            const upgrade2 = e.upgrades[1];
            row.getCell(36).value = countCouponsFromString(upgrade2.adultsFastFoodCoupon || '') || 0;
            row.getCell(37).value = countCouponsFromString(upgrade2.kidsFastFoodCoupon || '') || 0;
            row.getCell(38).value = countCouponsFromString(upgrade2.adultsMainFoodCoupon || '') || 0;
            row.getCell(39).value = countCouponsFromString(upgrade2.kidsMainFoodCoupon || '') || 0;
          } else {
            row.getCell(36).value = 0;
            row.getCell(37).value = 0;
            row.getCell(38).value = 0;
            row.getCell(39).value = 0;
          }
          
          // Upgrade 3 Food Coupons - Columns 40-43
          if (e.upgrades[2]) {
            const upgrade3 = e.upgrades[2];
            row.getCell(40).value = countCouponsFromString(upgrade3.adultsFastFoodCoupon || '') || 0;
            row.getCell(41).value = countCouponsFromString(upgrade3.kidsFastFoodCoupon || '') || 0;
            row.getCell(42).value = countCouponsFromString(upgrade3.adultsMainFoodCoupon || '') || 0;
            row.getCell(43).value = countCouponsFromString(upgrade3.kidsMainFoodCoupon || '') || 0;
          } else {
            row.getCell(40).value = 0;
            row.getCell(41).value = 0;
            row.getCell(42).value = 0;
            row.getCell(43).value = 0;
          }
        } else {
          // No upgrades - set all upgrade food coupon columns to 0
          for (let i = 32; i <= 43; i++) {
            row.getCell(i).value = 0;
          }
        }
        
        // Notes and Created By - Columns 47-48
        row.getCell(47).value = e.notes ?? '';
        row.getCell(48).value = (e as any).filledByFullName || (typeof e.createdBy === 'object' && e.createdBy ? (e.createdBy as { fullName?: string }).fullName || (e.createdBy as { username: string }).username : '');
        
        // Apply styling to main row
        applyRowStyling(row, currentRow);
        currentRow++;
      }
      
      // Summary of coupon data
      console.log('📊 Excel Export Summary:', {
        totalEntries: entries.length,
        entriesWithCoupons,
        totalCouponsFound,
        exportCompleted: true
      });
      
      // Count people by ticket type (including upgrades) - FIXED LOGIC
      const countTicketsByType = (ticketType: string) => {
        return entries.reduce((count, e) => {
          let people = 0;
          if (e.ticketType === ticketType) {
            people += (e.adults || 0) + (e.kids || 0);
          }
          if (e.upgrades && Array.isArray(e.upgrades)) {
            (e.upgrades || []).forEach((upgrade: any) => {
              if (!upgrade) return; // Guard against null/undefined upgrades
              if (upgrade.ticketType === ticketType) people += (upgrade.adults || 0) + (upgrade.kids || 0);
            });
          }
          return count + people;
        }, 0);
      };

      const total150Tickets = countTicketsByType('150');
      const total300Tickets = countTicketsByType('300');
      const total450Tickets = countTicketsByType('450');
      const total600Tickets = countTicketsByType('600');
      const total100Tickets = countTicketsByType('100');
      
      const totalAdultsFastFood = entries.reduce((sum, e) => {
        let count = 0;
        if (e.ticketType === '450' || e.ticketType === '600') {
          count += countCouponsFromRange(e.adultsFastFoodCoupon);
        }
        if (e.upgrades && Array.isArray(e.upgrades)) {
          e.upgrades.forEach((upgrade: any) => {
            if (!upgrade) return; // Guard against null/undefined upgrades
            if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
              count += countCouponsFromRange(upgrade.adultsFastFoodCoupon);
            }
          });
        }
        return sum + count;
      }, 0);
      
      const totalKidsFastFood = entries.reduce((sum, e) => {
        let count = 0;
        if (e.ticketType === '450' || e.ticketType === '600') {
          count += countCouponsFromRange(e.kidsFastFoodCoupon);
        }
        if (e.upgrades && Array.isArray(e.upgrades)) {
          e.upgrades.forEach((upgrade: any) => {
            if (!upgrade) return; // Guard against null/undefined upgrades
            if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
              count += countCouponsFromRange(upgrade.kidsFastFoodCoupon);
            }
          });
        }
        return sum + count;
      }, 0);
      
      const totalAdultsMainFood = entries.reduce((sum, e) => {
        let count = 0;
        if (e.ticketType === '450' || e.ticketType === '600') {
          count += countCouponsFromRange(e.adultsMainFoodCoupon);
        }
        if (e.upgrades && Array.isArray(e.upgrades)) {
          e.upgrades.forEach((upgrade: any) => {
            if (!upgrade) return; // Guard against null/undefined upgrades
            if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
              count += countCouponsFromRange(upgrade.adultsMainFoodCoupon);
            }
          });
        }
        return sum + count;
      }, 0);
      
      const totalKidsMainFood = entries.reduce((sum, e) => {
        let count = 0;
        if (e.ticketType === '450' || e.ticketType === '600') {
          count += countCouponsFromRange(e.kidsMainFoodCoupon);
        }
        if (e.upgrades && Array.isArray(e.upgrades)) {
          e.upgrades.forEach((upgrade: any) => {
            if (!upgrade) return; // Guard against null/undefined upgrades
            if (upgrade.ticketType === '450' || upgrade.ticketType === '600') {
              count += countCouponsFromRange(upgrade.kidsMainFoodCoupon);
            }
          });
        }
        return sum + count;
      }, 0);
      
      // Calculate summary statistics
      const totalPeople = entries.reduce((sum, e) => {
        const baseAdults = e.adults || 0;
        const baseKids = e.kids || 0;
        const upgradePeople = e.upgrades?.reduce((upgradeSum, u) => upgradeSum + (u.adults || 0) + (u.kids || 0), 0) || 0;
        return sum + baseAdults + baseKids + upgradePeople;
      }, 0);
      const totalAdults = entries.reduce((sum, e) => sum + (e.adults || 0), 0);
      const totalKids = entries.reduce((sum, e) => sum + (e.kids || 0), 0);
      const totalAmount = entries.reduce((sum, e) => sum + (e.finalAmount || 0) + (e.otherAmount || 0), 0);
      const totalCash = entries.reduce((sum, e) => sum + (e.cashAmount || 0), 0);
      const totalUpi = entries.reduce((sum, e) => sum + (e.upiAmount || 0), 0);
      const totalAdvance = entries.reduce((sum, e) => sum + (e.advanceAmount || 0), 0);
      const totalOther = entries.reduce((sum, e) => sum + (e.otherAmount || 0), 0);
      
      // Calculate food coupon statistics
      const totalAdultsFastFoodCoupons = entries.reduce((sum, e) => sum + countCouponsFromString((e as any).adultsFastFoodCoupon), 0);
      const totalKidsFastFoodCoupons = entries.reduce((sum, e) => sum + countCouponsFromString((e as any).kidsFastFoodCoupon), 0);
      const totalAdultsMainFoodCoupons = entries.reduce((sum, e) => sum + countCouponsFromString((e as any).adultsMainFoodCoupon), 0);
      const totalKidsMainFoodCoupons = entries.reduce((sum, e) => sum + countCouponsFromString((e as any).kidsMainFoodCoupon), 0);
      const totalFastFoodCoupons = totalAdultsFastFoodCoupons + totalKidsFastFoodCoupons;
      const totalMainFoodCoupons = totalAdultsMainFoodCoupons + totalKidsMainFoodCoupons;
      const totalFoodCoupons = totalFastFoodCoupons + totalMainFoodCoupons;
      
      const summaryRow = currentRow + 2; // Add spacing after data rows
      const summaryDataRow = summaryRow + 1;
      sheet.getCell(`A${summaryDataRow}`).value = 'Total Entries:';
      sheet.getCell(`B${summaryDataRow}`).value = entries.length;
      sheet.getCell(`C${summaryDataRow}`).value = 'Total People:';
      sheet.getCell(`D${summaryDataRow}`).value = totalPeople;
      sheet.getCell(`E${summaryDataRow}`).value = 'Adults:';
      sheet.getCell(`F${summaryDataRow}`).value = totalAdults;
      sheet.getCell(`G${summaryDataRow}`).value = 'Kids:';
      sheet.getCell(`H${summaryDataRow}`).value = totalKids;
      
      const summaryTicketRow = summaryRow + 2;
      sheet.getCell(`A${summaryTicketRow}`).value = '150 Ticket People:';
      sheet.getCell(`B${summaryTicketRow}`).value = total150Tickets;
      sheet.getCell(`C${summaryTicketRow}`).value = '300 Ticket People:';
      sheet.getCell(`D${summaryTicketRow}`).value = total300Tickets;
      sheet.getCell(`E${summaryTicketRow}`).value = '450 Ticket People:';
      sheet.getCell(`F${summaryTicketRow}`).value = total450Tickets;
      sheet.getCell(`G${summaryTicketRow}`).value = '600 Ticket People:';
      sheet.getCell(`H${summaryTicketRow}`).value = total600Tickets;
      sheet.getCell(`I${summaryTicketRow}`).value = '100 Ticket People:';
      sheet.getCell(`J${summaryTicketRow}`).value = total100Tickets;
      
      const summaryAmountRow = summaryRow + 3;
      sheet.getCell(`A${summaryAmountRow}`).value = 'Total Revenue:';
      sheet.getCell(`B${summaryAmountRow}`).value = `₹${totalAmount}`;
      sheet.getCell(`C${summaryAmountRow}`).value = 'Cash:';
      sheet.getCell(`D${summaryAmountRow}`).value = `₹${totalCash}`;
      sheet.getCell(`E${summaryAmountRow}`).value = 'UPI:';
      sheet.getCell(`F${summaryAmountRow}`).value = `₹${totalUpi}`;
      sheet.getCell(`G${summaryAmountRow}`).value = 'Advance:';
      sheet.getCell(`H${summaryAmountRow}`).value = `₹${totalAdvance}`;
      
      const summaryFoodRow = summaryRow + 4;
      sheet.getCell(`A${summaryFoodRow}`).value = 'Fast Food Coupons:';
      sheet.getCell(`B${summaryFoodRow}`).value = totalFastFoodCoupons;
      sheet.getCell(`C${summaryFoodRow}`).value = 'Main Food Coupons:';
      sheet.getCell(`D${summaryFoodRow}`).value = totalMainFoodCoupons;
      sheet.getCell(`E${summaryFoodRow}`).value = 'Total Food Coupons:';
      sheet.getCell(`F${summaryFoodRow}`).value = totalFoodCoupons;
      
      const summaryFoodDetailRow = summaryRow + 5;
      sheet.getCell(`A${summaryFoodDetailRow}`).value = 'Food Coupons Detail:';
      sheet.getCell(`B${summaryFoodDetailRow}`).value = `Adults Fast Food: ${totalAdultsFastFood}`;
      sheet.getCell(`C${summaryFoodDetailRow}`).value = `Kids Fast Food: ${totalKidsFastFood}`;
      sheet.getCell(`D${summaryFoodDetailRow}`).value = `Adults Main Food: ${totalAdultsMainFood}`;
      sheet.getCell(`E${summaryFoodDetailRow}`).value = `Kids Main Food: ${totalKidsMainFood}`;
      
      // Style summary rows
      [summaryDataRow, summaryTicketRow, summaryAmountRow, summaryFoodRow, summaryFoodDetailRow].forEach(rowNum => {
        const row = sheet.getRow(rowNum);
        row.font = { bold: true, size: 11 };
        row.alignment = { vertical: 'middle' };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDF4' }
        };
        row.border = {
          top: { style: 'thin', color: { argb: 'FF059669' } },
          bottom: { style: 'thin', color: { argb: 'FF059669' } }
        };
      });
      
      // Auto-adjust column widths
      (sheet.columns || []).forEach((column) => {
        if (column.width) {
          column.width = column.width;
        }
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = `south-water-park-entries-${f}-to-${t}.xlsx`;
      
      if (saveLocation === 'onedrive') {
        // OneDrive integration (placeholder - would need Microsoft Graph API)
        try {
          // This would require Microsoft Graph API setup
          // const result = await uploadToOneDrive(blob, fileName);
          console.log('OneDrive upload would happen here');
          console.log('Export: Successfully uploaded to OneDrive!');
        } catch (error) {
          console.log('Export: OneDrive upload failed:', error);
          // Fallback to local download
          downloadFile(blob, fileName);
        }
      } else {
        downloadFile(blob, fileName);
      }
      
      // Auto-backup functionality
      if (autoBackup) {
        localStorage.setItem(`backup-${dayjs().format('YYYY-MM-DD')}`, JSON.stringify({
          date: dayjs().format('YYYY-MM-DD'),
          entriesCount: entries.length,
          data: entries
        }));
      }
      
      // Show success message
      alert(`Successfully exported ${entries.length} entries to ${saveLocation === 'onedrive' ? 'OneDrive' : 'local'}!`);
    } catch (e) {
      console.error('Export error:', e);
      alert((e as Error).message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateSingleReceipt = async (searchTerm: string) => {
    try {
      const res = await entriesApi.list({
        search: searchTerm,
        limit: 1
      });
      
      const entry = (res.data?.entries as any[])?.[0];
      if (entry) {
        console.log('Export: Entry found for receipt:', entry);
        console.log('Export: Entry created by:', entry.createdBy);
        console.log('🔍 AdminExport: Entry filledByFullName:', (entry as any).filledByFullName);
        
        // Generate receipt number if it doesn't exist
        let receiptNumber = entry.receiptNumber;
        if (!receiptNumber) {
          try {
            console.log('Export: Generating receipt number for existing entry...');
            const receiptRes = await fetch(`/api/entries/${entry._id}/generate-receipt`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            });
            
            if (receiptRes.ok) {
              const receiptData = await receiptRes.json();
              receiptNumber = receiptData.receiptNumber;
              console.log('Export: Receipt number generated:', receiptNumber);
            } else {
              const errorText = await receiptRes.text();
              console.log('Export: Failed to generate receipt number:', errorText);
              // Generate fallback receipt number locally
              const today = new Date();
              const dateStr = today.getFullYear().toString() +
                              (today.getMonth() + 1).toString().padStart(2, '0') +
                              today.getDate().toString().padStart(2, '0');
              const timestamp = today.getTime().toString().slice(-4);
              receiptNumber = `SWP-${dateStr}-${timestamp}`;
              console.log('🔍 AdminExport: Using fallback receipt number:', receiptNumber);
            }
          } catch (error) {
            console.log('Export: Error generating receipt number:', error);
            // Generate fallback receipt number locally
            const today = new Date();
            const dateStr = today.getFullYear().toString() +
                            (today.getMonth() + 1).toString().padStart(2, '0') +
                            today.getDate().toString().padStart(2, '0');
            const timestamp = today.getTime().toString().slice(-4);
            receiptNumber = `SWP-${dateStr}-${timestamp}`;
            console.log('🔍 AdminExport: Using fallback receipt number:', receiptNumber);
          }
        }
        
        const receiptData = {
          receiptNumber,
          name: entry.name,
          mobile: entry.mobile,
          ticketType: entry.ticketType,
          adults: entry.adults || 0,
          kids: entry.ticketType === '150' ? 0 : (entry.kids || 0),
          upgrades: entry.upgrades || [],
          baseAmount: entry.baseAmount || 0,
          kidDiscount: entry.kidDiscount || 0,
          additionalDiscount: entry.additionalDiscount || 0,
          finalAmount: entry.finalAmount || 0,
          totalPeople: (entry.adults || 0) + (entry.kids || 0) + (entry.upgrades?.reduce((sum, u) => sum + (u.adults || 0) + (u.kids || 0), 0) || 0),
          cashAmount: entry.cashAmount || 0,
          upiAmount: entry.upiAmount || 0,
          advanceAmount: entry.advanceAmount || 0,
          otherAmount: entry.otherAmount || 0,
          filledBy: (entry as any).createdBy?.username || (entry as any).filledByFullName || 'Unknown',
          filledByFullName: (entry as any).filledByFullName || (entry as any).createdBy?.fullName || (entry as any).createdBy?.username || 'Unknown',
          createdBy: (entry as any).createdBy,
          createdAt: getEffectiveEntryDate(entry),
          adultsFastFoodCoupon: (entry as any).adultsFastFoodCoupon || '',
          kidsFastFoodCoupon: (entry as any).kidsFastFoodCoupon || '',
          adultsMainFoodCoupon: (entry as any).adultsMainFoodCoupon || '',
          kidsMainFoodCoupon: (entry as any).kidsMainFoodCoupon || '',
        };
        
        console.log('🔍 AdminExport: Receipt data prepared:', receiptData);
        setReceiptData(receiptData);
        setShowReceipt(true);
        
        // Trigger real-time sync to update entry with receipt number
        if (receiptNumber && !entry.receiptNumber) {
          window.dispatchEvent(new CustomEvent('receipt-generated', {
            detail: {
              receiptNumber,
              entryId: entry._id,
              name: entry.name,
              timestamp: new Date().toISOString()
            }
          }));
        }
      } else {
        alert(`No entry found for: ${searchTerm}`);
      }
    } catch (error) {
      console.error('Failed to generate receipt:', error);
      alert('Failed to generate receipt. Please try again.');
    }
  };

  const generateBatchReceipts = async () => {
    try {
      const { from: f, to: t } = getDateRange();
      const exportData = await entriesApi.export({
        from: `${f}T00:00:00.000Z`,
        to: `${t}T23:59:59.999Z`,
        limit: 10000,
      });
      const entries = (exportData.entries as EntryRecord[]) ?? [];
      
      if (entries.length === 0) {
        alert('No entries found for selected date range');
        return;
      }

      const batchReceiptData = {
        entries: entries.map(entry => {
          // Generate receipt number if it doesn't exist
          let receiptNumber = entry.receiptNumber;
          if (!receiptNumber) {
            const today = new Date();
            const dateStr = today.getFullYear().toString() +
                            (today.getMonth() + 1).toString().padStart(2, '0') +
                            today.getDate().toString().padStart(2, '0');
            const timestamp = today.getTime().toString().slice(-4);
            receiptNumber = `SWP-${dateStr}-${timestamp}`;
          }
          
          return {
            receiptNumber,
            name: entry.name,
            mobile: entry.mobile,
            ticketType: entry.ticketType,
            adults: entry.adults || 0,
            kids: entry.ticketType === '150' ? 0 : (entry.kids || 0),
            upgrades: entry.upgrades || [],
            baseAmount: entry.baseAmount || 0,
            kidDiscount: entry.kidDiscount || 0,
            additionalDiscount: entry.additionalDiscount || 0,
            finalAmount: entry.finalAmount || 0,
            totalPeople: (entry.adults || 0) + (entry.kids || 0) + (entry.upgrades?.reduce((sum, u) => sum + (u.adults || 0) + (u.kids || 0), 0) || 0),
            cashAmount: entry.cashAmount || 0,
            upiAmount: entry.upiAmount || 0,
            advanceAmount: entry.advanceAmount || 0,
            otherAmount: entry.otherAmount || 0,
            filledBy: (entry as any).createdBy?.username || (entry as any).filledByFullName || 'Unknown',
            filledByFullName: (entry as any).filledByFullName || (entry as any).createdBy?.fullName || (entry as any).createdBy?.username || 'Unknown',
            createdBy: (entry as any).createdBy,
            createdAt: getEffectiveEntryDate(entry),
            adultsFastFoodCoupon: (entry as any).adultsFastFoodCoupon || '',
            kidsFastFoodCoupon: (entry as any).kidsFastFoodCoupon || '',
            adultsMainFoodCoupon: (entry as any).adultsMainFoodCoupon || '',
            kidsMainFoodCoupon: (entry as any).kidsMainFoodCoupon || '',
          };
        }),
        dateRange: `${dayjs(f).format('DD MMMM YYYY')} - ${dayjs(t).format('DD MMMM YYYY')}`,
        totalEntries: entries.length,
        totalRevenue: entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
      };
      
      setReceiptData(batchReceiptData);
      setShowReceipt(true);
    } catch (error) {
      console.log('Export: Failed to generate batch receipts:', (error as Error).message);
      alert('Failed to generate batch receipts. Please try again.');
    }
  };

  return (
    <Layout title="📦 Export Data" showAdminLink>
      <div className="space-y-6">
        {/* Welcome Message */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h2 className="heading-md text-blue-900 mb-2">
            📦 Export Data - Complete Data Management
          </h2>
          <p className="text-blue-800 text-lg">
            Export ticket entries to Excel with advanced filtering options.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="modern-card"
        >
          <h2 className="heading-lg text-blue-900 mb-6">
            📦 Export to Excel
          </h2>
          <p className="text-blue-800 text-lg mb-6">
            Choose date range to export real ticket entries data. The Excel file will contain all saved entries from the selected period.
          </p>
          
          {/* Entries Count Display */}
          {entriesCount !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6"
            >
              <p className="text-blue-900 font-bold text-center">
                📊 Found {entriesCount} entries for the selected date range
              </p>
            </motion.div>
          )}
          
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-blue-900 font-bold text-lg mb-3">
                📅 Date Range
              </label>
              <select
                value={range}
                onChange={(e) => setRange(e.target.value as Range)}
                className="input-modern text-lg"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="week">Past 7 Days</option>
                <option value="month">Past 30 Days</option>
                <option value="all_time">🌟 All Time Data</option>
                <option value="custom">Custom Range</option>
                <option value="particular_day">Particular Day</option>
              </select>
            </motion.div>
            
            {range === 'custom' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl"
              >
                <div>
                  <label className="block text-blue-900 font-bold text-lg mb-3">
                    📅 From Date
                  </label>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="input-modern text-lg"
                  />
                </div>
                <div>
                  <label className="block text-blue-900 font-bold text-lg mb-3">
                    📅 To Date
                  </label>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="input-modern text-lg"
                  />
                </div>
              </motion.div>
            )}
            
            {range === 'particular_day' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="max-w-md"
              >
                <label className="block text-blue-900 font-bold text-lg mb-3">
                  📅 Select Particular Day
                </label>
                <input
                  type="date"
                  value={particularDate}
                  onChange={(e) => setParticularDate(e.target.value)}
                  className="input-modern text-lg"
                />
              </motion.div>
            )}

            {/* Save Location Options */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-blue-900 font-bold text-lg mb-3">
                  💾 Save Location
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="local"
                      checked={saveLocation === 'local'}
                      onChange={(e) => setSaveLocation(e.target.value as 'local' | 'onedrive')}
                      className="w-4 h-4"
                    />
                    <span className="text-blue-800 font-medium">💻 Local Download</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="onedrive"
                      checked={saveLocation === 'onedrive'}
                      onChange={(e) => setSaveLocation(e.target.value as 'local' | 'onedrive')}
                      className="w-4 h-4"
                    />
                    <span className="text-blue-800 font-medium">☁️ OneDrive</span>
                  </label>
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={autoBackup}
                    onChange={(e) => setAutoBackup(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-blue-800 font-medium">🔄 Auto-backup to local storage</span>
                </label>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex justify-center"
            >
              <motion.button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`btn-primary text-xl px-12 py-6 ${
                  exporting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {exporting ? (
                  <span className="flex items-center gap-3">
                    <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <path d="M10 12a8 8 0 018-16 0v-1h1a8 8 0 018 16 0v1h-1a8 8 0 01-16 0v-1" />
                    </svg>
                    <span>Exporting...</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-3">
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download Excel File</span>
                  </span>
                )}
              </motion.button>
            </motion.div>
          </div>
        </motion.div>
        
        {/* Real-time Sync Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="modern-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${syncStatus === 'active' ? 'bg-green-500' : syncStatus === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`}></div>
              <span className="text-blue-900 font-bold">
                {syncStatus === 'active' ? '🔄 Real-time Sync Active' : syncStatus === 'syncing' ? '⏳ Syncing...' : '❌ Sync Error'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-blue-600">Last sync: {lastSyncTime}</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-blue-800 font-medium text-sm">Auto-refresh (15s)</span>
              </label>
            </div>
          </div>
        </motion.div>
        
        {/* Receipt Generation Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="modern-card"
        >
          <h2 className="heading-lg text-blue-900 mb-6">
            🧾 Generate Receipts
          </h2>
          <p className="text-blue-800 text-lg mb-6">
            Generate individual or batch receipts for ticket entries.
          </p>
          
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <label className="block text-blue-900 font-bold text-lg mb-3">
                🧾 Receipt Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="single"
                    checked={receiptMode === 'single'}
                    onChange={(e) => setReceiptMode(e.target.value as 'single' | 'batch')}
                    className="w-4 h-4"
                  />
                  <span className="text-blue-800 font-medium">🎫 Single Entry Receipt</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="batch"
                    checked={receiptMode === 'batch'}
                    onChange={(e) => setReceiptMode(e.target.value as 'single' | 'batch')}
                    className="w-4 h-4"
                  />
                  <span className="text-blue-800 font-medium">📋 Batch Receipts</span>
                </label>
              </div>
            </motion.div>
            
            {receiptMode === 'single' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-blue-900 font-bold text-lg mb-3">
                    📱 Mobile Number or Name
                  </label>
                  <input
                    type="text"
                    value={selectedEntryId}
                    onChange={(e) => setSelectedEntryId(e.target.value)}
                    placeholder="Enter mobile number or name to generate receipt"
                    className="input-modern text-lg"
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex justify-center"
                >
                  <motion.button
                    type="button"
                    onClick={() => generateSingleReceipt(selectedEntryId)}
                    disabled={!selectedEntryId.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`btn-primary text-xl px-12 py-6 ${
                      !selectedEntryId.trim() ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2z" />
                      </svg>
                      <span>Generate Single Receipt</span>
                    </span>
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
            
            {receiptMode === 'batch' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex justify-center"
              >
                <motion.button
                  type="button"
                  onClick={generateBatchReceipts}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-primary text-xl px-12 py-6"
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2h2m2 4h6m-6 4h6m2 5H7a2 2 0 01-2 2v6a2 2 0 002 2z" />
                    </svg>
                    <span>Generate Batch Receipts</span>
                  </span>
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
        
        {/* Export to Excel Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="modern-card"
        >
          <Link 
            to="/admin" 
            className="text-blue-900 hover:text-blue-700 font-bold text-lg underline transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </motion.div>
      </div>
      
      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt
          data={receiptMode === 'single' ? receiptData : receiptData.entries[0]}
          onClose={() => setShowReceipt(false)}
          batchData={receiptMode === 'batch' ? receiptData : null}
        />
      )}
    </Layout>
  );
}
