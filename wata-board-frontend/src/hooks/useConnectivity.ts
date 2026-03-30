import { useState, useEffect, useCallback, useRef } from 'react';

export interface ConnectivityStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string | null;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean;
}

export interface OfflineAction {
  id: string;
  type: 'payment' | 'review' | 'other';
  data: any;
  timestamp: number;
  retryCount: number;
}

const defaultConnectivityStatus: ConnectivityStatus = {
  isOnline: navigator.onLine,
  isOffline: !navigator.onLine,
  connectionType: null,
  effectiveType: null,
  downlink: null,
  rtt: null,
  saveData: false,
};

export function useConnectivity() {
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>(defaultConnectivityStatus);
  const [offlineActions, setOfflineActions] = useState<OfflineAction[]>([]);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const serviceWorkerRef = useRef<ServiceWorkerRegistration | null>(null);

  // Get detailed connection information
  const getConnectionInfo = useCallback((): Partial<ConnectivityStatus> => {
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (!connection) {
      return {};
    }

    return {
      connectionType: connection.type || 'unknown',
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || null,
      rtt: connection.rtt || null,
      saveData: connection.saveData || false,
    };
  }, []);

  // Update connectivity status
  const updateConnectivity = useCallback((online: boolean) => {
    const connectionInfo = getConnectionInfo();
    const newStatus: ConnectivityStatus = {
      isOnline: online,
      isOffline: !online,
      ...connectionInfo,
      saveData: connectionInfo.saveData || false,
    };

    setConnectivity(newStatus);

    // Notify service worker
    if (serviceWorkerRef.current?.active) {
      serviceWorkerRef.current.active.postMessage({
        type: 'CONNECTIVITY_CHANGE',
        isOnline: online,
      });
    }

    // Trigger reconnection process if coming back online
    if (online && offlineActions.length > 0) {
      setIsReconnecting(true);
      // We'll trigger processOfflineActions in a separate effect or after state update
    }
  }, [getConnectionInfo, offlineActions.length]);

  // Handle reconnection when status changes to online
  useEffect(() => {
    if (connectivity.isOnline && offlineActions.length > 0 && !isReconnecting) {
      setIsReconnecting(true);
      processOfflineActions();
    }
  }, [connectivity.isOnline]);

  // Process offline actions when back online
  const processOfflineActions = useCallback(async () => {
    if (offlineActions.length === 0) return;

    console.log(`[Connectivity] Processing ${offlineActions.length} offline actions`);

    for (const action of offlineActions) {
      try {
        await retryAction(action);
        // Remove from state and DB
        setOfflineActions(prev => prev.filter(a => a.id !== action.id));
        await removeOfflineAction(action.id);
      } catch (error) {
        console.error(`[Connectivity] Failed to retry action ${action.id}:`, error);
        
        // Update retry count
        setOfflineActions(prev => 
          prev.map(a => 
            a.id === action.id 
              ? { ...a, retryCount: a.retryCount + 1 }
              : a
          )
        );
      }
    }

    setIsReconnecting(false);
  }, [offlineActions]);

  // Retry a specific action
  const retryAction = useCallback(async (action: OfflineAction): Promise<void> => {
    switch (action.type) {
      case 'payment':
        const response = await fetch('/api/payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(action.data),
        });

        if (!response.ok) {
          throw new Error(`Payment retry failed: ${response.statusText}`);
        }
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }, []);

  // Open IndexedDB for offline storage
  const openOfflineDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('wata-board-offline', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('actions')) {
          db.createObjectStore('actions', { keyPath: 'id' });
        }
      };
    });
  }, []);

  // Remove offline action from IndexedDB
  const removeOfflineAction = useCallback(async (id: string) => {
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      return new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Connectivity] Failed to remove offline action:', error);
    }
  }, [openOfflineDB]);

  // Queue action for offline processing
  const queueOfflineAction = useCallback((type: OfflineAction['type'], data: any) => {
    const action: OfflineAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    setOfflineActions(prev => [...prev, action]);
    
    // Store in IndexedDB for persistence
    storeOfflineAction(action);

    console.log(`[Connectivity] Queued offline action: ${action.id}`);
  }, []);

  // Store offline action in IndexedDB
  const storeOfflineAction = useCallback(async (action: OfflineAction) => {
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      return new Promise<void>((resolve, reject) => {
        const request = store.add(action);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Connectivity] Failed to store offline action:', error);
    }
  }, [openOfflineDB]);

  // Load offline actions from IndexedDB
  const loadOfflineActions = useCallback(async () => {
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['actions'], 'readonly');
      const store = transaction.objectStore('actions');
      
      return new Promise<void>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
          setOfflineActions(request.result || []);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Connectivity] Failed to load offline actions:', error);
    }
  }, [openOfflineDB]);

  // Clear offline actions
  const clearOfflineActions = useCallback(async () => {
    setOfflineActions([]);
    
    try {
      const db = await openOfflineDB();
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      return new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Connectivity] Failed to clear offline actions:', error);
    }
  }, [openOfflineDB]);

  // Manual connectivity check
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      });
      
      const isOnline = response.ok;
      updateConnectivity(isOnline);
      return isOnline;
    } catch (error) {
      updateConnectivity(false);
      return false;
    }
  }, [updateConnectivity]);

  // Initialize service worker registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        serviceWorkerRef.current = registration;
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'CONNECTIVITY_STATUS') {
            updateConnectivity(event.data.isOnline);
          }
        };

        navigator.serviceWorker.addEventListener('message', handleMessage);
        return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
      });
    }
  }, [updateConnectivity]);

  // Set up event listeners for connectivity changes
  useEffect(() => {
    const handleOnline = () => updateConnectivity(true);
    const handleOffline = () => updateConnectivity(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const connection = (navigator as any).connection;
    if (connection) {
      const handleConnectionChange = () => {
        updateConnectivity(navigator.onLine);
      };
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [updateConnectivity]);

  // Load offline actions on mount
  useEffect(() => {
    loadOfflineActions();
  }, [loadOfflineActions]);

  // Periodic connectivity check when offline
  useEffect(() => {
    if (!connectivity.isOnline) {
      const interval = setInterval(checkConnectivity, 30000);
      return () => clearInterval(interval);
    }
  }, [connectivity.isOnline, checkConnectivity]);

  return {
    connectivity,
    offlineActions,
    isReconnecting,
    queueOfflineAction,
    clearOfflineActions,
    checkConnectivity,
    retryAction,
  };
}

export function useOfflineCapability(feature: 'payment' | 'review' | 'general') {
  const { connectivity } = useConnectivity();
  
  return {
    isAvailable: connectivity.isOnline,
    isOffline: connectivity.isOffline,
    isSlowConnection: connectivity.effectiveType === 'slow-2g' || connectivity.effectiveType === '2g',
    isDataSaver: connectivity.saveData,
    canRetry: connectivity.isOnline && !connectivity.isOffline,
  };
}
