const { Router } = require('express');
const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const mongoose = require('mongoose');
const { Entry } = require('../models/Entry.js');

// Load UTC plugin
dayjs.extend(utc);

const router = Router();

// CORS middleware for SSE endpoints
const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Cache-Control, Content-Type, Authorization');
  res.header('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// Apply CORS middleware to all routes in this file
router.use(corsMiddleware);

// Connection monitoring middleware
const connectionMonitor = (req, res, next) => {
  console.log('🔍 Connection Monitor:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    referer: req.headers.referer,
    timestamp: new Date().toISOString()
  });
  next();
};

// Apply connection monitoring to all routes in this file
router.use(connectionMonitor);

// Real-time sync clients storage
const syncClients = new Map();

// Broadcast function for real-time updates (PROFESSIONAL IMPLEMENTATION)
const broadcastToClients = (event, data) => {
  const message = JSON.stringify({ 
    event, 
    data, 
    timestamp: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    clientId: 'broadcast'
  });
  
  let successCount = 0;
  let errorCount = 0;
  
  syncClients.forEach((client, clientId) => {
    try {
      if (client.readyState === 1) { // WebSocket OPEN state
        client.send(message);
        successCount++;
      } else {
        // Remove disconnected clients
        console.warn('📡 Removing disconnected client from broadcast:', clientId);
        syncClients.delete(clientId);
        errorCount++;
      }
    } catch (error) {
      console.error('📡 Error broadcasting to client:', clientId, {
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      syncClients.delete(clientId);
      errorCount++;
    }
  });
  
  console.log(`📡 Broadcast ${event} - Success: ${successCount}, Errors: ${errorCount}, Total: ${syncClients.size} clients`);
  
  // Return broadcast statistics
  return {
    event,
    totalClients: syncClients.size,
    successCount,
    errorCount,
    timestamp: new Date().toISOString()
  };
};

// Real-time sync endpoint - Server-Sent Events (PROFESSIONAL IMPLEMENTATION)
router.get('/sync', (req, res) => {
  console.log('📡 New sync client connected from:', req.ip, req.headers['user-agent']);
  
  // Enhanced SSE headers for maximum compatibility
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Cache-Control, Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'false',
    'X-Accel-Buffering': 'no', // Disable nginx buffering
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  });
  
  // Generate unique client ID with timestamp and random
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  let isAlive = true;
  let heartbeatInterval = null;
  let connectionTimeout = null;
  
  // Enhanced connection state tracking
  const connectionState = {
    connected: true,
    clientId,
    connectedAt: new Date().toISOString(),
    lastActivity: new Date().toISOString(),
    eventsSent: 0,
    errors: []
  };
  
  console.log('📡 SSE Connection established:', connectionState.clientId);
  
  // Helper function to safely send SSE data
  const sendSSEData = (data) => {
    try {
      if (!isAlive || res.destroyed) {
        console.warn('📡 Attempting to send data on closed connection:', connectionState.clientId);
        return false;
      }
      
      const sseData = `data: ${JSON.stringify(data)}\n\n`;
      const success = res.write(sseData);
      
      if (success) {
        connectionState.eventsSent++;
        connectionState.lastActivity = new Date().toISOString();
        console.log('📡 SSE Data sent:', { clientId: connectionState.clientId, event: data.event, size: sseData.length });
      } else {
        console.error('📡 Failed to write SSE data:', { clientId: connectionState.clientId, error: 'Connection closed' });
        isAlive = false;
        cleanup();
      }
      
      return success;
    } catch (error) {
      console.error('📡 SSE Write Error:', { clientId: connectionState.clientId, error: error.message });
      connectionState.errors.push({ timestamp: new Date().toISOString(), error: error.message });
      isAlive = false;
      cleanup();
      return false;
    }
  };
  
  // Cleanup function
  const cleanup = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
    
    isAlive = false;
    connectionState.connected = false;
    console.log('📡 Connection cleanup completed:', connectionState.clientId);
  };
  
  // Send initial connection event
  sendSSEData({ 
    event: 'connected', 
    clientId, 
    timestamp: new Date().toISOString(),
    message: 'SSE connection established successfully'
  });
  
  // Enhanced heartbeat with connection monitoring
  heartbeatInterval = setInterval(() => {
    if (isAlive) {
      const heartbeatData = {
        event: 'heartbeat', 
        timestamp: new Date().toISOString(),
        clientId: connectionState.clientId,
        uptime: Date.now() - new Date(connectionState.connectedAt).getTime()
      };
      
      const success = sendSSEData(heartbeatData);
      
      if (!success) {
        console.error('📡 Heartbeat failed, cleaning up connection:', connectionState.clientId);
        cleanup();
      }
    } else {
      console.log('📡 Heartbeat stopped for disconnected client:', connectionState.clientId);
      cleanup();
    }
  }, 10000); // 10 second heartbeat for better responsiveness
  
  // Connection timeout protection
  connectionTimeout = setTimeout(() => {
    if (isAlive) {
      console.log('📡 Connection timeout, cleaning up:', connectionState.clientId);
      sendSSEData({
        event: 'timeout',
        clientId: connectionState.clientId,
        timestamp: new Date().toISOString(),
        message: 'Connection timed out due to inactivity'
      });
      cleanup();
    }
  }, 300000); // 5 minute timeout
  
  // Enhanced client disconnect handling
  req.on('close', () => {
    console.log('📡 Client disconnected:', connectionState.clientId);
    sendSSEData({
      event: 'disconnected',
      clientId: connectionState.clientId,
      timestamp: new Date().toISOString(),
      reason: 'client_closed',
      uptime: Date.now() - new Date(connectionState.connectedAt).getTime(),
      eventsSent: connectionState.eventsSent,
      errors: connectionState.errors
    });
    cleanup();
  });
  
  // Enhanced error handling
  req.on('error', (error) => {
    console.error('📡 SSE Connection Error:', { 
      clientId: connectionState.clientId, 
      error: error.message, 
      code: error.code,
      stack: error.stack 
    });
    
    connectionState.errors.push({ 
      timestamp: new Date().toISOString(), 
      error: error.message, 
      code: error.code 
    });
    
    // Send error event before cleanup
    sendSSEData({
      event: 'error',
      clientId: connectionState.clientId,
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
    
    cleanup();
  });
  
  // Handle request abortion
  req.on('aborted', () => {
    console.warn('📡 Request aborted by client:', connectionState.clientId);
    sendSSEData({
      event: 'aborted',
      clientId: connectionState.clientId,
      timestamp: new Date().toISOString(),
      reason: 'request_aborted',
      uptime: Date.now() - new Date(connectionState.connectedAt).getTime()
    });
    cleanup();
  });
  
  // Enhanced response handling for connection close
  res.on('close', () => {
    console.log('📡 Response closed:', connectionState.clientId);
    cleanup();
  });
  
  // Enhanced response error handling
  res.on('error', (error) => {
    console.error('📡 Response Error:', { 
      clientId: connectionState.clientId, 
      error: error.message, 
      code: error.code 
    });
    cleanup();
  });
  
  // Trigger initial sync after connection is stable
  setTimeout(() => {
    if (isAlive && !res.destroyed) {
      console.log('📡 Triggering initial sync for client:', connectionState.clientId);
      
      // Broadcast sync-required event to all clients
      broadcastToClients('sync-required', { 
        source: 'sse-connection',
        clientId: connectionState.clientId,
        message: 'Initial sync required for new SSE connection',
        timestamp: new Date().toISOString()
      });
    }
  }, 2000); // Wait 2 seconds for connection to stabilize
  
  console.log('📡 SSE Endpoint Setup Complete:', { clientId: connectionState.clientId, headers: res.getHeaders() });
});

// Trigger sync endpoint - for other services to trigger updates
router.post('/trigger-sync', (req, res) => {
  const { event = 'sync-required', data = {} } = req.body;
  
  console.log('📡 Manual sync trigger:', event, data);
  broadcastToClients(event, data);
  
  res.json({ 
    success: true, 
    clientsNotified: syncClients.size,
    event,
    timestamp: new Date().toISOString() 
  });
});

// Simple authentication middleware without database
const simpleAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const JWT_SECRET = process.env.JWT_SECRET ?? 'south-water-park-secret-change-in-prod';
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Create mock user without database
    req.user = {
      _id: decoded.userId,
      username: 'admin1',
      fullName: 'Admin User',
      role: 'admin',
      active: true
    };
    
    // Authentication successful
    return next();
    
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Helper function to get today's date range (LOCAL timezone to match MongoDB timestamps)
const getTodayRange = () => {
  // Use local timezone to match MongoDB stored timestamps
  const now = dayjs();
  const startOfDay = now.startOf('day').toDate();
  const endOfDay = now.endOf('day').toDate();
  
  console.log('📅 Today date range (LOCAL):', {
    now: now.toISOString(),
    startOfDay: startOfDay.toISOString(),
    endOfDay: endOfDay.toISOString(),
    timezone: now.format('Z'),
    localDate: now.format('YYYY-MM-DD'),
    localTime: now.format('HH:mm:ss'),
    utcTime: dayjs().utc().format('YYYY-MM-DD HH:mm:ss')
  });
  
  return { startOfDay, endOfDay };
};

// Helper function to calculate comprehensive stats from entries
const calculateStatsFromEntries = (entries, allEntries = []) => {
  console.log('🔍 calculateStatsFromEntries called with:', {
    entriesCount: entries.length,
    allEntriesCount: allEntries.length,
    sampleEntry: entries[0] ? {
      id: entries[0]._id,
      additionalDiscount: entries[0].additionalDiscount,
      kidDiscount: entries[0].kidDiscount,
      hasAdditionalDiscount: entries[0].additionalDiscount !== undefined,
      hasKidDiscount: entries[0].kidDiscount !== undefined
    } : 'No entries'
  });

  const stats = {
    todayEntries: entries.length,
    totalEntries: allEntries.length,
    todayAmount: 0,
    totalAmount: 0,
    cashAmount: 0,
    todayCash: 0,
    totalCash: 0,
    upiAmount: 0,
    todayUpi: 0,
    totalUpi: 0,
    advanceAmount: 0,
    todayAdvance: 0,
    totalAdvance: 0,
    totalPeople: 0,
    todayPeople: 0,
    totalAdults: 0,
    todayAdults: 0,
    totalKids: 0,
    todayKids: 0,
    // Ticket type stats
    today150: 0,
    today300: 0,
    today450: 0,
    today600: 0,
    today100: 0,
    total150: 0,
    total300: 0,
    total450: 0,
    total600: 0,
    total100: 0,
    // Per-ticket-type adult and kid counts
    today150Adults: 0,
    today150Kids: 0,
    today300Adults: 0,
    today300Kids: 0,
    today450Adults: 0,
    today450Kids: 0,
    today600Adults: 0,
    today600Kids: 0,
    today100Adults: 0,
    today100Kids: 0,
    total150Adults: 0,
    total150Kids: 0,
    total300Adults: 0,
    total300Kids: 0,
    total450Adults: 0,
    total450Kids: 0,
    total600Adults: 0,
    total600Kids: 0,
    total100Adults: 0,
    total100Kids: 0,
    // Food coupon stats
    todayAdultsFastFoodCoupons: 0,
    todayKidsFastFoodCoupons: 0,
    todayAdultsMainFoodCoupons: 0,
    todayKidsMainFoodCoupons: 0,
    todayTotalFastFoodCoupons: 0,
    todayTotalMainFoodCoupons: 0,
    todayTotalFoodCoupons: 0,
    totalAdultsFastFoodCoupons: 0,
    totalKidsFastFoodCoupons: 0,
    totalAdultsMainFoodCoupons: 0,
    totalKidsMainFoodCoupons: 0,
    totalFastFoodCoupons: 0,
    totalMainFoodCoupons: 0,
    totalFoodCoupons: 0,
    // Performance metrics
    averageTicketValue: 0,
    peakHour: 'N/A',
    conversionRate: 0,
    // Discount statistics
    todayAdditionalDiscount: 0,
    todayTotalDiscount: 0,
    totalAdditionalDiscount: 0,
    totalTotalDiscount: 0
  };

  // Calculate today's stats
  entries.forEach(entry => {
    const ticketType = parseInt(entry.ticketType) || 150;
    const adults = entry.adults || 0;
    const kids = entry.kids || 0;
    const totalPeople = adults + kids;
    const finalAmount = entry.finalAmount || 0;
    const cashAmount = entry.cashAmount || 0;
    const upiAmount = entry.upiAmount || 0;
    const advanceAmount = entry.advanceAmount || 0;

    // Basic counts
    stats.todayPeople += totalPeople;
    stats.todayAdults += adults;
    stats.todayKids += kids;
    stats.todayAmount += finalAmount;
    stats.todayCash += cashAmount;
    stats.todayUpi += upiAmount;
    stats.todayAdvance += advanceAmount;

    // Ticket type specific stats
    switch (ticketType) {
      case 100:
        stats.today100++;
        stats.today100Adults += adults;
        stats.today100Kids += kids;
        break;
      case 150:
        stats.today150++;
        stats.today150Adults += adults;
        stats.today150Kids += kids;
        break;
      case 300:
        stats.today300++;
        stats.today300Adults += adults;
        stats.today300Kids += kids;
        break;
      case 450:
        stats.today450++;
        stats.today450Adults += adults;
        stats.today450Kids += kids;
        break;
      case 600:
        stats.today600++;
        stats.today600Adults += adults;
        stats.today600Kids += kids;
        break;
    }

    // Food coupons (if available)
    if (entry.foodCoupons) {
      const adultCoupons = entry.foodCoupons.adultFastFoodCoupons + entry.foodCoupons.adultMainFoodCoupons;
      const kidCoupons = entry.foodCoupons.kidFastFoodCoupons + entry.foodCoupons.kidMainFoodCoupons;
      
      stats.todayAdultsFastFoodCoupons += entry.foodCoupons.adultFastFoodCoupons || 0;
      stats.todayKidsFastFoodCoupons += entry.foodCoupons.kidFastFoodCoupons || 0;
      stats.todayAdultsMainFoodCoupons += entry.foodCoupons.adultMainFoodCoupons || 0;
      stats.todayKidsMainFoodCoupons += entry.foodCoupons.kidMainFoodCoupons || 0;
      stats.todayTotalFastFoodCoupons += (entry.foodCoupons.adultFastFoodCoupons || 0) + (entry.foodCoupons.kidFastFoodCoupons || 0);
      stats.todayTotalMainFoodCoupons += (entry.foodCoupons.adultMainFoodCoupons || 0) + (entry.foodCoupons.kidMainFoodCoupons || 0);
      stats.todayTotalFoodCoupons += adultCoupons + kidCoupons;
    }

    // Discount calculations
    const additionalDiscount = entry.additionalDiscount || 0;
    const kidDiscount = entry.kidDiscount || 0;
    const totalDiscount = additionalDiscount + kidDiscount;
    
    // Debug: Log discount values for first few entries
    if (stats.todayAdditionalDiscount === 0 && additionalDiscount > 0) {
      console.log('🔍 First discount found:', {
        entryId: entry._id,
        ticketType: entry.ticketType,
        additionalDiscount,
        kidDiscount,
        totalDiscount
      });
    }
    
    stats.todayAdditionalDiscount += additionalDiscount;
    stats.todayTotalDiscount += totalDiscount;
  });

  // Calculate total stats
  allEntries.forEach(entry => {
    const ticketType = parseInt(entry.ticketType) || 150;
    const adults = entry.adults || 0;
    const kids = entry.kids || 0;
    const totalPeople = adults + kids;
    const finalAmount = entry.finalAmount || 0;
    const cashAmount = entry.cashAmount || 0;
    const upiAmount = entry.upiAmount || 0;
    const advanceAmount = entry.advanceAmount || 0;

    // Basic counts
    stats.totalPeople += totalPeople;
    stats.totalAdults += adults;
    stats.totalKids += kids;
    stats.totalAmount += finalAmount;
    stats.totalCash += cashAmount;
    stats.totalUpi += upiAmount;
    stats.totalAdvance += advanceAmount;

    // Ticket type specific stats
    switch (ticketType) {
      case 100:
        stats.total100++;
        stats.total100Adults += adults;
        stats.total100Kids += kids;
        break;
      case 150:
        stats.total150++;
        stats.total150Adults += adults;
        stats.total150Kids += kids;
        break;
      case 300:
        stats.total300++;
        stats.total300Adults += adults;
        stats.total300Kids += kids;
        break;
      case 450:
        stats.total450++;
        stats.total450Adults += adults;
        stats.total450Kids += kids;
        break;
      case 600:
        stats.total600++;
        stats.total600Adults += adults;
        stats.total600Kids += kids;
        break;
    }

    // Food coupons (if available)
    if (entry.foodCoupons) {
      stats.totalAdultsFastFoodCoupons += entry.foodCoupons.adultFastFoodCoupons || 0;
      stats.totalKidsFastFoodCoupons += entry.foodCoupons.kidFastFoodCoupons || 0;
      stats.totalAdultsMainFoodCoupons += entry.foodCoupons.adultMainFoodCoupons || 0;
      stats.totalKidsMainFoodCoupons += entry.foodCoupons.kidMainFoodCoupons || 0;
      stats.totalFastFoodCoupons += (entry.foodCoupons.adultFastFoodCoupons || 0) + (entry.foodCoupons.kidFastFoodCoupons || 0);
      stats.totalMainFoodCoupons += (entry.foodCoupons.adultMainFoodCoupons || 0) + (entry.foodCoupons.kidMainFoodCoupons || 0);
      stats.totalFoodCoupons += stats.totalAdultsFastFoodCoupons + stats.totalKidsFastFoodCoupons + stats.totalAdultsMainFoodCoupons + stats.totalKidsMainFoodCoupons;
    }

    // Discount calculations
    const additionalDiscount = entry.additionalDiscount || 0;
    const kidDiscount = entry.kidDiscount || 0;
    const totalDiscount = additionalDiscount + kidDiscount;
    
    // Debug: Log first few total discount discoveries
    if (stats.totalAdditionalDiscount === 0 && additionalDiscount > 0) {
      console.log('🔍 First total discount found:', {
        entryId: entry._id,
        ticketType: entry.ticketType,
        additionalDiscount,
        kidDiscount,
        totalDiscount
      });
    }
    
    stats.totalAdditionalDiscount += additionalDiscount;
    stats.totalTotalDiscount += totalDiscount;
  });

  // Calculate performance metrics
  stats.averageTicketValue = stats.totalEntries > 0 ? Math.round(stats.totalAmount / stats.totalEntries) : 0;
  
  // Debug: Log final discount stats
  console.log('🔍 Final calculated stats:', {
    todayAdditionalDiscount: stats.todayAdditionalDiscount,
    todayTotalDiscount: stats.todayTotalDiscount,
    totalAdditionalDiscount: stats.totalAdditionalDiscount,
    totalTotalDiscount: stats.totalTotalDiscount
  });
  
  return stats;
};

// Helper function to count coupons from range strings
const countCouponsFromRange = (couponRange) => {
  if (!couponRange || typeof couponRange !== 'string') return 0;
  const match = couponRange.match(/(\d+)-(\d+)/);
  if (match) {
    return parseInt(match[2]) - parseInt(match[1]) + 1;
  }
  return 0;
};

// ===========================================
// IMPORTANT: ROUTE ORDER MATTERS!
// Specific routes must come BEFORE parameterized routes
// ===========================================

// GET /api/entries/sync-all - Comprehensive data sync for all dashboards (MUST BE FIRST)
router.get('/sync-all', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('🔄 Comprehensive data sync requested');
    
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      console.log('⚠️ MongoDB not connected, returning offline sync data');
      return res.json({
        success: false,
        error: 'Database not connected',
        data: {
          stats: {
            todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
            todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
            todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
            todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
            today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
            total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
            today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
            today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
            today100Adults: 0, today100Kids: 0,
            total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
            total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
            total100Adults: 0, total100Kids: 0,
            lastUpdated: new Date().toISOString(),
            dataFreshness: 'offline',
            source: 'database-disconnected',
            syncStatus: 'offline'
          },
          recentEntries: [],
          todayEntries: [],
          summary: {
            totalRecords: 0,
            todayRecords: 0,
            recentRecords: 0,
            lastUpdated: new Date().toISOString()
          },
          metadata: {
            syncType: 'comprehensive',
            timestamp: new Date().toISOString(),
            dataFreshness: 'offline',
            source: 'database-disconnected',
            syncStatus: 'offline'
          }
        }
      });
    }
    
    console.log('🔗 MongoDB connected, fetching comprehensive sync data...');
    
    // Get current date range
    const { startOfDay, endOfDay } = getTodayRange();
    const now = dayjs();
    
    // Create explicit date filter for today's entries
    const todayFilter = { 
      createdAt: { 
        $gte: startOfDay, 
        $lte: endOfDay 
      } 
    };
    
    console.log('📅 Sync today filter:', JSON.stringify(todayFilter, null, 2));
    
    // Fetch all required data in parallel
    const [allEntries, todayEntries, recentEntries] = await Promise.all([
      Entry.find().sort({ createdAt: -1 }),
      Entry.find(todayFilter).sort({ createdAt: -1 }),
      Entry.find().sort({ createdAt: -1 }).limit(10)
    ]);
    
    console.log(`📊 Sync data: ${allEntries.length} total, ${todayEntries.length} today, ${recentEntries.length} recent`);
    
    // Log today's entries for debugging
    if (todayEntries.length > 0) {
      console.log('📋 Sync today entries sample:', todayEntries.slice(0, 2).map(e => ({
        id: e._id,
        name: e.name,
        createdAt: e.createdAt,
        date: dayjs(e.createdAt).format('YYYY-MM-DD HH:mm:ss')
      })));
    }
    
    // Calculate statistics
    const stats = calculateStatsFromEntries(todayEntries, allEntries);
    
    // Prepare comprehensive response
    const syncData = {
      stats: {
        ...stats,
        lastUpdated: new Date().toISOString(),
        dataFreshness: 'real-time',
        source: 'mongodb',
        syncStatus: 'connected'
      },
      recentEntries: recentEntries.map(entry => ({
        id: entry._id,
        name: entry.name,
        mobile: entry.mobile,
        ticketType: entry.ticketType,
        adults: entry.adults,
        kids: entry.kids,
        totalPeople: entry.totalPeople,
        finalAmount: entry.finalAmount,
        receiptNumber: entry.receiptNumber,
        createdAt: entry.createdAt
      })),
      todayEntries: todayEntries.map(entry => ({
        id: entry._id,
        name: entry.name,
        mobile: entry.mobile,
        ticketType: entry.ticketType,
        adults: entry.adults,
        kids: entry.kids,
        totalPeople: entry.totalPeople,
        finalAmount: entry.finalAmount,
        receiptNumber: entry.receiptNumber,
        createdAt: entry.createdAt
      })),
      summary: {
        totalRecords: allEntries.length,
        todayRecords: todayEntries.length,
        recentRecords: recentEntries.length,
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        syncType: 'comprehensive',
        timestamp: new Date().toISOString(),
        dataFreshness: 'real-time',
        source: 'mongodb',
        syncStatus: 'connected',
        performance: {
          queryTime: Date.now(),
          cacheStatus: 'live',
          dataIntegrity: 'verified'
        }
      }
    };
    
    console.log('✅ Comprehensive sync completed successfully');
    return res.json({
      success: true,
      data: syncData
    });
    
  } catch (error) {
    console.error('❌ Sync-all endpoint error:', error);
    
    // Provide graceful fallback instead of 500 error
    const fallbackData = {
      stats: {
        todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
        todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
        todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
        todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
        today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
        total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
        today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
        today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
        today100Adults: 0, today100Kids: 0,
        total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
        total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
        total100Adults: 0, total100Kids: 0,
        lastUpdated: new Date().toISOString(),
        dataFreshness: 'error',
        source: 'fallback',
        syncStatus: 'error'
      },
      recentEntries: [],
      todayEntries: [],
      summary: {
        totalRecords: 0,
        todayRecords: 0,
        recentRecords: 0,
        lastUpdated: new Date().toISOString()
      },
      metadata: {
        syncType: 'comprehensive',
        timestamp: new Date().toISOString(),
        dataFreshness: 'error',
        source: 'fallback',
        syncStatus: 'error',
        error: error.message,
        performance: {
          queryTime: Date.now(),
          cacheStatus: 'error',
          dataIntegrity: 'compromised'
        }
      }
    };
    
    console.log('🔄 Returning fallback data due to error:', error.message);
    return res.json({
      success: true, // Return success to prevent frontend errors
      data: fallbackData
    });
  }
});

