import { ExpressionEngine } from '../expression/ExpressionEngine';
import { AsyncActionRegistry } from './AsyncActionRegistry';
import { AsyncCache } from './AsyncCache';
import type { AsyncAction, AsyncFieldState } from '../types/async';
import type { CompiledGraph } from '../types';

export interface FieldState {
  value: any;
  errors: string[];
  visible: boolean;
  required: boolean;
  disabled: boolean;
  touched: boolean;
  valid: boolean;
  options?: Array<{ value: string; label: string }>; // For select fields
  asyncState?: AsyncFieldState;
}

export type Action = 
  | { type: 'FIELD_CHANGE'; nodeId: string; value: any }
  | { type: 'BATCH_UPDATE'; updates: Record<string, any> }
  | { type: 'SET_VISIBILITY'; nodeId: string; visible: boolean }
  | { type: 'SET_REQUIRED'; nodeId: string; required: boolean }
  | { type: 'SET_ERROR'; nodeId: string; error: string }
  | { type: 'SET_OPTIONS'; nodeId: string; options: Array<{ value: string; label: string }> }
  | { type: 'SET_ASYNC_STATE'; field: string; isLoading: boolean; error?: string | null }
  | { type: 'POPULATE_SELECT_SUCCESS'; field: string; options: Array<{ value: string; label: string }> };

export class ReactiveStore {
  private state: Map<string, FieldState> = new Map();
  private subscribers: Set<(state: Map<string, FieldState>) => void> = new Set();
  private constants: Record<string, any> = {};
  private compiledGraph: CompiledGraph | null = null;
  private dependencyMap: Map<string, Set<string>> = new Map();
  private asyncRegistry: AsyncActionRegistry = new AsyncActionRegistry();
  private asyncCache: AsyncCache = new AsyncCache();
  private pendingDebounces: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pendingRequests: Map<string, AbortController> = new Map();
  private expressionEngine: ExpressionEngine;

  constructor(expressionEngine: ExpressionEngine) {
    this.expressionEngine = expressionEngine;
  }

  public initGraph(graph: CompiledGraph, dependencyMap: Map<string, Set<string>>): void {
    this.compiledGraph = {
      ...graph,
      dagEvaluationOrder: graph.dagEvaluationOrder ?? graph.dag_evaluation_order ?? [],
      constants: graph.constants ?? {},
    };
    this.dependencyMap = dependencyMap;
    this.constants = this.compiledGraph.constants ?? {};
    
    // Initialize field states with defaults
    for (const [fieldName, config] of Object.entries(this.compiledGraph.fields)) {
      this.state.set(fieldName, {
        value: config.default ?? null,
        errors: [],
        visible: true,
        required: config.required ?? false,
        disabled: false,
        touched: false,
        valid: true,
        options: config.options ?? [],
        asyncState: {
          isLoading: false,
          lastError: null,
          lastFetchedAt: null,
          lastOptions: null,
          pendingRequestId: null,
        },
      });
    }
    
    // Register async actions from graph
    this.registerAsyncActions(this.compiledGraph);
  }
  
  private registerAsyncActions(graph: CompiledGraph): void {
    const asyncActions: AsyncAction[] = [];
    
    for (const rule of graph.rules) {
      for (const action of rule.actions) {
        if (action.type === 'populateSelect') {
          if (!action.source || !action.valuePath) {
            continue;
          }

          asyncActions.push({
            targetField: action.field,
            dependsOn: rule.depends_on,
            source: action.source,
            method: action.method || 'GET',
            valuePath: action.valuePath,
            cache: action.cache || 'none',
            debounce: action.debounce || 300,
            headers: action.headers,
            bodyTemplate: action.bodyTemplate,
          });
        }
      }
    }
    
    this.asyncRegistry.registerBatch(asyncActions);
  }

