export interface OptionItem {
  value: string;
  label: string;
}

export interface FieldConfig {
  type: string;
  label?: string;
  required?: boolean;
  default?: unknown;
  options?: OptionItem[];
}

export interface RuleAction {
  type: 'populateSelect' | 'show' | 'hide' | 'setRequired' | 'setValue' | 'setError';
  field: string;
  source?: string;
  method?: 'GET' | 'POST' | 'PUT';
  valuePath?: string;
  cache?: 'session' | 'request' | 'none';
  debounce?: number;
  headers?: Record<string, string>;
  bodyTemplate?: string;
  required?: boolean;
  value?: unknown;
  message?: string;
}

export interface CompiledRule {
  depends_on: string[];
  condition: string;
  actions: RuleAction[];
}

export interface CompiledGraph {
  schema_id: string;
  version: number;
  dag_hash: string;
  dagEvaluationOrder?: string[];
  fields: Record<string, FieldConfig>;
  rules: CompiledRule[];
  constants?: Record<string, unknown>;
  dag_evaluation_order?: string[];
}

export type { AsyncAction, AsyncActionUnion, AsyncFieldState } from './async';