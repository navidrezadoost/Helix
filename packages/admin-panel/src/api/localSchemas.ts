import type { DataSourceConfig, FieldConfig, GlobalRule, Rule } from '../types/schema';
import type { PaginatedSchemaResponse, Schema } from './schemas';

const STORAGE_KEY = 'helix.admin.schemas';

const seedSchema: Schema = {
  id: 'local-contact-form-v1',
  tenant_id: 'default',
  schema_id: 'contact_form',
  name: 'Contact Form',
  description: 'Local preview schema for the Helix admin panel.',
  version: 1,
  status: 'published',
  fields: [
    { id: 'full_name', type: 'text', label: 'Full Name', required: true, placeholder: 'Jane Doe' },
    { id: 'email', type: 'text', label: 'Email Address', required: true, placeholder: 'jane@example.com' },
    { id: 'message', type: 'textarea', label: 'Message', required: true, placeholder: 'How can we help?' },
  ],
  rules: [],
  compiled_graph: {
    fields: {
      full_name: { id: 'full_name', type: 'text', label: 'Full Name', required: true, placeholder: 'Jane Doe' },
      email: { id: 'email', type: 'text', label: 'Email Address', required: true, placeholder: 'jane@example.com' },
      message: { id: 'message', type: 'textarea', label: 'Message', required: true, placeholder: 'How can we help?' },
    },
    rules: [],
    constants: {
      tenant_id: 'default',
    },
  },
  metadata: {},
  data_sources: {},
  global_rules: [],
  dag_hash: 'local-preview-hash',
  signature: 'local-preview-signature',
  created_at: '2026-05-16T00:00:00.000Z',
  updated_at: '2026-05-16T00:00:00.000Z',
  published_at: '2026-05-16T00:00:00.000Z',
};

function hasStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function compileGraph(fields: FieldConfig[], rules: Rule[], tenantId?: string) {
  const compiledFields = fields.reduce<Record<string, FieldConfig>>((accumulator, field) => {
    accumulator[field.id] = field;
    return accumulator;
  }, {});

  return {
    fields: compiledFields,
    rules,
    constants: {
      tenant_id: tenantId ?? 'default',
    },
  };
}

function hashSchema(schema: Pick<Schema, 'schema_id' | 'version' | 'fields' | 'rules' | 'tenant_id'>): string {
  const raw = JSON.stringify({
    schema_id: schema.schema_id,
    version: schema.version,
    tenant_id: schema.tenant_id ?? 'default',
    fields: schema.fields,
    rules: schema.rules,
  });

  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(index);
    hash |= 0;
  }

  return `local-${Math.abs(hash)}`;
}

function loadAll(): Schema[] {
  if (!hasStorage()) {
    return [seedSchema];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persistAll([seedSchema]);
    return [seedSchema];
  }

  try {
    const parsed = JSON.parse(raw) as Schema[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      persistAll([seedSchema]);
      return [seedSchema];
    }

    return parsed;
  } catch {
    persistAll([seedSchema]);
    return [seedSchema];
  }
}

