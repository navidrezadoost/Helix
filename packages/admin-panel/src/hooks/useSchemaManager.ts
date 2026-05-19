import { useCallback, useEffect, useState } from 'react';
import { schemaApi, type Schema } from '../api/schemas';

export interface UseSchemaManagerOptions {
  schemaId?: string;
  version?: number;
  autoLoad?: boolean;
  defaultTenantId?: string;
}

export interface UseSchemaManagerReturn {
  schema: Schema | null;
  setSchema: (schema: Schema | null) => void;
  loading: boolean;
  error: string | null;
  saving: boolean;
  publishing: boolean;
  initializeDraft: (draft?: Partial<Schema>) => void;
  loadSchema: (id: string, version?: number) => Promise<void>;
  saveSchema: (data?: Partial<Schema>) => Promise<Schema | void>;
  publishSchema: () => Promise<Schema | void>;
  createVersion: () => Promise<Schema | void>;
  deleteSchema: () => Promise<void>;
  testDataSource: (config: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }) => Promise<unknown>;
}

function buildDraftSchema(defaultTenantId?: string, draft?: Partial<Schema>): Schema {
  const now = Date.now();

  return {
    id: draft?.id,
    tenant_id: draft?.tenant_id ?? defaultTenantId,
    schema_id: draft?.schema_id ?? `schema_${now}`,
    name: draft?.name ?? 'Untitled Form',
    description: draft?.description ?? '',
    version: draft?.version ?? 1,
    status: draft?.status ?? 'draft',
    fields: draft?.fields ?? [],
    rules: draft?.rules ?? [],
    metadata: draft?.metadata ?? {},
    data_sources: draft?.data_sources ?? {},
    global_rules: draft?.global_rules ?? [],
    dag_hash: draft?.dag_hash ?? '',
    signature: draft?.signature,
    created_at: draft?.created_at,
    updated_at: draft?.updated_at,
    published_at: draft?.published_at,
    compiled_graph: draft?.compiled_graph,
  };
}

export function useSchemaManager(options: UseSchemaManagerOptions = {}): UseSchemaManagerReturn {
  const {
    schemaId,
    version,
    autoLoad = true,
    defaultTenantId,
  } = options;

  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const initializeDraft = useCallback((draft?: Partial<Schema>) => {
    setError(null);
    setSchema(buildDraftSchema(defaultTenantId, draft));
  }, [defaultTenantId]);

  const loadSchema = useCallback(async (id: string, ver?: number) => {
    setLoading(true);
    setError(null);

    try {
      const data = await schemaApi.get(id, ver);
      setSchema(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveSchema = useCallback(async (data?: Partial<Schema>) => {
    const target = { ...schema, ...data } as Schema | null;
    if (!target) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        schema_id: target.schema_id,
        tenant_id: target.tenant_id,
        name: target.name,
        description: target.description,
        fields: target.fields,
        rules: target.rules,
        metadata: target.metadata,
        data_sources: target.data_sources,
        global_rules: target.global_rules,
      };

      const persisted = target.id
        ? await schemaApi.update(target.id, payload)
        : await schemaApi.create(payload);

      setSchema(persisted);
      return persisted;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [schema]);

  const publishSchema = useCallback(async () => {
    if (!schema?.id) {
      throw new Error('Schema must be saved before publishing.');
    }

    setPublishing(true);
    setError(null);

    try {
      const published = await schemaApi.publish(schema.id);
      setSchema(published);
      return published;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish schema');
      throw err;
    } finally {
      setPublishing(false);
    }
  }, [schema]);

  const createVersion = useCallback(async () => {
    if (!schema?.schema_id) {
      throw new Error('No published schema available to version.');
    }

    setLoading(true);
    setError(null);

    try {
      const draft = await schemaApi.createVersion(schema.schema_id);
      setSchema(draft);
      return draft;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create version');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [schema]);

  const deleteSchema = useCallback(async () => {
    if (!schema) {
      return;
    }

    if (schema.id && !window.confirm(`Delete schema "${schema.name}"? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (schema.id) {
        await schemaApi.delete(schema.id);
      }
      setSchema(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schema');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [schema]);

  const testDataSource = useCallback(async (config: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }) => {
    return schemaApi.testDataSource(config);
  }, []);

  useEffect(() => {
    if (autoLoad && schemaId) {
      void loadSchema(schemaId, version);
    }
  }, [autoLoad, schemaId, version, loadSchema]);

  return {
    schema,
    setSchema,
    loading,
    error,
    saving,
    publishing,
    initializeDraft,
    loadSchema,
    saveSchema,
    publishSchema,
    createVersion,
    deleteSchema,
    testDataSource,
  };
}
