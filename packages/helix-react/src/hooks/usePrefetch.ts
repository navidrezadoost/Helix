import { useEffect, useRef, useCallback } from 'react';
import { useHelixContext } from '../context/HelixProvider';

export interface PrefetchConfig {
  targetField: string;
  dependsOn: string | string[];
  delay?: number;
  requireValue?: boolean;
}

export interface UsePrefetchOptions {
  prefetchMap: PrefetchConfig[];
  enabled?: boolean;
}

export function usePrefetch(options: UsePrefetchOptions): void {
  const { prefetchMap, enabled = true } = options;
  const { store } = useHelixContext();
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  
  const triggerPrefetch = useCallback((targetField: string) => {
    if (!store || !enabled) return;
    
    const fieldState = store.getFieldState(targetField);
    if (fieldState?.asyncState?.isLoading) return;
    if (fieldState?.asyncState?.lastError) return;
    if (fieldState?.asyncState?.lastOptions?.length) return;
    
    const currentValue = fieldState?.value;
    if (currentValue !== undefined && currentValue !== null) {
      store.dispatch({
        type: 'FIELD_CHANGE',
        nodeId: targetField,
        value: currentValue,
      });
    }
  }, [store, enabled]);
  
  useEffect(() => {
    if (!store || !enabled) return;
    
    const handleFocus = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const fieldId = target.getAttribute('data-field-id');
      if (!fieldId) return;
      
      for (const config of prefetchMap) {
        const dependsOnArray = Array.isArray(config.dependsOn) ? config.dependsOn : [config.dependsOn];
        if (dependsOnArray.includes(fieldId)) {
          if (config.requireValue) {
            const depState = store.getFieldState(fieldId);
            if (!depState?.value) continue;
          }
          
          const existingTimeout = timeoutRefs.current.get(config.targetField);
          if (existingTimeout) clearTimeout(existingTimeout);
          
          const timeout = setTimeout(() => {
            triggerPrefetch(config.targetField);
            timeoutRefs.current.delete(config.targetField);
          }, config.delay ?? 200);
          
          timeoutRefs.current.set(config.targetField, timeout);
        }
      }
    };
    
    const selectors = prefetchMap.flatMap(config => 
      Array.isArray(config.dependsOn) ? config.dependsOn : [config.dependsOn]
    );
    
    for (const depField of selectors) {
      const element = document.querySelector(`[data-field-id="${depField}"]`);
      if (element) {
        element.addEventListener('focus', handleFocus);
      }
    }
    
    const observer = new MutationObserver(() => {
      for (const depField of selectors) {
        const element = document.querySelector(`[data-field-id="${depField}"]`);
        if (element && !element.hasAttribute('data-prefetch-listener')) {
          element.addEventListener('focus', handleFocus);
          element.setAttribute('data-prefetch-listener', 'true');
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      for (const timeout of timeoutRefs.current.values()) {
        clearTimeout(timeout);
      }
      timeoutRefs.current.clear();
      observer.disconnect();
    };
  }, [store, enabled, prefetchMap, triggerPrefetch]);
}
