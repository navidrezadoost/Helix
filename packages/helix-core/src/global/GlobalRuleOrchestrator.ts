// packages/helix-core/src/global/GlobalRuleOrchestrator.ts

import { ReactiveStore } from '../store/ReactiveStore';
import { ExpressionEngine } from '../expression/ExpressionEngine';
import { RuntimeGraphBuilder } from '../graph/RuntimeGraphBuilder';

export interface GlobalRule {
  id: string;
  dependsOn: Array<{ formId: string; field: string }>;
  condition: string;
  actions: Array<{
    type: 'setError' | 'show' | 'hide' | 'setRequired' | 'setValue';
    targets: Array<{ formId: string; field: string }>;
    message?: string;
    required?: boolean;
    value?: any;
  }>;
  priority?: 'override' | 'merge';
}

export interface FormRegistryEntry {
  id: string;
  store: ReactiveStore;
  element: HTMLElement & { __globalUnsubscribe?: () => void };
}

export class GlobalRuleOrchestrator {
  private forms: Map<string, FormRegistryEntry> = new Map();
  private rules: GlobalRule[] = [];
  private expressionEngine: ExpressionEngine;
  private globalStore: ReactiveStore | null = null;
  private subscribers: Set<() => void> = new Set();

  constructor(expressionEngine: ExpressionEngine) {
    this.expressionEngine = expressionEngine;
  }

  /**
   * Register a helix-form instance with the orchestrator
   */
  registerForm(formId: string, store: ReactiveStore, element: HTMLElement): void {
    if (this.forms.has(formId)) {
      console.warn(`Form "${formId}" already registered. Overwriting.`);
    }
    const formElement = element as HTMLElement & { __globalUnsubscribe?: () => void };
    this.forms.set(formId, { id: formId, store, element: formElement });
    
    // Subscribe to store changes to trigger global rules
    const unsubscribe = store.subscribe(() => {
      this.evaluateGlobalRules();
    });
    
    // Store unsubscribe for cleanup (we'll attach it to the element's disconnect)
    formElement.__globalUnsubscribe = unsubscribe;
    
    // If this is the first form, initialize global store
    if (!this.globalStore) {
      this.initGlobalStore();
    }
    
    this.evaluateGlobalRules();
  }

  /**
   * Unregister a form (call when form is removed from DOM)
   */
  unregisterForm(formId: string): void {
    const entry = this.forms.get(formId);
    if (entry && entry.element.__globalUnsubscribe) {
      entry.element.__globalUnsubscribe();
    }
    this.forms.delete(formId);
    this.evaluateGlobalRules();
  }

  /**
   * Set global validation rules (loaded from a meta-schema)
   */
  setRules(rules: GlobalRule[]): void {
    this.rules = rules;
    this.evaluateGlobalRules();
  }

  /**
   * Evaluate all global rules against current form states
   */
  private evaluateGlobalRules(): void {
    if (!this.globalStore) return;

    const context = this.buildGlobalContext();
    
    for (const rule of this.rules) {
      try {
        const conditionMet = this.expressionEngine.evaluate(rule.condition, context);
        if (conditionMet) {
          this.applyGlobalActions(rule.actions);
        } else {
          // Optional: revert actions if merge mode? For now, only apply on true.
          // In 'merge' mode, you might want to clear errors when condition becomes false.
          if (rule.priority === 'merge') {
            // Clear errors for target fields when condition false
            for (const action of rule.actions) {
              if (action.type === 'setError') {
                for (const target of action.targets) {
                  const targetStore = this.forms.get(target.formId)?.store;
                  if (targetStore) {
                    const fieldState = targetStore.getFieldState(target.field);
                    if (fieldState) {
                      const errors = fieldState.errors.filter(e => e !== action.message);
                      if (errors.length !== fieldState.errors.length) {
                        targetStore.dispatch({
                          type: 'SET_ERROR',
                          nodeId: target.field,
                          error: '', // empty string to clear? Better to have a CLEAR_ERROR action.
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`[GlobalRuleOrchestrator] Rule "${rule.id}" evaluation failed:`, err);
      }
    }
  }

  private applyGlobalActions(actions: GlobalRule['actions']): void {
    for (const action of actions) {
      for (const target of action.targets) {
        const targetEntry = this.forms.get(target.formId);
        if (!targetEntry) {
          console.warn(`Global action target form "${target.formId}" not found`);
          continue;
        }
        const { store } = targetEntry;
        
        switch (action.type) {
          case 'setError':
            if (action.message) {
              store.dispatch({
                type: 'SET_ERROR',
                nodeId: target.field,
                error: action.message,
              });
            }
            break;
          case 'show':
            store.dispatch({
              type: 'SET_VISIBILITY',
              nodeId: target.field,
              visible: true,
            });
            break;
          case 'hide':
            store.dispatch({
              type: 'SET_VISIBILITY',
              nodeId: target.field,
              visible: false,
            });
            break;
          case 'setRequired':
            store.dispatch({
              type: 'SET_REQUIRED',
              nodeId: target.field,
              required: action.required ?? true,
            });
            break;
          case 'setValue':
            store.dispatch({
              type: 'FIELD_CHANGE',
              nodeId: target.field,
              value: action.value,
            });
            break;
        }
      }
    }
  }

  private buildGlobalContext(): Record<string, any> {
    const context: Record<string, any> = {};
    for (const [formId, { store }] of this.forms.entries()) {
      const allState = store.getAllState();
      for (const [fieldId, fieldState] of allState.entries()) {
        context[`${formId}.${fieldId}`] = fieldState.value;
      }
    }
    return context;
  }

  private initGlobalStore(): void {
    // Global store is used only for its subscription mechanism; we don't need to store fields.
    // But we create a dummy store to reuse the rule evaluation pattern if needed.
    this.globalStore = new ReactiveStore(this.expressionEngine);
  }

  /**
   * Clean up all registrations
   */
  destroy(): void {
    for (const [_, entry] of this.forms) {
      if (entry.element.__globalUnsubscribe) {
        entry.element.__globalUnsubscribe();
      }
    }
    this.forms.clear();
    this.subscribers.clear();
    this.globalStore = null;
  }
}