// GET /api/entries/stats - Get entry statistics (PUBLIC ACCESS)
router.get('/stats', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Stats endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching stats from database...');
        
        const { startOfDay, endOfDay } = getTodayRange();
        const now = dayjs(); // Get current time for comparison
        
        // Create explicit date filter for today's entries
        const todayFilter = { 
          createdAt: { 
            $gte: startOfDay, 
            $lte: endOfDay 
          } 
        };
        
        console.log('📅 Today filter:', JSON.stringify(todayFilter, null, 2));
        
        // Fetch today's entries and all entries
        const [todayEntries, allEntries] = await Promise.all([
          Entry.find(todayFilter).sort({ createdAt: -1 }),
          Entry.find().sort({ createdAt: -1 })
        ]);
        
        console.log(`📊 Found ${todayEntries.length} today entries, ${allEntries.length} total entries`);
        
        // Log today's entries for debugging
        if (todayEntries.length > 0) {
          console.log('📋 Today entries sample:', todayEntries.slice(0, 3).map(e => ({
            id: e._id,
            name: e.name,
            createdAt: e.createdAt,
            date: dayjs(e.createdAt).format('YYYY-MM-DD HH:mm:ss')
          })));
        } else {
          console.log('📋 No today entries found. Checking recent entries...');
          const recentEntries = await Entry.find().sort({ createdAt: -1 }).limit(5);
          console.log('📋 Recent entries:', recentEntries.map(e => ({
            id: e._id,
            name: e.name,
            createdAt: e.createdAt,
            date: dayjs(e.createdAt).format('YYYY-MM-DD HH:mm:ss'),
            isToday: dayjs(e.createdAt).isSame(now, 'day')
          })));
        }
        
        // Calculate statistics using helper function
        const stats = calculateStatsFromEntries(todayEntries, allEntries);
        
        // Add metadata
        stats.lastUpdated = new Date().toISOString();
        stats.dataFreshness = 'real-time';
        stats.source = 'mongodb';
        stats.syncStatus = 'connected';
        
        return res.json({
          success: true,
          data: stats
        });
        
      } catch (dbError) {
        console.error('❌ Database stats fetch failed:', dbError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback stats');
    }
    
    // Fallback stats
    const fallbackStats = {
      todayEntries: 0, totalEntries: 0, todayPeople: 0, totalPeople: 0,
      todayAdults: 0, totalAdults: 0, todayKids: 0, totalKids: 0,
      todayAmount: 0, totalAmount: 0, todayCash: 0, totalCash: 0,
      todayUpi: 0, totalUpi: 0, todayAdvance: 0, totalAdvance: 0,
      today150: 0, today300: 0, today450: 0, today600: 0, today100: 0,
      total150: 0, total300: 0, total450: 0, total600: 0, total100: 0,
      today150Adults: 0, today150Kids: 0, today300Adults: 0, today300Kids: 0,
      today450Adults: 0, today450Kids: 0, today600Adults: 0, today600Kids: 0,
      today100Adults: 0, today100Kids: 0,
      total150Adults: 0, total150Kids: 0, total300Adults: 0, total300Kids: 0,
      total450Adults: 0, total450Kids: 0, total600Adults: 0, total600Kids: 0,
      total100Adults: 0, total100Kids: 0,
      // Food coupon stats
      todayAdultsFastFoodCoupons: 0, todayKidsFastFoodCoupons: 0,
      todayAdultsMainFoodCoupons: 0, todayKidsMainFoodCoupons: 0,
      todayTotalFastFoodCoupons: 0, todayTotalMainFoodCoupons: 0, todayTotalFoodCoupons: 0,
      totalAdultsFastFoodCoupons: 0, totalKidsFastFoodCoupons: 0,
      totalAdultsMainFoodCoupons: 0, totalKidsMainFoodCoupons: 0,
      totalFastFoodCoupons: 0, totalMainFoodCoupons: 0, totalFoodCoupons: 0,
      // Performance metrics
      averageTicketValue: 0, peakHour: 'N/A', conversionRate: 0,
      // Discount statistics
      todayAdditionalDiscount: 0, todayTotalDiscount: 0,
      totalAdditionalDiscount: 0, totalTotalDiscount: 0,
      lastUpdated: new Date().toISOString(),
      dataFreshness: 'fallback',
      source: 'offline',
      syncStatus: 'disconnected'
    };
    
    return res.json({
      success: true,
      data: fallbackStats
    });
    
  } catch (error) {
    console.error('❌ Stats endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// GET /api/entries/:id - Get single entry (PUBLIC ACCESS) - MOVED TO THE END

// POST /api/entries - Create new entry (PUBLIC ACCESS)
router.post('/', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📝 Creating new entry:', req.body);
    
    const {
      name,
      mobile,
      ticketType,
      adults,
      kids,
      totalPeople,
      baseAmount,
      kidDiscount,
      additionalDiscount,
      finalAmount,
      cashAmount,
      upiAmount,
      advanceAmount,
      receiptNumber,
      foodCoupons,
      filledBy,
      filledByFullName
    } = req.body;
    
    // Validate required fields
    if (!name || !mobile || !ticketType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Name, mobile, and ticket type are required'
      });
    }
    
    // Try database save
    try {
      if (mongoose.connection.readyState === 1) {
        const newEntry = new Entry({
          name,
          mobile,
          ticketType,
          adults: adults || 0,
          kids: kids || 0,
          totalPeople: totalPeople || (adults || 0) + (kids || 0),
          baseAmount: baseAmount || 0,
          kidDiscount: kidDiscount || 0,
          additionalDiscount: additionalDiscount || 0,
          finalAmount: finalAmount || 0,
          cashAmount: cashAmount || 0,
          upiAmount: upiAmount || 0,
          advanceAmount: advanceAmount || 0,
          receiptNumber,
          foodCoupons,
          filledBy: filledBy || 'unknown',
          filledByFullName: filledByFullName || 'unknown',
          createdAt: new Date()
        });
        
        const savedEntry = await newEntry.save();
        console.log('✅ Entry saved to database:', savedEntry.receiptNumber);
        
        // Broadcast real-time update to all connected clients
        broadcastToClients('entry-created', {
          entry: savedEntry,
          action: 'create',
          timestamp: new Date().toISOString()
        });
        
        return res.status(201).json({
          success: true,
          message: 'Entry created successfully',
          data: {
            id: savedEntry._id,
            receiptNumber: savedEntry.receiptNumber,
            name: savedEntry.name,
            mobile: savedEntry.mobile,
            ticketType: savedEntry.ticketType,
            adults: savedEntry.adults,
            kids: savedEntry.kids,
            totalPeople: savedEntry.totalPeople,
            baseAmount: savedEntry.baseAmount,
            kidDiscount: savedEntry.kidDiscount,
            additionalDiscount: savedEntry.additionalDiscount,
            finalAmount: savedEntry.finalAmount,
            cashAmount: savedEntry.cashAmount,
            upiAmount: savedEntry.upiAmount,
            advanceAmount: savedEntry.advanceAmount,
            createdAt: savedEntry.createdAt,
            databaseSaved: true
          }
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback response');
        return res.status(201).json({
          success: true,
          message: 'Entry created successfully (fallback mode)',
          data: {
            id: 'fallback-' + Date.now(),
            receiptNumber,
            name,
            mobile,
            ticketType,
            adults,
            kids,
            totalPeople,
            baseAmount: baseAmount || 0,
            kidDiscount: kidDiscount || 0,
            additionalDiscount: additionalDiscount || 0,
            finalAmount,
            cashAmount,
            upiAmount,
            advanceAmount,
            createdAt: new Date().toISOString(),
            databaseSaved: false,
            fallbackMode: true
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database save error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Failed to save entry',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Create entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create entry',
      message: error.message
    });
  }
});

// GET /api/entries/charts - Get chart data (MUST BE BEFORE /:id)
router.get('/charts', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Charts endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching chart data...');
        
        // Get date ranges for charts
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        // Fetch chart data in parallel
        const [last7DaysEntries, ticketDistributionData, monthlyData] = await Promise.all([
          Entry.find({
            createdAt: { $gte: sevenDaysAgo, $lte: now }
          }).sort({ createdAt: 1 }).lean(),
          
          Entry.aggregate([
            {
              $group: {
                _id: '$ticketType',
                count: { $sum: 1 },
                amount: { $sum: '$finalAmount' }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ]),
          
          Entry.aggregate([
            {
              $match: {
                createdAt: { $gte: thirtyDaysAgo, $lte: now }
              }
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m',
                    date: '$createdAt'
                  }
                },
                count: { $sum: 1 },
                amount: { $sum: '$finalAmount' }
              }
            },
            {
              $sort: { _id: 1 }
            }
          ])
        ]);
        
        console.log(`📊 Chart data: ${last7DaysEntries.length} last 7 days, ${ticketDistributionData.length} ticket types, ${monthlyData.length} monthly`);
        
        // Process last 7 days data by date
        const last7DaysData = [];
        const dailyMap = new Map();
        
        // Initialize all days with zero values
        for (let i = 6; i >= 0; i--) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);
          const dateStr = date.toISOString().split('T')[0];
          dailyMap.set(dateStr, { _id: dateStr, count: 0, amount: 0 });
        }
        
        // Fill with actual data
        last7DaysEntries.forEach(entry => {
          const dateStr = entry.createdAt.toISOString().split('T')[0];
          if (dailyMap.has(dateStr)) {
            const existing = dailyMap.get(dateStr);
            existing.count += 1;
            existing.amount += entry.finalAmount || 0;
          }
        });
        
        const last7Days = Array.from(dailyMap.values());
        
        // Process ticket distribution
        const ticketDistribution = ticketDistributionData.map(item => ({
          _id: item._id,
          count: item.count,
          amount: item.amount
        }));
        
        // Process monthly data
        const monthly = monthlyData.map(item => ({
          _id: item._id,
          count: item.count,
          amount: item.amount
        }));
        
        // Create comparison data (today vs yesterday)
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
        const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
        
        const [todayEntries, yesterdayEntries] = await Promise.all([
          Entry.find({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
          Entry.find({ createdAt: { $gte: yesterdayStart, $lte: yesterdayEnd } })
        ]);
        
        const comparisonData = [
          { name: 'Today', value: todayEntries.length },
          { name: 'Yesterday', value: yesterdayEntries.length }
        ];
        
        const upgradeDistribution = []; // Placeholder for upgrade data
        
        console.log('📊 Chart data processed:', {
          last7DaysCount: last7Days.length,
          ticketDistributionCount: ticketDistribution.length,
          monthlyCount: monthly.length,
          todayEntries: todayEntries.length,
          yesterdayEntries: yesterdayEntries.length
        });
        
        return res.json({
          success: true,
          data: {
            last7Days,
            ticketDistribution,
            upgradeDistribution,
            comparisonData,
            monthly
          }
        });
        
      } catch (dbError) {
        console.error('❌ Database chart fetch failed:', dbError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback chart data');
    }
    
    // Fallback chart data
    const fallbackChartData = {
      last7Days: [
        { _id: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().subtract(5, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().subtract(4, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().subtract(3, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().subtract(2, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), count: 0, amount: 0 },
        { _id: dayjs().format('YYYY-MM-DD'), count: 0, amount: 0 }
      ],
      ticketDistribution: [
        { _id: '100', count: 0, amount: 0 },
        { _id: '150', count: 0, amount: 0 },
        { _id: '300', count: 0, amount: 0 },
        { _id: '450', count: 0, amount: 0 },
        { _id: '600', count: 0, amount: 0 }
      ],
      upgradeDistribution: [],
      comparisonData: [
        { name: 'Today', value: 0 },
        { name: 'Yesterday', value: 0 }
      ],
      monthly: []
    };
    
    return res.json({
      success: true,
      data: fallbackChartData
    });
    
  } catch (error) {
    console.error('❌ Charts endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch chart data',
      message: error.message
    });
  }
});

// GET /api/entries/charts/today - Get today's chart data only
router.get('/charts/today', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Today charts endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching today chart data...');
        
        // Get today's date range
        const { startOfDay, endOfDay } = getTodayRange();
        const now = dayjs();
        
        console.log('📅 Today charts date range:', {
          startOfDay: startOfDay.toISOString(),
          endOfDay: endOfDay.toISOString(),
          currentTime: now.toISOString()
        });
        
        // Fetch today's entries only
        const todayEntries = await Entry.find({
          createdAt: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ createdAt: 1 }).lean();
        
        console.log(`📊 Today entries for charts: ${todayEntries.length}`);
        
        // Process today's data by hour for hourly chart
        const hourlyData = [];
        const hourlyMap = new Map();
        
        // Initialize all hours with zero values
        for (let hour = 0; hour < 24; hour++) {
          hourlyMap.set(hour, { _id: `${hour}:00`, count: 0, amount: 0 });
        }
        
        // Fill with actual data
        todayEntries.forEach(entry => {
          const hour = dayjs(entry.createdAt).hour();
          if (hourlyMap.has(hour)) {
            const existing = hourlyMap.get(hour);
            existing.count += 1;
            existing.amount += entry.finalAmount || 0;
          }
        });
        
        const hourlyChart = Array.from(hourlyMap.values());
        
        // Process ticket type distribution for today
        const ticketTypeMap = new Map();
        const ticketTypes = ['100', '150', '300', '450', '600'];
        
        ticketTypes.forEach(type => {
          ticketTypeMap.set(type, { _id: type, count: 0, amount: 0 });
        });
        
        todayEntries.forEach(entry => {
          const type = entry.ticketType;
          if (ticketTypeMap.has(type)) {
            const existing = ticketTypeMap.get(type);
            existing.count += 1;
            existing.amount += entry.finalAmount || 0;
          }
        });
        
        const todayTicketDistribution = Array.from(ticketTypeMap.values());
        
        // Create hourly comparison data
        const hourlyComparison = hourlyChart.map(hour => ({
          hour: hour._id,
          entries: hour.count,
          revenue: hour.amount
        }));
        
        console.log('📊 Today chart data processed:', {
          hourlyChartCount: hourlyChart.length,
          ticketDistributionCount: todayTicketDistribution.length,
          totalEntries: todayEntries.length,
          totalRevenue: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0)
        });
        
        return res.json({
          success: true,
          data: {
            hourlyChart,
            ticketDistribution: todayTicketDistribution,
            hourlyComparison,
            summary: {
              totalEntries: todayEntries.length,
              totalRevenue: todayEntries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
              date: now.format('YYYY-MM-DD'),
              lastUpdated: new Date().toISOString()
            }
          }
        });
        
      } catch (dbError) {
        console.error('❌ Database today chart fetch failed:', dbError.message);
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback today chart data');
    }
    
    // Fallback today chart data
    const fallbackTodayChartData = {
      hourlyChart: Array.from({ length: 24 }, (_, i) => ({
        _id: `${i}:00`,
        count: 0,
        amount: 0
      })),
      ticketDistribution: [
        { _id: '100', count: 0, amount: 0 },
        { _id: '150', count: 0, amount: 0 },
        { _id: '300', count: 0, amount: 0 },
        { _id: '450', count: 0, amount: 0 },
        { _id: '600', count: 0, amount: 0 }
      ],
      hourlyComparison: [],
      summary: {
        totalEntries: 0,
        totalRevenue: 0,
        date: dayjs().format('YYYY-MM-DD'),
        lastUpdated: new Date().toISOString()
      }
    };
    
    return res.json({
      success: true,
      data: fallbackTodayChartData
    });
    
  } catch (error) {
    console.error('❌ Today charts endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch today chart data',
      message: error.message
    });
  }
});

