import { useEffect, useRef, useCallback } from 'react';

interface SyncEventData {
  event: string;
  data: any;
  timestamp: string;
}

interface UseRealTimeSyncOptions {
  onEntryCreated?: (entry: any) => void;
  onEntryUpdated?: (entry: any) => void;
  onEntryDeleted?: (entryId: string, entry: any) => void;
  onSyncRequired?: (data: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Event) => void;
}

export const useRealTimeSync = (options: UseRealTimeSyncOptions = {}) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 2000; // 2 seconds

  const connect = useCallback(() => {
    if (isConnectingRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    isConnectingRef.current = true;
    console.log('📡 Connecting to real-time sync...');

    try {
      const eventSource = new EventSource('/api/entries/sync');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('📡 Real-time sync connected');
        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;
        options.onConnected?.();
      };

      eventSource.onmessage = (event) => {
        try {
          const data: SyncEventData = JSON.parse(event.data);
          console.log('📡 Real-time sync event:', data);

          switch (data.event) {
            case 'connected':
              console.log('📡 Sync client connected:', data.data.clientId);
              break;

            case 'entry-created':
              console.log('📡 Entry created:', data.data.entry);
              options.onEntryCreated?.(data.data.entry);
              break;

            case 'entry-updated':
              console.log('📡 Entry updated:', data.data.entry);
              options.onEntryUpdated?.(data.data.entry);
              break;

            case 'entry-deleted':
              console.log('📡 Entry deleted:', data.data.entryId);
              options.onEntryDeleted?.(data.data.entryId, data.data.entry);
              break;

            case 'sync-required':
              console.log('📡 Sync required:', data.data);
              options.onSyncRequired?.(data.data);
              break;

            case 'heartbeat':
              // Just a heartbeat to keep connection alive
              break;

            default:
              console.log('📡 Unknown sync event:', data);
          }
        } catch (error) {
          console.error('📡 Error parsing sync event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('📡 Real-time sync error:', error);
        isConnectingRef.current = false;
        options.onError?.(error);

        // Attempt to reconnect if not explicitly closed
        if (eventSource.readyState !== EventSource.CLOSED) {
          reconnect();
        }
      };

      eventSource.onclose = () => {
        console.log('📡 Real-time sync disconnected');
        isConnectingRef.current = false;
        options.onDisconnected?.();
      };

    } catch (error) {
      console.error('📡 Failed to create EventSource:', error);
      isConnectingRef.current = false;
      options.onError?.(error as Event);
    }
  }, [options]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectingRef.current = false;
    reconnectAttemptsRef.current = 0;
    console.log('📡 Real-time sync disconnected');
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('📡 Max reconnection attempts reached');
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttemptsRef.current++;
    const delay = reconnectDelay * Math.pow(2, reconnectAttemptsRef.current - 1); // Exponential backoff

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

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: manualReconnect,
    disconnect
  };
};