  dispatch(action: Action): void {
    const changedNodes = new Set<string>();

    switch (action.type) {
      case 'FIELD_CHANGE': {
        const fieldState = this.state.get(action.nodeId);
        if (fieldState && fieldState.value !== action.value) {
          fieldState.value = action.value;
          fieldState.touched = true;
          fieldState.valid = this.validateField(action.nodeId, fieldState);
          this.state.set(action.nodeId, fieldState);
          changedNodes.add(action.nodeId);
        }
        break;
      }
      
      case 'BATCH_UPDATE': {
        for (const [nodeId, value] of Object.entries(action.updates)) {
          const s = this.state.get(nodeId);
          if (s && s.value !== value) {
            s.value = value;
            s.touched = true;
            s.valid = this.validateField(nodeId, s);
            this.state.set(nodeId, s);
            changedNodes.add(nodeId);
          }
        }
        break;
      }
      
      case 'SET_VISIBILITY':
      case 'SET_REQUIRED':
      case 'SET_ERROR': {
        this.mutateStateDirectly(action);
        changedNodes.add(action.nodeId);
        break;
      }
      
      case 'SET_OPTIONS': {
        const fieldState = this.state.get(action.nodeId);
        if (fieldState) {
          fieldState.options = action.options;
          this.state.set(action.nodeId, fieldState);
          changedNodes.add(action.nodeId);
        }
        break;
      }
      
      case 'SET_ASYNC_STATE': {
        const fieldState = this.state.get(action.field);
        if (fieldState) {
          if (!fieldState.asyncState) fieldState.asyncState = {} as AsyncFieldState;
          fieldState.asyncState.isLoading = action.isLoading;
          if (action.error !== undefined) fieldState.asyncState.lastError = action.error;
          this.state.set(action.field, fieldState);
          // Don't trigger DAG re-evaluation for loading state changes
          return;
        }
        break;
      }
      
      case 'POPULATE_SELECT_SUCCESS': {
        const fieldState = this.state.get(action.field);
        if (fieldState) {
          fieldState.options = action.options;
          if (fieldState.asyncState) {
            fieldState.asyncState.isLoading = false;
            fieldState.asyncState.lastError = null;
            fieldState.asyncState.lastFetchedAt = Date.now();
            fieldState.asyncState.lastOptions = action.options;
          }
          this.state.set(action.field, fieldState);
          changedNodes.add(action.field);
        }
        break;
      }
    }

    if (changedNodes.size > 0 && this.compiledGraph) {
      // Phase 1: Synchronous DAG evaluation
      this.evaluateRules(changedNodes);
      
      // Phase 2: Schedule async actions for affected fields
      this.scheduleAsyncActions(changedNodes);
      
      this.notify();
    }
  }
  
  private validateField(fieldName: string, state: FieldState): boolean {
    // Basic non-relational validation (can be extended)
    if (state.required && (state.value === null || state.value === undefined || state.value === '')) {
      return false;
    }
    return true;
  }
  
  private mutateStateDirectly(action: any): void {
    const s = this.state.get(action.nodeId);
    if (!s) return;
    
    switch (action.type) {
      case 'SET_VISIBILITY':
        s.visible = action.visible;
        break;
      case 'SET_REQUIRED':
        s.required = action.required;
        break;
      case 'SET_ERROR':
        if (action.error) {
          s.errors.push(action.error);
          s.valid = false;
        }
        break;
    }
    this.state.set(action.nodeId, s);
  }

  private evaluateRules(changedNodes: Set<string>): void {
    if (!this.compiledGraph) return;

    const context = this.buildContext();
    const nodesToEvaluate = this.getAffectedNodes(changedNodes);
    
    // Evaluate only affected nodes in topological order
    for (const targetNode of this.compiledGraph.dagEvaluationOrder ?? []) {
      if (!nodesToEvaluate.has(targetNode)) continue;

      const rules = this.getRulesTargeting(targetNode);
      for (const rule of rules) {
        try {
          const conditionMet = this.expressionEngine.evaluate(rule.condition, context);
          if (conditionMet) {
            for (const action of rule.actions) {
              if (action.type !== 'populateSelect') { // Skip async actions here
                this.applySyncAction(action, targetNode);
              }
            }
          }
        } catch (e) {
          console.warn(`[Helix] Rule eval failed for ${targetNode}`, e);
        }
      }
    }
  }
  
