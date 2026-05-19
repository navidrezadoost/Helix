/**
 * useHelixForm
 * ------------
 * React hook for embedding Helix reactive forms.
 *
 * Design principles:
 *   - Zero UI opinions: returns state, not JSX
 *   - Lazy initialization: schema fetched on mount, DAG built on demand
 *   - Deterministic output: every re-render reflects exact store state
 *   - Submission-ready: exposes envelope + pipeline trigger
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ReactiveStore } from '../store/ReactiveStore';
import { StoreToEnvelopeAdapter } from '../protocol/StoreToEnvelopeAdapter';
import { SubmissionPipeline } from '../protocol/SubmissionPipeline';
import { SafeExpressionEngine, CompiledGraph } from '../runtime/SafeExpressionEngine';
import type { FieldEffectState } from '../store/ReactiveStore';
import type { SubmissionEnvelope } from '../protocol/SubmissionEnvelope';
import type { WorkflowEvent } from '../protocol/WorkflowEvent';

// --- Configuration Types ---

export interface UseHelixFormConfig {
  /** Schema identifier (maps to PHP OPcache file) */
  schemaId: string;
  /** Schema version for cache invalidation */
  version: number;
  /** Laravel API endpoint */
  endpoint: string;
  /** Optional: pre-fetched CompiledGraph (avoids HTTP round-trip) */
  compiledGraph?: CompiledGraph;
  /** Optional: initial field values */
  defaultValues?: Record<string, unknown>;
  /** Optional: platform identifier for envelope metadata */
  platform?: string;
  /** Optional: locale for validation messages */
  locale?: string;
  /** Optional: event callback for workflow integration */
  onWorkflowEvent?: (event: WorkflowEvent) => void;
}

export interface UseHelixFormReturn {
  /** Reactive field states (re-renders on any field change) */
  fields: Record<string, FieldFieldState>;
  /** Form-level validity (all fields valid) */
  isValid: boolean;
  /** Whether the form has been touched by user */
  isDirty: boolean;
  /** Whether a submission is in flight */
  isSubmitting: boolean;
  /** Submit the form (triggers pipeline) */
  submit: () => Promise<void>;
  /** Set a field value programmatically */
  setValue: (fieldName: string, value: unknown) => void;
  /** Get React-compatible props for a field input */
  getFieldProps: (fieldName: string) => FieldInputProps;
  /** Get the last submission envelope (for debugging) */
  lastEnvelope: SubmissionEnvelope | null;
  /** Get the last workflow event */
  lastEvent: WorkflowEvent | null;
  /** Error state (schema fetch, pipeline failure) */
  error: Error | null;
  /** Whether schema is loading */
  isLoading: boolean;
}

export interface FieldFieldState {
  value: unknown;
  visible: boolean;
  disabled: boolean;
  required: boolean;
  readonly: boolean;
  errors: string[];
  isValid: boolean;
  isDirty: boolean;
  isTouched: boolean;
}

export interface FieldInputProps {
  name: string;
  value: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled: boolean;
  required: boolean;
  readOnly: boolean;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

// --- Implementation ---

export function useHelixForm(config: UseHelixFormConfig): UseHelixFormReturn {
  // 1. Mutable refs for engine instances (survive re-renders)
  const storeRef = useRef<ReactiveStore | null>(null);
  const adapterRef = useRef<StoreToEnvelopeAdapter | null>(null);
  const pipelineRef = useRef<SubmissionPipeline | null>(null);
  const compiledRef = useRef<CompiledGraph | null>(config.compiledGraph ?? null);

  // 2. React state for UI-facing surfaces
  const [isLoading, setIsLoading] = useState(!config.compiledGraph);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastEnvelope, setLastEnvelope] = useState<SubmissionEnvelope | null>(null);
  const [lastEvent, setLastEvent] = useState<WorkflowEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [, forceUpdate] = useState({});

  // 3. Schema fetch effect (only if not pre-fetched)
  useEffect(() => {
    if (compiledRef.current) return;

    let cancelled = false;

    async function fetchSchema() {
      try {
        const response = await fetch(
          `${config.endpoint}/api/v1/schemas/${config.schemaId}?version=${config.version}`
        );
        if (!response.ok) throw new Error(`Schema fetch failed: ${response.status}`);
        
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Unknown schema error');

        if (!cancelled) {
          compiledRef.current = result.data as CompiledGraph;
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Schema fetch failed'));
          setIsLoading(false);
        }
      }
    }

    fetchSchema();
    return () => { cancelled = true; };
  }, [config.schemaId, config.version, config.endpoint]);

