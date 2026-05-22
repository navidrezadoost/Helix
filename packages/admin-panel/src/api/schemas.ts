import type {
  DataSourceConfig,
  FieldConfig,
  GlobalRule,
  Rule,
} from '../types/schema';
import { localSchemaApi } from './localSchemas';

type RuntimeEnv = {
  VITE_API_URL?: string;
  REACT_APP_API_URL?: string;
  VITE_API_CREDENTIALS?: RequestCredentials;
  REACT_APP_API_CREDENTIALS?: RequestCredentials;
  VITE_ENABLE_LOCAL_PREVIEW?: string;
  REACT_APP_USE_LOCAL_PREVIEW?: string;
};

declare const process:
  | {
      env?: RuntimeEnv;
    }
  | undefined;

const envApiBase =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined) ||
  (typeof process !== 'undefined' ? process?.env?.REACT_APP_API_URL : undefined) ||
  'http://localhost:8000/api';

const useLocalPreview =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_ENABLE_LOCAL_PREVIEW : undefined) === 'true' ||
  (typeof process !== 'undefined' ? process?.env?.REACT_APP_USE_LOCAL_PREVIEW : undefined) === 'true';

const envCredentialsMode =
  (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_CREDENTIALS : undefined)
  || (typeof process !== 'undefined' ? process?.env?.REACT_APP_API_CREDENTIALS : undefined);

export {};

const API_BASE = envApiBase.replace(/\/$/, '');

const resolveCredentialsMode = (requestUrl: string): RequestCredentials => {
  if (envCredentialsMode === 'include' || envCredentialsMode === 'omit' || envCredentialsMode === 'same-origin') {
    return envCredentialsMode;
  }

  if (typeof window === 'undefined') {
    return 'omit';
  }

  try {
    const requestOrigin = new URL(requestUrl, window.location.href).origin;
    return requestOrigin === window.location.origin ? 'include' : 'omit';
  } catch {
    return 'omit';
  }
};

export interface Schema {
  id?: string;
  tenant_id?: string;
  schema_id: string;
  name: string;
  description?: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  fields: FieldConfig[];
  rules: Rule[];
  compiled_graph?: {
    fields?: Record<string, FieldConfig>;
    rules?: Rule[];
    constants?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
  data_sources?: Record<string, DataSourceConfig>;
  global_rules?: GlobalRule[];
  dag_hash: string;
  signature?: string;
  created_at?: string;
  updated_at?: string;
  published_at?: string;
}

export interface PaginatedSchemaResponse {
  data: Schema[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body !== undefined && init?.body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    credentials: init?.credentials ?? resolveCredentialsMode(input),
    headers,
    ...init,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function isRecoverableApiError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error.message);
}

async function withPreviewFallback<T>(remote: () => Promise<T>, local: () => T | Promise<T>): Promise<T> {
  if (useLocalPreview) {
    return local();
  }

  try {
    return await remote();
  } catch (error) {
    if (isRecoverableApiError(error)) {
      return local();
    }

    throw error;
  }
}

function normalizeSchema(payload: Partial<Schema>): Schema {
  const compiledFields = payload.compiled_graph?.fields ?? {};
  const compiledRules = payload.compiled_graph?.rules ?? [];

  return {
    id: payload.id,
    tenant_id: payload.tenant_id,
    schema_id: payload.schema_id ?? '',
    name: payload.name ?? 'Untitled Schema',
    description: payload.description,
    version: payload.version ?? 1,
    status: payload.status ?? 'draft',
    fields: payload.fields ?? Object.values(compiledFields),
    rules: payload.rules ?? compiledRules,
    compiled_graph: payload.compiled_graph,
    metadata: payload.metadata ?? {},
    data_sources: payload.data_sources ?? {},
    global_rules: payload.global_rules ?? [],
    dag_hash: payload.dag_hash ?? '',
    signature: payload.signature,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
    published_at: payload.published_at,
  };
}

export const schemaApi = {
  list: async (params?: { tenant_id?: string; status?: string; search?: string }): Promise<PaginatedSchemaResponse> => {
    return withPreviewFallback(async () => {
      const searchParams = new URLSearchParams();
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value) {
          searchParams.set(key, value);
        }
      });

      const query = searchParams.toString();
      const response = await request<PaginatedSchemaResponse>(`${API_BASE}/admin/schemas${query ? `?${query}` : ''}`);

      return {
        ...response,
        data: response.data.map(normalizeSchema),
      };
    }, () => Promise.resolve(localSchemaApi.list(params)));
  },

  get: async (schemaId: string, version?: number): Promise<Schema> => {
    return withPreviewFallback(async () => {
      const suffix = version ? `?version=${version}` : '';
      const response = await request<Schema>(`${API_BASE}/admin/schemas/${schemaId}${suffix}`);
      return normalizeSchema(response);
    }, () => Promise.resolve(localSchemaApi.get(schemaId, version)));
  },

  create: async (data: Record<string, unknown>): Promise<Schema> => {
    return withPreviewFallback(async () => {
      const response = await request<Schema>(`${API_BASE}/admin/schemas`, {
        method: 'POST',
        body: JSON.stringify(data),
      });

      return normalizeSchema(response);
    }, () => Promise.resolve(localSchemaApi.create(data)));
  },

  update: async (id: string, data: Record<string, unknown>): Promise<Schema> => {
    return withPreviewFallback(async () => {
      const response = await request<Schema>(`${API_BASE}/admin/schemas/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });

      return normalizeSchema(response);
    }, () => Promise.resolve(localSchemaApi.update(id, data)));
  },

  publish: async (id: string): Promise<Schema> => {
    return withPreviewFallback(async () => {
      const response = await request<Schema>(`${API_BASE}/admin/schemas/${id}/publish`, {
        method: 'POST',
      });

      return normalizeSchema(response);
    }, () => Promise.resolve(localSchemaApi.publish(id)));
  },

  createVersion: async (schemaId: string): Promise<Schema> => {
    return withPreviewFallback(async () => {
      const response = await request<Schema>(`${API_BASE}/admin/schemas/${schemaId}/version`, {
        method: 'POST',
      });

      return normalizeSchema(response);
    }, () => Promise.resolve(localSchemaApi.createVersion(schemaId)));
  },

  delete: async (id: string): Promise<void> => {
    return withPreviewFallback(async () => request<void>(`${API_BASE}/admin/schemas/${id}`, {
      method: 'DELETE',
    }), async () => {
      localSchemaApi.delete(id);
    });
  },

  testDataSource: async (config: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }): Promise<unknown> => {
    return withPreviewFallback(() => request(`${API_BASE}/admin/test-data-source`, {
      method: 'POST',
      body: JSON.stringify(config),
    }), () => localSchemaApi.testDataSource(config));
  },
};
