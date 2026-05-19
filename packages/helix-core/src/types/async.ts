export interface AsyncAction {
  targetField: string;
  dependsOn: string[];
  source: string;                    // URL template with {{field}} placeholders
  method: 'GET' | 'POST' | 'PUT';
  valuePath: string;                 // JSONPath expression for extracting options
  cache: 'session' | 'request' | 'none';
  debounce: number;                  // milliseconds
  headers?: Record<string, string>;
  bodyTemplate?: string;             // For POST requests with {{field}} placeholders
}

export interface AsyncFieldState {
  isLoading: boolean;
  lastError: string | null;
  lastFetchedAt: number | null;
  lastOptions: Array<{ value: string; label: string }> | null;
  pendingRequestId: symbol | null;
}

export interface PopulateSelectAction {
  type: 'POPULATE_SELECT';
  field: string;
  source: string;
  valuePath: string;
  cache: 'session' | 'request' | 'none';
}

export interface SetAsyncStateAction {
  type: 'SET_ASYNC_STATE';
  field: string;
  isLoading: boolean;
  error?: string | null;
}

export interface PopulateSelectSuccessAction {
  type: 'POPULATE_SELECT_SUCCESS';
  field: string;
  options: Array<{ value: string; label: string }>;
}

export type AsyncActionUnion = 
  | PopulateSelectAction
  | SetAsyncStateAction
  | PopulateSelectSuccessAction;