  // 4. DAG initialization effect (runs once after schema loaded)
  useEffect(() => {
    if (!compiledRef.current || storeRef.current) return;

    const compiled = compiledRef.current;
    const store = new ReactiveStore({
      evaluateFieldRules: (fieldId, bindings) => SafeExpressionEngine.evaluate(fieldId, bindings)
    });
    
    store.setContext(compiled);

    // Seed default values
    if (config.defaultValues) {
      for (const [name, value] of Object.entries(config.defaultValues)) {
        const nodeId = Object.keys(compiled.nodes).find(
          id => compiled.nodes[id].name === name
        );
        if (nodeId) {
          store.setValue(nodeId, value);
        }
      }
    }

    // Build adapter
    const adapter = new StoreToEnvelopeAdapter(store, compiled, {
      schemaId: config.schemaId,
      schemaVersion: config.version,
      schemaHash: compiled.dagHash!,
      platform: config.platform ?? 'react-sdk',
      sdkVersion: '1.0.0',
      locale: config.locale ?? 'en',
    });

    // Build pipeline
    const pipeline = new SubmissionPipeline({
      stages: ['VALIDATE', 'TRANSFORM', 'SIGN', 'DISPATCH', 'EMIT'],
      endpoints: [
        {
          id: 'primary',
          url: `${config.endpoint}/api/v1/submissions`,
          method: 'POST',
          timeout: 30000,
          retries: 2,
          retryDelay: 1000,
        },
      ],
      eventBus: {
        publish: (event) => {
          config.onWorkflowEvent?.(event);
          setLastEvent(event);
        },
      },
      cryptoProvider: {
        sign: async (payload, keyId) => {
          return 'stub-signature';
        },
        hash: async (payload) => {
          const encoder = new TextEncoder();
          const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(payload));
          return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
        },
      },
    });

    storeRef.current = store;
    adapterRef.current = adapter;
    pipelineRef.current = pipeline;

    // Force initial render with default states
    forceUpdate({});
  }, [isLoading, config.defaultValues, config.schemaId, config.version, config.endpoint, config.locale, config.platform, config.onWorkflowEvent]);

  // 5. Subscribe to store changes (bridge ReactiveStore to React)
  useEffect(() => {
    if (!storeRef.current) return;

    const store = storeRef.current;
    const allNodeIds = compiledRef.current ? Object.keys(compiledRef.current.nodes) : [];
    
    // Subscribe to each field
    const unsubscribers = allNodeIds.map(nodeId => {
      return store.subscribe(nodeId, () => {
        forceUpdate({});
      });
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [storeRef.current, compiledRef.current]);

  // 6. Memoized callbacks (stable across re-renders)
  const setValue = useCallback((fieldName: string, value: unknown) => {
    if (!storeRef.current || !compiledRef.current) return;
    
    const nodeId = Object.keys(compiledRef.current.nodes).find(
      id => compiledRef.current!.nodes[id].name === fieldName
    );
    if (!nodeId) {
      console.warn(`Unknown field: ${fieldName}`);
      return;
    }
    
    storeRef.current.setValue(nodeId, value);
  }, []);

  const submit = useCallback(async () => {
    if (!storeRef.current || !adapterRef.current || !pipelineRef.current) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      // Extract envelope
      const envelope = adapterRef.current.extract();
      setLastEnvelope(envelope);

      // Execute pipeline
      const event = await pipelineRef.current.execute(envelope);
      setLastEvent(event);

      if (event.type === 'SUBMISSION_REJECTED') {
        throw new Error('Submission rejected by server');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Submission failed'));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  // 7. Derive fields from store state (computed on every render)
  const fieldsComputed = useMemo(() => {
    if (!storeRef.current || !compiledRef.current) return {};
    
    const storeState = storeRef.current.getAllState();
    const compiled = compiledRef.current;
    const result: Record<string, FieldFieldState> = {};

    for (const [nodeId, state] of storeState.entries()) {
      const node = compiled.nodes[nodeId];
      if (!node) continue;

      result[node.name] = {
        value: state.value,
        visible: state.visible,
        disabled: false, // TODO: compute from store
        required: state.required,
        readonly: false, // TODO: compute from store
        errors: state.errors,
        isValid: state.isValid,
        isDirty: false, // TODO: track dirty state
        isTouched: false, // TODO: track touched state
      };
    }

    return result;
  }, [storeRef.current, forceUpdate]);

  const getFieldProps = useCallback((fieldName: string): FieldInputProps => {
    const field = fieldsComputed[fieldName];
    if (!field) {
      return {
        name: fieldName,
        value: '',
        onChange: () => {},
        onBlur: () => {},
        disabled: true,
        required: false,
        readOnly: true,
        'aria-invalid': false,
        'aria-describedby': undefined,
      };
    }

    return {
      name: fieldName,
      value: String(field.value ?? ''),
      onChange: (value: unknown) => setValue(fieldName, value),
      onBlur: () => {}, // TODO: Touch tracking
      disabled: field.disabled,
      required: field.required,
      readOnly: field.readonly,
      'aria-invalid': !field.isValid,
      'aria-describedby': field.errors.length > 0 ? `${fieldName}-errors` : undefined,
    };
  }, [fieldsComputed, setValue]);

  // 8. Derive form-level state
  const isValid = useMemo(() => {
    return Object.values(fieldsComputed).every(f => f.isValid);
  }, [fieldsComputed]);

  const isDirty = useMemo(() => {
    return Object.values(fieldsComputed).some(f => f.isDirty);
  }, [fieldsComputed]);

  return {
    fields: fieldsComputed,
    isValid,
    isDirty,
    isSubmitting,
    submit,
    setValue,
    getFieldProps,
    lastEnvelope,
    lastEvent,
    error,
    isLoading,
  };
}