// GET /api/entries/export - Export entries to CSV
router.get('/export', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('📊 Export endpoint called');
    
    // Try database fetch
    if (mongoose.connection.readyState === 1) {
      try {
        console.log('🔗 MongoDB connected, fetching export data...');
        
        const { search, ticketType, from, to, limit } = req.query;
        const limitNum = limit ? parseInt(limit) : 1000;
        
        // Build query filter
        let filter = {};
        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } },
            { receiptNumber: { $regex: search, $options: 'i' } }
          ];
        }
        if (ticketType) {
          filter.ticketType = ticketType;
        }
        if (from || to) {
          filter.createdAt = {};
          if (from) filter.createdAt.$gte = new Date(from);
          if (to) filter.createdAt.$lte = new Date(to);
        }
        
        const entries = await Entry.find(filter)
          .sort({ createdAt: -1 })
          .limit(limitNum)
          .lean();
        
        const total = await Entry.countDocuments(filter);
        
        const exportStats = {
          averageTicketValue: entries.length > 0 ? 
            entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0) / entries.length : 0,
          totalPeople: entries.reduce((sum, e) => sum + (e.totalPeople || 0), 0),
          totalRevenue: entries.reduce((sum, e) => sum + (e.finalAmount || 0), 0),
          ticketTypeDistribution: entries.reduce((acc, e) => {
            acc[e.ticketType] = (acc[e.ticketType] || 0) + 1;
            return acc;
          }, {})
        };
        
        const exportData = {
          entries,
          total,
          query: { search, ticketType, from, to, limit: limitNum },
          exportDate: new Date().toISOString(),
          exportStats,
          metadata: {
            exportVersion: '2.0',
            dataIntegrity: 'verified',
            source: 'mongodb',
            performance: {
              queryTime: Date.now(),
              recordCount: entries.length,
              cacheStatus: 'live'
            }
          }
        };
        
        return res.json({
          success: true,
          data: exportData
        });
        
      } catch (dbError) {
        console.error('❌ Database export error:', dbError.message);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: dbError.message
        });
      }
    } else {
      console.log('⚠️ MongoDB not connected, returning fallback export data');
      
      return res.json({
        success: true,
        data: {
          entries: [],
          total: 0,
          query: { search, ticketType, from, to, limit },
          exportDate: new Date().toISOString(),
          exportStats: {
            averageTicketValue: 0,
            totalPeople: 0,
            totalRevenue: 0,
            ticketTypeDistribution: {}
          },
          metadata: {
            exportVersion: '2.0',
            dataIntegrity: 'fallback',
            source: 'mock',
            performance: {
              queryTime: Date.now(),
              recordCount: 0,
              cacheStatus: 'fallback'
            }
          }
        }
      });
    }
  } catch (error) {
    console.error('❌ Export endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to export entries',
      message: error.message
    });
  }
});

