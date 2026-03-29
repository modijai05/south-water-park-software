import { useEffect, useRef, useCallback } from 'react';

interface SyncEventData {
  event: string;
  data?: any;
  clientId?: string; // For backward compatibility
  entryId?: string; // For backward compatibility
  entry?: any; // For backward compatibility
  timestamp: string;
}

interface UseRealTimeSyncOptions {
  onEntryCreated?: (entry: any) => void;
  onEntryUpdated?: (entry: any) => void;
  onEntryDeleted?: (entryId: string, entry: any) => void;
  onSyncRequired?: (data: any) => void;
  onReceiptGenerated?: (data: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

export const useRealTimeSync = (options: UseRealTimeSyncOptions = {}) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 1000;
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const connectionIdRef = useRef<string | null>(null);

  const connect = useCallback(() => {
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    console.log('📡 Connecting to real-time sync...');

    try {
      // Add cache-busting parameter to prevent connection issues
      const timestamp = Date.now();
      const eventSource = new EventSource(`/api/entries/sync?t=${timestamp}`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('📡 Real-time sync connected');
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        lastActivityRef.current = Date.now();
        options.onConnected?.();
        
        // Start heartbeat monitoring
        startHeartbeatMonitoring();
      };

      eventSource.onmessage = (event) => {
        try {
          lastActivityRef.current = Date.now();
          
          // Handle empty or malformed events
          if (!event.data || event.data.trim() === '') {
            console.warn('📡 Received empty event, ignoring');
            return;
          }

          let parsedData: SyncEventData;
          try {
            parsedData = JSON.parse(event.data);
          } catch (parseError) {
            console.error('📡 JSON parse error:', parseError, 'Raw data:', event.data);
            return;
          }

          // Validate event structure
          if (!parsedData || typeof parsedData !== 'object') {
            console.warn('📡 Invalid event structure:', parsedData);
            return;
          }

          // Ensure event has required fields
          if (!parsedData.event) {
            console.warn('📡 Missing event field:', parsedData);
            return;
          }

          console.log('📡 Real-time sync event:', parsedData);

          // Handle different event types with robust error handling
          switch (parsedData.event) {
            case 'connected':
              // Handle both old and new formats
              const clientId = parsedData.data?.clientId || parsedData.clientId || 'unknown';
              connectionIdRef.current = clientId;
              console.log('📡 Sync client connected:', clientId);
              break;

            case 'entry-created':
              if (parsedData.data?.entry) {
                console.log('📡 Entry created:', parsedData.data.entry);
                options.onEntryCreated?.(parsedData.data.entry);
              } else {
                console.warn('📡 Entry created event missing entry data:', parsedData);
              }
              break;

            case 'entry-updated':
              if (parsedData.data?.entry) {
                console.log('📡 Entry updated:', parsedData.data.entry);
                options.onEntryUpdated?.(parsedData.data.entry);
              } else {
                console.warn('📡 Entry updated event missing entry data:', parsedData);
              }
              break;

            case 'entry-deleted':
              const entryId = parsedData.data?.entryId || parsedData.entryId;
              const entry = parsedData.data?.entry || parsedData.entry;
              if (entryId) {
                console.log('📡 Entry deleted:', entryId);
                options.onEntryDeleted?.(entryId, entry);
              } else {
                console.warn('📡 Entry deleted event missing entryId:', parsedData);
              }
              break;

            case 'sync-required':
              console.log('📡 Sync required:', parsedData.data || parsedData);
              options.onSyncRequired?.(parsedData.data || parsedData);
              break;

            case 'receipt-generated':
              console.log('📡 Receipt generated:', parsedData.data || parsedData);
              options.onReceiptGenerated?.(parsedData.data || parsedData);
              break;

            case 'heartbeat':
              lastActivityRef.current = Date.now();
              console.log('📡 Heartbeat received');
              break;

            default:
              console.log('📡 Unknown sync event:', parsedData);
          }
        } catch (error) {
          console.error('📡 Error processing sync event:', error, 'Event data:', event.data);
        }
      };

      eventSource.addEventListener('error', (error) => {
        console.error('📡 Real-time sync error:', error);
        console.error('📡 Connection state:', {
          readyState: eventSource.readyState,
          url: eventSource.url,
          withCredentials: eventSource.withCredentials
        });
        
        isConnectingRef.current = false;
        
        // Provide detailed error information
        const errorDetails = {
          type: error.type,
          message: (error as any).message || 'Unknown SSE error',
          timestamp: new Date().toISOString(),
          connectionId: connectionIdRef.current
        };
        
        options.onError?.(error as Event);

        // Don't reconnect if it's a network error or explicit close
        if (error.type === 'error' && eventSource.readyState === EventSource.CLOSED) {
          console.warn('📡 Connection closed, will attempt reconnection');
          setTimeout(() => {
            if (eventSource.readyState === EventSource.CLOSED) {
              reconnect();
            }
          }, 1000);
        }
      });

      eventSource.addEventListener('close', () => {
        console.log('📡 Real-time sync disconnected');
        isConnectingRef.current = false;
        options.onDisconnected?.();
      });

    } catch (error) {
      console.error('📡 Failed to create EventSource:', error);
      isConnectingRef.current = false;
      options.onError?.(error as Event);
    }
  }, [options]);

  const startHeartbeatMonitoring = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // If no activity for 45 seconds, consider connection stale
      if (timeSinceLastActivity > 45000) {
        console.warn('📡 Connection appears stale, reconnecting...');
        disconnect();
        setTimeout(connect, 1000);
      }
    }, 10000); // Check every 10 seconds
  }, []);

  const disconnect = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      const connectionId = connectionIdRef.current;
      console.log('📡 Disconnecting sync connection:', connectionId);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    connectionIdRef.current = null;
    console.log('📡 Real-time sync disconnected');
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('📡 Max reconnection attempts reached, please refresh the page');
      // Show user notification
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sync-connection-failed', {
          detail: { message: 'Real-time sync connection failed. Please refresh the page.' }
        }));
      }
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current++;
    const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttemptsRef.current - 1), 30000); // Cap at 30 seconds

    console.log(`📡 Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  // Manual reconnect function
  const manualReconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible, check connection
        if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
          console.log('📡 Page became visible, reconnecting...');
          manualReconnect();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [manualReconnect]);

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: manualReconnect,
    disconnect,
    connectionId: connectionIdRef.current,
    connectionState: eventSourceRef.current?.readyState ?? EventSource.CLOSED
  };
};
