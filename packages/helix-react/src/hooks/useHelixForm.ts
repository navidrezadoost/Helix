import { useEffect, useState, useCallback, useRef } from 'react';
import { ReactiveStore, RuntimeGraphBuilder, StoreToEnvelopeAdapter, ExpressionEngine } from '@helix/core';
import { useShopifyAuth } from '../adapters/ShopifyAuthAdapter';
import { usePrefetch } from './usePrefetch';

export interface UseHelixFormOptions {
  schemaId: string;
  version?: number;
  endpoint: string;
  shopifyAuth?: boolean;
  initialValues?: Record<string, any>;
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
  enablePrefetch?: boolean;
  prefetchConfig?: Array<{
    targetField: string;
    dependsOn: string | string[];
    delay?: number;
    requireValue?: boolean;
  }>;
}

export function useHelixForm(options: UseHelixFormOptions) {
  const { 
    schemaId, 
    version = 1, 
    endpoint, 
    shopifyAuth = false, 
    initialValues = {}, 
    onSuccess, 
    onError,
    enablePrefetch = true,
    prefetchConfig: customPrefetchConfig,
  } = options;
  
  const [fields, setFields] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValid, setIsValid] = useState(true);
  
  const storeRef = useRef<ReactiveStore | null>(null);
  const adapterRef = useRef<StoreToEnvelopeAdapter | null>(null);
  const authAdapter = useShopifyAuth();
  
  const autoPrefetchConfig = useRef<Array<{ targetField: string; dependsOn: string | string[] }>>([]);
  
  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;
    
    async function init() {
      try {
        const response = await fetch(`${endpoint}/api/v1/schemas/${schemaId}?version=${version}`);
        if (!response.ok) throw new Error(`Schema fetch failed: ${response.status}`);
        const { data: compiledGraph } = await response.json();
        
        if (autoPrefetchConfig.current.length === 0 && compiledGraph.rules) {
          for (const rule of compiledGraph.rules) {
            for (const action of rule.actions) {
              if (action.type === 'populateSelect') {
                autoPrefetchConfig.current.push({
                  targetField: action.field,
                  dependsOn: rule.depends_on,
                });
              }
            }
          }
        }
        
        const engine = new ExpressionEngine();
        const store = new ReactiveStore(engine);
        const dependencyMap = RuntimeGraphBuilder.buildDependencyMap(compiledGraph);
        store.initGraph(compiledGraph, dependencyMap);
        RuntimeGraphBuilder.registerFields(store, compiledGraph, initialValues);
        
        unsubscribe = store.subscribe((state: Map<string, any>) => {
          const fieldsMap: Record<string, any> = {};
          let allValid = true;
          for (const [key, fieldState] of state.entries()) {
            fieldsMap[key] = fieldState;
            if (fieldState.visible && fieldState.required && (!fieldState.valid || fieldState.errors.length > 0)) {
              allValid = false;
            }
          }
          if (mounted) {
            setFields(fieldsMap);
            setIsValid(allValid);
          }
        });
        
        const adapter = new StoreToEnvelopeAdapter(store, compiledGraph, {
          schemaId,
          schemaVersion: version,
          schemaHash: compiledGraph.dagHash,
          platform: 'shopify-admin',
          sdkVersion: '@helix/react@1.0.0',
          locale: navigator?.language || 'en-US',
        });
        
        storeRef.current = store;
        adapterRef.current = adapter;
        
      } catch (err) {
        if (mounted && onError) onError(err as Error);
      }
    }
    
    init();
    
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [schemaId, version, endpoint, initialValues]);
  
  const prefetchConfig = customPrefetchConfig || autoPrefetchConfig.current.map((cfg: { targetField: string; dependsOn: string | string[] }) => ({
    ...cfg,
    delay: 150,
    requireValue: true,
  }));
  
  usePrefetch({
    prefetchMap: enablePrefetch ? prefetchConfig : [],
    enabled: enablePrefetch,
  });
  
  const change = useCallback((nodeId: string, value: any) => {
    storeRef.current?.dispatch({ type: 'FIELD_CHANGE', nodeId, value });
  }, []);
  
  const submit = useCallback(async () => {
    if (!storeRef.current || !adapterRef.current) return;
    
    setIsSubmitting(true);
    try {
      const envelope = await adapterRef.current.extract();
      
      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope),
      };
      
      let response: Response;
      if (shopifyAuth && authAdapter) {
        response = await authAdapter.fetchWithAuth(`${endpoint}/api/helix/submit`, fetchOptions);
      } else {
        response = await fetch(`${endpoint}/api/helix/submit`, fetchOptions);
      }
      
      if (!response.ok) throw new Error(`Submission failed: ${response.status}`);
      const result = await response.json();
      
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      if (onError) onError(err as Error);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [endpoint, shopifyAuth, authAdapter, onSuccess, onError]);
  
  const retryAsyncField = useCallback((fieldId: string) => {
    const fieldState = storeRef.current?.getFieldState(fieldId);
    if (fieldState?.value !== undefined && fieldState.value !== null) {
      change(fieldId, fieldState.value);
    }
  }, [change]);
  
  return { 
    fields, 
    change, 
    submit, 
    isSubmitting, 
    isValid,
    retryAsyncField,
    store: storeRef.current,
  };
}