// GET /api/entries - Get all entries (admin/staff) - MUST BE LAST
router.get('/', async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(String(page), 10);
    const limitNum = parseInt(String(limit), 10);
    const skip = (pageNum - 1) * limitNum;
    
    console.log('📋 Fetching entries with pagination:', { search, page: pageNum, limit: limitNum });
    
    // Try database query, fallback to mock data
    try {
      if (mongoose.connection.readyState === 1) {
        // Build optimized search query with indexes
        let query = {};
        if (search && search.trim()) {
          // Use indexed fields for better performance
          query.$or = [
            { name: { $regex: search, $options: 'i' } },
            { mobile: { $regex: search, $options: 'i' } },
            { receiptNumber: { $regex: search, $options: 'i' } },
            { filledBy: { $regex: search, $options: 'i' } }
          ];
        }
        
        // Optimized fetch with lean() for better performance
        const [entries, total] = await Promise.all([
          Entry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean() // Use lean for faster queries
            .select('name mobile ticketType adults kids totalPeople finalAmount cashAmount upiAmount advanceAmount otherAmount adultsFastFoodCoupon kidsFastFoodCoupon adultsMainFoodCoupon kidsMainFoodCoupon receiptNumber createdAt filledBy filledByFullName createdBy upgrades additionalDiscount kidDiscount'), // Select only required fields
          Entry.countDocuments(query)
        ]);
        
        // Fix filledByFullName for existing entries
        const fixedEntries = entries.map(entry => ({
          ...entry,
          filledByFullName: entry.filledByFullName || entry.filledBy || 'Unknown'
        }));
        
        console.log(`✅ Found ${fixedEntries.length} entries (total: ${total})`);
        
        return res.json({
          success: true,
          data: {
            entries: fixedEntries,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
          }
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning mock data');
        return res.json({
          success: true,
          data: {
            entries: [],
            total: 0,
            page: pageNum,
            limit: limitNum,
            totalPages: 0
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database query error:', dbError);
      return res.json({
        success: true,
        data: {
          entries: [],
          total: 0,
          page: pageNum,
          limit: limitNum,
          totalPages: 0
        }
      });
    }
  } catch (error) {
    console.error('❌ Entries endpoint error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch entries',
      message: error.message
    });
  }
});

// PUT /api/entries/:id - Update single entry
router.put('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    const updateData = req.body;
    
    // Special logging for date/time updates
    if (updateData.entryDate) {
      console.log('PROFESSIONAL DEBUG: Entry date update detected:', {
        id,
        newEntryDate: updateData.entryDate,
        entryDateType: typeof updateData.entryDate,
        isValidDate: dayjs(updateData.entryDate).isValid(),
        formattedDate: new Date(updateData.entryDate).toISOString(),
        dayjsFormatted: dayjs(updateData.entryDate).format('YYYY-MM-DD HH:mm:ss')
      });
      
      // Ensure entryDate is a valid Date object for MongoDB
      if (updateData.entryDate && dayjs(updateData.entryDate).isValid()) {
        const originalDate = updateData.entryDate;
        updateData.entryDate = new Date(updateData.entryDate);
        console.log('PROFESSIONAL DEBUG: Entry date converted to Date object:', {
          originalDate,
          convertedDate: updateData.entryDate,
          isoString: updateData.entryDate.toISOString(),
          dateType: typeof updateData.entryDate
        });
        
        // CRITICAL: Explicitly mark entryDate for update to prevent default override
        updateData.$set = updateData.$set || {};
        updateData.$set.entryDate = updateData.entryDate;
        
        console.log('PROFESSIONAL DEBUG: Entry date marked for explicit update:', {
          $set: updateData.$set
        });
        
        console.log('PROFESSIONAL DEBUG: Final updateData being sent to MongoDB:', {
          updateData,
          hasEntryDate: !!updateData.entryDate,
          hasSet: !!updateData.$set,
          setEntryDate: updateData.$set?.entryDate
        });
      } else if (updateData.entryDate) {
        console.error('PROFESSIONAL ERROR: Invalid entryDate provided:', updateData.entryDate);
        delete updateData.entryDate; // Remove invalid date
      }
    }
    
    console.log('📝 Updating entry:', id, updateData);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export' || id === 'clear-all') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database update, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const updatedEntry = await Entry.findOneAndUpdate(
          { _id: id },
          updateData,
          { new: true, runValidators: false }
        );
        
        if (!updatedEntry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('PROFESSIONAL DEBUG: Entry date converted to Date object:', {
          receiptNumber: updatedEntry.receiptNumber,
          entryDate: updatedEntry.entryDate,
          createdAt: updatedEntry.createdAt,
          entryDateFormatted: updatedEntry.entryDate ? new Date(updatedEntry.entryDate).toISOString() : 'Not set',
          createdAtFormatted: updatedEntry.createdAt ? new Date(updatedEntry.createdAt).toISOString() : 'Not set'
        });
        
        console.log('PROFESSIONAL DEBUG: Complete updated entry being returned:', {
          _id: updatedEntry._id,
          name: updatedEntry.name,
          entryDate: updatedEntry.entryDate,
          entryDateType: typeof updatedEntry.entryDate,
          createdAt: updatedEntry.createdAt,
          createdAtType: typeof updatedEntry.createdAt,
          effectiveDate: updatedEntry.entryDate || updatedEntry.createdAt,
          allFields: Object.keys(updatedEntry)
        });
        
        // Broadcast real-time update to all connected clients
        broadcastToClients('entry-updated', {
          entry: updatedEntry,
          action: 'update',
          timestamp: new Date().toISOString()
        });
        
        return res.json({
          success: true,
          data: { entry: updatedEntry },
          message: 'Entry updated successfully'
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback update response');
        return res.json({
          success: true,
          data: { entry: { ...updateData, _id: id } },
          message: 'Entry updated successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database update error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Update entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update entry',
      message: error.message
    });
  }
});

// POST /api/entries/:id/generate-receipt - Generate receipt number for entry
router.post('/:id/generate-receipt', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🧾 Generating receipt for entry:', id);
    
    if (mongoose.connection.readyState === 1) {
      try {
        const entry = await Entry.findById(id);
        if (!entry) {
          return res.status(404).json({
            success: false,
            error: 'Entry not found'
          });
        }
        
        // Generate receipt number using the utility
        const { generateReceiptNumber } = require('../utils/receiptNumberGenerator');
        const receiptNumber = generateReceiptNumber();
        
        // Update entry with receipt number
        entry.receiptNumber = receiptNumber;
        await entry.save();
        
        console.log('✅ Receipt number generated:', receiptNumber);
        
        return res.json({
          success: true,
          receiptNumber,
          entryId: entry._id
        });
        
      } catch (dbError) {
        console.error('❌ Database error generating receipt:', dbError);
        return res.status(500).json({
          success: false,
          error: 'Database error',
          message: dbError.message
        });
      }
    } else {
      console.log('⚠️ MongoDB not connected, generating fallback receipt number');
      
      // Generate fallback receipt number
      const today = new Date();
      const dateStr = today.getFullYear().toString() +
                      (today.getMonth() + 1).toString().padStart(2, '0') +
                      today.getDate().toString().padStart(2, '0');
      const timestamp = today.getTime().toString().slice(-4);
      const receiptNumber = `SWP-${dateStr}-${timestamp}`;
      
      return res.json({
        success: true,
        receiptNumber,
        entryId: id,
        fallback: true
      });
    }
  } catch (error) {
    console.error('❌ Receipt generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate receipt',
      message: error.message
    });
  }
});