  private getAffectedNodes(changedNodes: Set<string>): Set<string> {
    const affected = new Set<string>();
    const queue = Array.from(changedNodes);
    const visited = new Set<string>();
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node)) continue;
      visited.add(node);
      affected.add(node);
      
      const dependents = this.dependencyMap.get(node);
      if (dependents) {
        for (const dep of dependents) {
          if (!visited.has(dep)) {
            queue.push(dep);
          }
        }
      }
    }
    
    return affected;
  }
  
  private getRulesTargeting(nodeId: string): any[] {
    return this.compiledGraph?.rules.filter(rule => 
      rule.actions.some((a: any) => a.field === nodeId && a.type !== 'populateSelect')
    ) || [];
  }
  
  private applySyncAction(action: any, targetField: string): void {
    const s = this.state.get(targetField);
    if (!s) return;
    
    switch (action.type) {
      case 'show':
        s.visible = true;
        break;
      case 'hide':
        s.visible = false;
        break;
      case 'setRequired':
        s.required = action.required ?? true;
        break;
      case 'setValue':
        s.value = action.value;
        s.valid = this.validateField(targetField, s);
        break;
      case 'setError':
        s.errors.push(action.message);
        s.valid = false;
        break;
    }
    this.state.set(targetField, s);
  }
  
  private scheduleAsyncActions(changedNodes: Set<string>): void {
    const affectedAsyncFields = new Set<string>();
    
    for (const changed of changedNodes) {
      const dependents = this.asyncRegistry.getFieldsThatDependOn(changed);
      for (const field of dependents) {
        affectedAsyncFields.add(field);
      }
    }
    
    for (const targetField of affectedAsyncFields) {
      this.scheduleAsyncAction(targetField);
    }
  }
  
  private scheduleAsyncAction(targetField: string): void {
    // Clear existing debounce timer
    if (this.pendingDebounces.has(targetField)) {
      clearTimeout(this.pendingDebounces.get(targetField)!);
      this.pendingDebounces.delete(targetField);
    }
    
    // Cancel any in-flight request for this field
    if (this.pendingRequests.has(targetField)) {
      this.pendingRequests.get(targetField)!.abort();
      this.pendingRequests.delete(targetField);
    }
    
    const actions = this.asyncRegistry.getActionsForField(targetField);
    if (actions.length === 0) return;
    
    // Use the maximum debounce value
    const debounce = Math.max(...actions.map(a => a.debounce));
    
    const timer = setTimeout(() => {
      this.pendingDebounces.delete(targetField);
      this.executeAsyncActions(targetField, actions);
    }, debounce);
    
    this.pendingDebounces.set(targetField, timer);
  }
  
  private async executeAsyncActions(targetField: string, actions: AsyncAction[]): Promise<void> {
    // Set loading state
    this.dispatch({
      type: 'SET_ASYNC_STATE',
      field: targetField,
      isLoading: true,
      error: null,
    });
    
    const controller = new AbortController();
    const requestId = Symbol();
    this.pendingRequests.set(targetField, controller);
    
    // Update pending request ID in field state
    const fieldState = this.state.get(targetField);
    if (fieldState?.asyncState) {
      fieldState.asyncState.pendingRequestId = requestId;
      this.state.set(targetField, fieldState);
    }
    
    try {
      const context = this.buildContext();
      
      // Execute all actions for this field (usually just one)
      const results = await Promise.all(actions.map(async (action) => {
        // Check if this request was superseded
        const currentState = this.state.get(targetField);
        if (currentState?.asyncState?.pendingRequestId !== requestId) {
          throw new Error('Request superseded');
        }
        
        const url = this.interpolateUrl(action.source, context);
        
        // Check cache
        if (action.cache !== 'none') {
          const cached = this.asyncCache.getSession(url);
          if (cached) return { action, options: this.extractOptions(cached, action.valuePath) };
        }
        
        // Deduplicate concurrent requests
        const cacheKey = `${action.method}:${url}`;
        const pendingPromise = this.asyncCache.getPendingRequest(cacheKey);
        if (pendingPromise) {
          const data = await pendingPromise;
          return { action, options: this.extractOptions(data, action.valuePath) };
        }
        
        // Execute fetch
        const fetchPromise = this.performFetch(action, url, controller.signal);
        this.asyncCache.setPendingRequest(cacheKey, fetchPromise);
        
        const data = await fetchPromise;
        
        // Cache successful response
        if (action.cache === 'session') {
          this.asyncCache.setSession(url, data);
        }
        
        return { action, options: this.extractOptions(data, action.valuePath) };
      }));
      
      // Check again for superseding
      const currentState = this.state.get(targetField);
      if (currentState?.asyncState?.pendingRequestId !== requestId) {
        return; // Superseded by newer request
      }
      
      // Merge options from all actions
      const mergedOptions = results.flatMap(r => r.options);
      
      // Update store with new options
      this.dispatch({
        type: 'POPULATE_SELECT_SUCCESS',
        field: targetField,
        options: mergedOptions,
      });
      
      // Trigger DAG re-evaluation for dependent fields
      this.dispatch({
        type: 'FIELD_CHANGE',
        nodeId: targetField,
        value: this.state.get(targetField)?.value,
      });
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log(`[Helix] Async request for ${targetField} was cancelled`);
        return;
      }
      
      console.error(`[Helix] Async action failed for ${targetField}:`, error);
      
      this.dispatch({
        type: 'SET_ASYNC_STATE',
        field: targetField,
        isLoading: false,
        error: error.message,
      });
    } finally {
      this.pendingRequests.delete(targetField);
      
      // Clear pending request ID
      const finalState = this.state.get(targetField);
      if (finalState?.asyncState) {
        finalState.asyncState.pendingRequestId = null;
        finalState.asyncState.isLoading = false;
        this.state.set(targetField, finalState);
      }
    }
  }
  
  private async performFetch(action: AsyncAction, url: string, signal: AbortSignal): Promise<any> {
    const options: RequestInit = {
      method: action.method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...action.headers,
      },
    };
    
    if (action.method === 'POST' && action.bodyTemplate) {
      const context = this.buildContext();
      options.body = this.interpolateUrl(action.bodyTemplate, context);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  private interpolateUrl(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, fieldName) => {
      const value = context[fieldName];
      if (value === undefined || value === null) return '';
      return encodeURIComponent(String(value));
    });
  }
  
  private extractOptions(data: any, path: string): Array<{ value: string; label: string }> {
    // JSONPath simplified: $.data[*].{value:code, label:name}
    // Supports both array of objects and object with array property
    
    try {
      // Pattern 1: $.arrayKey[*].{value:valueKey, label:labelKey}
      const arrayPattern = /\$\.(\w+)\[\\*\]\.\{value:(\w+),\s*label:(\w+)\}/;
      const match = path.match(arrayPattern);
      
      if (match) {
        const [, arrayKey, valueKey, labelKey] = match;
        const array = data[arrayKey];
        if (Array.isArray(array)) {
          return array.map((item: any) => ({
            value: String(item[valueKey] ?? item),
            label: String(item[labelKey] ?? item),
          }));
        }
      }
      
      // Pattern 2: Direct array from response
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          value: String(item.value ?? item),
          label: String(item.label ?? item),
        }));
      }
      
      // Pattern 3: Object with value/label properties
      if (typeof data === 'object' && data !== null) {
        if (data.value !== undefined && data.label !== undefined) {
          return [{ value: String(data.value), label: String(data.label) }];
        }
      }
      
      console.warn('[Helix] Could not extract options from response using path:', path);
      return [];
    } catch (error) {
      console.error('[Helix] Option extraction failed:', error);
      return [];
    }
  }
  
  private buildContext(): Record<string, any> {
    const context: Record<string, any> = { ...this.constants };
    for (const [key, fieldState] of this.state.entries()) {
      context[key] = fieldState.value;
    }
    return context;
  }

  public setConstant(key: string, value: any): void {
    this.constants[key] = value;
  }

  public getFieldState(nodeId: string): FieldState | undefined {
    return this.state.get(nodeId);
  }

  public getAllState(): Map<string, FieldState> {
    return new Map(this.state);
  }

  public getOptions(field: string): Array<{ value: string; label: string }> {
    return this.state.get(field)?.options || [];
  }

  public getAsyncState(field: string): AsyncFieldState | undefined {
    return this.state.get(field)?.asyncState;
  }

  public subscribe(callback: (state: Map<string, FieldState>) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    for (const sub of this.subscribers) {
      sub(new Map(this.state));
    }
  }

  public finalize(): void {
    // Final validation pass before submission
    for (const [nodeId, fieldState] of this.state.entries()) {
      if (fieldState.visible) {
        fieldState.valid = this.validateField(nodeId, fieldState);
        this.state.set(nodeId, fieldState);
      }
    }
    this.notify();
  }

  public reset(): void {
    this.state.clear();
    this.pendingDebounces.forEach(timer => clearTimeout(timer));
    this.pendingDebounces.clear();
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
    this.asyncCache.clear();
    
    if (this.compiledGraph) {
      for (const [fieldName, config] of Object.entries(this.compiledGraph.fields)) {
        this.state.set(fieldName, {
          value: config.default ?? null,
          errors: [],
          visible: true,
          required: config.required ?? false,
          disabled: false,
          touched: false,
          valid: true,
          options: config.options ?? [],
          asyncState: {
            isLoading: false,
            lastError: null,
            lastFetchedAt: null,
            lastOptions: null,
            pendingRequestId: null,
          },
        });
      }
    }
    this.notify();
  }

  public destroy(): void {
    this.pendingDebounces.forEach(timer => clearTimeout(timer));
    this.pendingDebounces.clear();
    this.pendingRequests.forEach(controller => controller.abort());
    this.pendingRequests.clear();
    this.subscribers.clear();
    this.asyncRegistry.clear();
    this.asyncCache.clear();
  }
}
