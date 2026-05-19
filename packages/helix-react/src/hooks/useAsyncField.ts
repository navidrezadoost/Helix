import { useEffect, useCallback, useRef } from 'react';
import React from 'react';
import { useHelixContext } from '../context/HelixProvider';
import type { AsyncFieldState } from '@helix/core';

export interface UseAsyncFieldOptions {
  fieldId: string;
  autoRetryMs?: number;
  onLoadStart?: (fieldId: string) => void;
  onLoadSuccess?: (fieldId: string, options: Array<{ value: string; label: string }>) => void;
  onLoadError?: (fieldId: string, error: string) => void;
}

export interface UseAsyncFieldReturn {
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  retry: () => void;
  hasCache: boolean;
  showRetry: boolean;
}

export function useAsyncField(options: UseAsyncFieldOptions): UseAsyncFieldReturn {
  const { fieldId, autoRetryMs = 30000, onLoadStart, onLoadSuccess, onLoadError } = options;
  const { store } = useHelixContext();
  
  const [asyncState, setAsyncState] = React.useState<AsyncFieldState | undefined>(() => 
    store?.getAsyncState(fieldId)
  );
  
  const autoRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    if (!store) return;
    
    isMountedRef.current = true;
    
    const updateAsyncState = () => {
      if (!isMountedRef.current) return;
      const newState = store.getAsyncState(fieldId);
      setAsyncState(newState);
      
      if (newState) {
        if (newState.isLoading && onLoadStart) onLoadStart(fieldId);
        if (!newState.isLoading && newState.lastError === null && newState.lastOptions && onLoadSuccess) {
          onLoadSuccess(fieldId, newState.lastOptions);
        }
        if (newState.lastError && onLoadError) onLoadError(fieldId, newState.lastError);
      }
    };
    
    updateAsyncState();
    
    const unsubscribe = store.subscribe(() => {
      updateAsyncState();
    });
    
    return () => {
      isMountedRef.current = false;
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
      unsubscribe();
    };
  }, [store, fieldId, onLoadStart, onLoadSuccess, onLoadError]);
  
  useEffect(() => {
    if (autoRetryMs > 0 && asyncState?.lastError && !asyncState.isLoading) {
      if (autoRetryTimeoutRef.current) clearTimeout(autoRetryTimeoutRef.current);
      
      autoRetryTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current && store) {
          const fieldState = store.getFieldState(fieldId);
          if (fieldState?.value !== undefined && fieldState.value !== null) {
            store.dispatch({
              type: 'FIELD_CHANGE',
              nodeId: fieldId,
              value: fieldState.value,
            });
          }
        }
      }, autoRetryMs);
    }
    
    return () => {
      if (autoRetryTimeoutRef.current) {
        clearTimeout(autoRetryTimeoutRef.current);
      }
    };
  }, [asyncState?.lastError, asyncState?.isLoading, autoRetryMs, fieldId, store]);
  
  const retry = useCallback(() => {
    if (!store) return;
    
    const fieldState = store.getFieldState(fieldId);
    if (fieldState?.value !== undefined && fieldState.value !== null) {
      store.dispatch({
        type: 'FIELD_CHANGE',
        nodeId: fieldId,
        value: fieldState.value,
      });
    }
  }, [store, fieldId]);
  
  const isLoading = asyncState?.isLoading ?? false;
  const error = asyncState?.lastError ?? null;
  const lastFetchedAt = asyncState?.lastFetchedAt ?? null;
  const hasCache = !!(asyncState?.lastOptions?.length);
  const showRetry = !isLoading && error !== null;
  
  return {
    isLoading,
    error,
    lastFetchedAt,
    retry,
    hasCache,
    showRetry,
  };
}