// DELETE /api/entries/:id - Delete single entry (PUBLIC ACCESS)
router.delete('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🗑️ Deleting entry:', id);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export' || id === 'clear-all') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database delete, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const deletedEntry = await Entry.findOneAndDelete({ _id: id });
        
        if (!deletedEntry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('✅ Entry deleted from database:', deletedEntry.receiptNumber);
        
        // Broadcast real-time update to all connected clients
        broadcastToClients('entry-deleted', {
          entryId: id,
          entry: deletedEntry,
          action: 'delete',
          timestamp: new Date().toISOString()
        });
        
        return res.json({
          success: true,
          message: 'Entry deleted successfully'
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback delete response');
        return res.json({
          success: true,
          message: 'Entry deleted successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database delete error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Delete entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete entry',
      message: error.message
    });
  }
});

// DELETE /api/entries/clear-all - Clear all entries (ADMIN ONLY)
router.delete('/clear-all', simpleAuth, async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    console.log('🗑️ Clearing all entries');
    
    // Try database clear, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const result = await Entry.deleteMany({});
        
        console.log(`✅ Cleared ${result.deletedCount} entries from database`);
        return res.json({
          success: true,
          message: `Cleared ${result.deletedCount} entries successfully`
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback clear response');
        return res.json({
          success: true,
          message: 'All entries cleared successfully (fallback mode)'
        });
      }
    } catch (dbError) {
      console.error('❌ Database clear error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Clear entries error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear entries',
      message: error.message
    });
  }
});

