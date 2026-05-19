// packages/admin-panel/src/types/schema.ts

export type ResponsiveDevice = 'desktop' | 'tablet' | 'mobile';

export interface FieldHtmlAttributes {
  autoComplete?: string;
  autoFocus?: boolean;
  accept?: string;
  capture?: 'user' | 'environment';
  cols?: number;
  dir?: 'ltr' | 'rtl' | 'auto';
  disabled?: boolean;
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send';
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  list?: string;
  max?: number | string;
  maxLength?: number;
  min?: number | string;
  minLength?: number;
  multiple?: boolean;
  pattern?: string;
  readOnly?: boolean;
  resize?: 'none' | 'both' | 'horizontal' | 'vertical';
  rows?: number;
  size?: number;
  spellCheck?: boolean;
  step?: number | 'any';
  wrap?: 'soft' | 'hard' | 'off';
}

export type ChoiceConditionScope = 'same-form' | 'other-form' | 'http-event';
export type ChoiceConditionType = 'validation' | 'warning' | 'success' | 'calculation';

export interface ChoiceCondition {
  id: string;
  label?: string;
  scope: ChoiceConditionScope;
  type: ChoiceConditionType;
  condition: string;
  message?: string;
  otherFormId?: string;
  otherFieldId?: string;
  httpConfig?: {
    eventName?: string;
    url?: string;
    method?: 'GET' | 'POST' | 'PUT';
    valuePath?: string;
    successCondition?: string;
  };
  calculation?: {
    expression: string;
    outputType?: 'string' | 'number';
  };
}

export interface FieldOption {
  value: string;
  label: string;
  conditions?: ChoiceCondition[];
}

export interface FieldConfig {
  id: string;
  name?: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'radio' | 'date' | 'textarea' | 'file';
  selectionMode?: 'single' | 'multiple';
  label: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  dateConfig?: {
    format?: string;
    locale?: string;
    useCustomCalendar?: boolean;
  };
  htmlAttributes?: FieldHtmlAttributes;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    errorMessage?: string;
  };
  options?: FieldOption[];
  choiceConditions?: ChoiceCondition[];
  dataSource?: DataSourceConfig;  // For async selects
  ui?: {
    width?: number;
    height?: number;
    gridSpan?: number;
    hidden?: boolean;
    locked?: boolean;
    responsive?: Partial<Record<ResponsiveDevice, {
      width?: number;
      gridSpan?: number;
    }>>;
  };
}

export interface DataSourceConfig {
  url: string;
  method: 'GET' | 'POST';
  valuePath: string;        // JSONPath: "$.data[*].{value:code, label:name}"
  cache?: 'session' | 'request' | 'none';
  debounce?: number;
  headers?: Record<string, string>;
  dependsOn?: string[];     // Fields that trigger this data source
}

export interface RuleAction {
  type: 'show' | 'hide' | 'setRequired' | 'setValue' | 'setError' | 'populateSelect';
  field: string;
  required?: boolean;
  value?: any;
  message?: string;
  source?: DataSourceConfig;  // For populateSelect
}

export interface Rule {
  id: string;
  dependsOn: string[];
  condition: string;
  actions: RuleAction[];
  priority?: 'override' | 'merge';
}

export interface FormConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'dependency' | 'validation' | 'calculation';
  operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains' | 'add' | 'subtract' | 'multiply' | 'divide';
  validationType: 'error' | 'success' | 'warning';
}

export interface GlobalRuleTarget {
  formId: string;
  field: string;
}

export interface GlobalRuleAction {
  type: 'setError' | 'show' | 'hide' | 'setRequired' | 'setValue';
  targets: GlobalRuleTarget[];
  message?: string;
  required?: boolean;
  value?: any;
}

export interface GlobalRule {
  id: string;
  dependsOn: Array<{ formId: string; field: string }>;
  condition: string;
  actions: GlobalRuleAction[];
  priority?: 'override' | 'merge';
}

export interface FormSchema {
  id: string;
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  fields: FieldConfig[];
  rules: Rule[];
  globalRules?: GlobalRule[];
  dataSources?: Record<string, DataSourceConfig>;  // Named data sources
  metadata?: {
    httpEndpoint?: string;      // Where to POST submissions
    httpMethod?: 'GET' | 'POST' | 'PUT';
    httpHeaders?: Record<string, string>;
    webhookUrl?: string;        // n8n webhook
    connections?: FormConnection[];
    layout?: {
      mode?: 'flex' | 'grid';
      columns?: number;
      gap?: number;
      canvasWidth?: number;
      responsive?: Partial<Record<ResponsiveDevice, {
        mode?: 'flex' | 'grid';
        columns?: number;
        gap?: number;
        canvasWidth?: number;
      }>>;
    };
  };
  createdAt?: string;
  updatedAt?: string;
}