function persistAll(schemas: Schema[]): void {
  if (!hasStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
}

function sortSchemas(schemas: Schema[]): Schema[] {
  return [...schemas].sort((left, right) => {
    const leftTime = new Date(left.updated_at ?? 0).getTime();
    const rightTime = new Date(right.updated_at ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function generateId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPersistedSchema(input: Partial<Schema> & Pick<Schema, 'schema_id' | 'name' | 'fields' | 'rules'>, existing?: Schema): Schema {
  const now = new Date().toISOString();
  const version = existing?.version ?? input.version ?? 1;
  const tenantId = input.tenant_id ?? existing?.tenant_id ?? 'default';
  const fields = input.fields ?? existing?.fields ?? [];
  const rules = input.rules ?? existing?.rules ?? [];
  const compiledGraph = compileGraph(fields, rules, tenantId);

  return {
    id: existing?.id ?? input.id ?? generateId(),
    tenant_id: tenantId,
    schema_id: input.schema_id,
    name: input.name,
    description: input.description ?? existing?.description ?? '',
    version,
    status: input.status ?? existing?.status ?? 'draft',
    fields,
    rules,
    compiled_graph: compiledGraph,
    metadata: input.metadata ?? existing?.metadata ?? {},
    data_sources: (input.data_sources ?? existing?.data_sources ?? {}) as Record<string, DataSourceConfig>,
    global_rules: (input.global_rules ?? existing?.global_rules ?? []) as GlobalRule[],
    dag_hash: hashSchema({ schema_id: input.schema_id, version, tenant_id: tenantId, fields, rules }),
    signature: input.signature ?? existing?.signature,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    published_at: input.published_at ?? existing?.published_at,
  };
}

export const localSchemaApi = {
  list(params?: { tenant_id?: string; status?: string; search?: string }): PaginatedSchemaResponse {
    const search = params?.search?.trim().toLowerCase() ?? '';
    const data = sortSchemas(loadAll()).filter((schema) => {
      if (params?.tenant_id && schema.tenant_id !== params.tenant_id) {
        return false;
      }

      if (params?.status && schema.status !== params.status) {
        return false;
      }

      if (search) {
        const haystack = `${schema.name} ${schema.schema_id}`.toLowerCase();
        return haystack.includes(search);
      }

      return true;
    });

    return {
      data,
      current_page: 1,
      last_page: 1,
      per_page: data.length,
      total: data.length,
    };
  },

  get(schemaId: string, version?: number): Schema {
    const schemas = loadAll().filter((schema) => schema.schema_id === schemaId);
    const target = version
      ? schemas.find((schema) => schema.version === version)
      : sortSchemas(schemas)[0];

    if (!target) {
      throw new Error('Schema not found');
    }

    return target;
  },

  create(data: Record<string, unknown>): Schema {
    const schema = buildPersistedSchema({
      schema_id: String(data.schema_id ?? ''),
      tenant_id: String(data.tenant_id ?? 'default'),
      name: String(data.name ?? 'Untitled Form'),
      description: String(data.description ?? ''),
      fields: (data.fields as FieldConfig[] | undefined) ?? [],
      rules: (data.rules as Rule[] | undefined) ?? [],
      metadata: (data.metadata as Record<string, unknown> | undefined) ?? {},
      data_sources: (data.data_sources as Record<string, DataSourceConfig> | undefined) ?? {},
      global_rules: (data.global_rules as GlobalRule[] | undefined) ?? [],
      status: 'draft',
    });

    const schemas = loadAll();
    schemas.push(schema);
    persistAll(schemas);
    return schema;
  },

  update(id: string, data: Record<string, unknown>): Schema {
    const schemas = loadAll();
    const index = schemas.findIndex((schema) => schema.id === id);
    if (index < 0) {
      throw new Error('Schema not found');
    }

    const updated = buildPersistedSchema({
      ...schemas[index],
      schema_id: String(data.schema_id ?? schemas[index].schema_id),
      tenant_id: String(data.tenant_id ?? schemas[index].tenant_id ?? 'default'),
      name: String(data.name ?? schemas[index].name),
      description: String(data.description ?? schemas[index].description ?? ''),
      fields: (data.fields as FieldConfig[] | undefined) ?? schemas[index].fields,
      rules: (data.rules as Rule[] | undefined) ?? schemas[index].rules,
      metadata: (data.metadata as Record<string, unknown> | undefined) ?? schemas[index].metadata,
      data_sources: (data.data_sources as Record<string, DataSourceConfig> | undefined) ?? schemas[index].data_sources,
      global_rules: (data.global_rules as GlobalRule[] | undefined) ?? schemas[index].global_rules,
    }, schemas[index]);

    schemas[index] = updated;
    persistAll(schemas);
    return updated;
  },

  publish(id: string): Schema {
    const schemas = loadAll();
    const index = schemas.findIndex((schema) => schema.id === id);
    if (index < 0) {
      throw new Error('Schema not found');
    }

    const now = new Date().toISOString();
    schemas.forEach((schema, schemaIndex) => {
      if (schema.schema_id === schemas[index].schema_id && schema.status === 'published') {
        schemas[schemaIndex] = {
          ...schema,
          status: 'archived',
          updated_at: now,
        };
      }
    });

    schemas[index] = {
      ...schemas[index],
      status: 'published',
      signature: `local-signature-${schemas[index].dag_hash}`,
      published_at: now,
      updated_at: now,
    };

    persistAll(schemas);
    return schemas[index];
  },

  createVersion(schemaId: string): Schema {
    const schemas = loadAll().filter((schema) => schema.schema_id === schemaId);
    const latest = sortSchemas(schemas)[0];
    if (!latest) {
      throw new Error('Schema not found');
    }

    const draft = buildPersistedSchema({
      ...latest,
      id: generateId(),
      version: latest.version + 1,
      status: 'draft',
      signature: undefined,
      published_at: undefined,
    });

    const allSchemas = loadAll();
    allSchemas.push(draft);
    persistAll(allSchemas);
    return draft;
  },

  delete(id: string): void {
    const filtered = loadAll().filter((schema) => schema.id !== id);
    persistAll(filtered);
  },

  async testDataSource(config: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }): Promise<unknown> {
    const response = await fetch(config.url, {
      method: config.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers ?? {}),
      },
      body: config.method === 'POST' ? JSON.stringify(config.body ?? {}) : undefined,
    });

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }

    return response.text();
  },
};