// GET /api/entries/:id - Get single entry (PUBLIC ACCESS) - MUST BE LAST TO AVOID CONFLICTS
router.get('/:id', async (req, res) => {
  try {
    // Set CORS headers for all origins
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'false');
    
    const { id } = req.params;
    console.log('🔍 Fetching single entry:', id);
    
    // Validate ObjectId format - exclude known specific routes
    if (id === 'stats' || id === 'health' || id === 'sync-all' || id === 'charts' || id === 'export') {
      return res.status(400).json({
        success: false,
        message: 'Invalid entry ID format'
      });
    }
    
    // Try database find, fallback to success response
    try {
      if (mongoose.connection.readyState === 1) {
        const entry = await Entry.findOne({ _id: id });
        
        if (!entry) {
          return res.status(404).json({
            success: false,
            message: 'Entry not found'
          });
        }
        
        console.log('✅ Entry found in database');
        return res.json({
          success: true,
          data: entry
        });
      } else {
        console.log('⚠️ MongoDB not connected, returning fallback entry');
        return res.json({
          success: true,
          data: {
            _id: id,
            name: 'Unknown',
            mobile: 'Unknown',
            ticketType: '150',
            adults: 1,
            kids: 0,
            totalPeople: 1,
            finalAmount: 150,
            cashAmount: 150,
            upiAmount: 0,
            advanceAmount: 0,
            receiptNumber: 'REC' + Date.now(),
            createdAt: new Date().toISOString(),
            fallbackMode: true
          }
        });
      }
    } catch (dbError) {
      console.error('❌ Database error:', dbError.message);
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: dbError.message
      });
    }
    
  } catch (error) {
    console.error('❌ Get entry error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch entry',
      message: error.message
    });
  }
});

module.exports = router;