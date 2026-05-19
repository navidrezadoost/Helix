import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID, createHash, createHmac } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORAGE_FILE = resolve(__dirname, 'storage', 'schemas.json');
const PORT = Number(process.env.PREVIEW_API_PORT || 8000);

ensureStorage();

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
  const method = (req.method || 'GET').toUpperCase();

  applyCors(res);
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (method === 'GET' && url.pathname === '/api/v1/health') {
      return sendJson(res, 200, { status: 'ok', service: 'helix-preview-api', storage: 'schemas.json' });
    }

    if (method === 'POST' && url.pathname === '/api/admin/test-data-source') {
      const payload = await readBody(req);
      return sendJson(res, 200, {
        success: true,
        status: 200,
        data: {
          echo: payload,
          message: 'Preview mode: remote data source calls are mocked.',
        },
      });
    }

    if (method === 'GET' && url.pathname === '/api/admin/schemas') {
      const list = filterSchemas(loadSchemas(), {
        tenantId: url.searchParams.get('tenant_id') || '',
        status: url.searchParams.get('status') || '',
        search: url.searchParams.get('search') || '',
      });

      return sendJson(res, 200, {
        data: list,
        current_page: 1,
        last_page: 1,
        per_page: list.length,
        total: list.length,
      });
    }

    if (method === 'POST' && url.pathname === '/api/admin/schemas') {
      const payload = await readBody(req);
      const schemaId = String(payload.schema_id || '').trim();
      const name = String(payload.name || '').trim();
      const tenantId = String(payload.tenant_id || 'default').trim() || 'default';
      const fields = Array.isArray(payload.fields) ? payload.fields : [];
      const rules = Array.isArray(payload.rules) ? payload.rules : [];

      if (!schemaId || !name) {
        return sendJson(res, 422, { error: 'schema_id and name are required.' });
      }

      if (fields.length === 0) {
        return sendJson(res, 422, { error: 'At least one field is required to save a schema.' });
      }

      const schemas = loadSchemas();
      if (schemas.some((schema) => schema.schema_id === schemaId && Number(schema.version) === 1)) {
        return sendJson(res, 409, { error: 'A schema with this schema_id already exists.' });
      }

      const compiled = compileSchema(schemaId, 1, tenantId, fields, rules);
      const now = new Date().toISOString();

      const schema = {
        id: randomUUID(),
        tenant_id: tenantId,
        schema_id: schemaId,
        name,
        description: String(payload.description || ''),
        version: 1,
        status: 'draft',
        fields,
        rules,
        compiled_graph: compiled.compiled_graph,
        metadata: isRecord(payload.metadata) ? payload.metadata : {},
        data_sources: isRecord(payload.data_sources) ? payload.data_sources : {},
        global_rules: Array.isArray(payload.global_rules) ? payload.global_rules : [],
        dag_hash: compiled.dag_hash,
        signature: null,
        created_at: now,
        updated_at: now,
        published_at: null,
      };

      schemas.push(schema);
      saveSchemas(schemas);
      return sendJson(res, 201, schema);
    }

    const publishMatch = url.pathname.match(/^\/api\/admin\/schemas\/([^/]+)\/publish$/);
    if (publishMatch && method === 'POST') {
      const id = decodeURIComponent(publishMatch[1]);
      const schemas = loadSchemas();
      const index = schemas.findIndex((schema) => schema.id === id);
      if (index < 0) {
        return sendJson(res, 404, { error: 'Schema not found.' });
      }

      if (schemas[index].status !== 'draft') {
        return sendJson(res, 409, { error: 'Only draft schemas can be published.' });
      }

      const target = schemas[index];
      for (const schema of schemas) {
        if (schema.schema_id === target.schema_id && schema.status === 'published') {
          schema.status = 'archived';
          schema.updated_at = new Date().toISOString();
        }
      }

      target.status = 'published';
      target.signature = createHmac('sha256', 'helix-preview-signing-key').update(target.dag_hash).digest('base64');
      target.published_at = new Date().toISOString();
      target.updated_at = new Date().toISOString();

      saveSchemas(schemas);
      return sendJson(res, 200, target);
    }

    const versionMatch = url.pathname.match(/^\/api\/admin\/schemas\/([^/]+)\/version$/);
    if (versionMatch && method === 'POST') {
      const schemaId = decodeURIComponent(versionMatch[1]);
      const schemas = loadSchemas();
      const published = schemas
        .filter((schema) => schema.schema_id === schemaId && schema.status === 'published')
        .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];

      if (!published) {
        return sendJson(res, 404, { error: 'Published schema not found.' });
      }

      const newVersion = Number(published.version || 1) + 1;
      const now = new Date().toISOString();
      const draft = {
        ...published,
        id: randomUUID(),
        version: newVersion,
        status: 'draft',
        signature: null,
        published_at: null,
        created_at: now,
        updated_at: now,
      };

      const compiled = compileSchema(draft.schema_id, newVersion, draft.tenant_id || 'default', draft.fields || [], draft.rules || []);
      draft.compiled_graph = compiled.compiled_graph;
      draft.dag_hash = compiled.dag_hash;

      schemas.push(draft);
      saveSchemas(schemas);
      return sendJson(res, 200, draft);
    }

    const schemaMatch = url.pathname.match(/^\/api\/admin\/schemas\/([^/]+)$/);
    if (schemaMatch) {
      const key = decodeURIComponent(schemaMatch[1]);
      const schemas = loadSchemas();

      if (method === 'GET') {
        const versionParam = url.searchParams.get('version');
        const version = versionParam ? Number(versionParam) : null;

        const matches = schemas
          .filter((schema) => schema.schema_id === key)
          .sort((a, b) => Number(b.version || 0) - Number(a.version || 0));

        let selected = null;
        if (version === null) {
          selected = matches[0] || null;
        } else {
          selected = matches.find((schema) => Number(schema.version || 0) === version) || null;
        }

        if (!selected) {
          return sendJson(res, 404, { error: 'Schema not found.' });
        }

        return sendJson(res, 200, selected);
      }

      if (method === 'PUT') {
        const index = schemas.findIndex((schema) => schema.id === key);
        if (index < 0) {
          return sendJson(res, 404, { error: 'Schema not found.' });
        }

        const target = schemas[index];
        if (target.status !== 'draft') {
          return sendJson(res, 409, { error: 'Only draft schemas can be updated.' });
        }

        const payload = await readBody(req);
        const fields = Array.isArray(payload.fields) ? payload.fields : target.fields || [];
        if (fields.length === 0) {
          return sendJson(res, 422, { error: 'At least one field is required to save a schema.' });
        }

        const rules = Array.isArray(payload.rules) ? payload.rules : target.rules || [];
        const tenantId = String(payload.tenant_id || target.tenant_id || 'default').trim() || 'default';
        const compiled = compileSchema(target.schema_id, Number(target.version || 1), tenantId, fields, rules);

        const updated = {
          ...target,
          tenant_id: tenantId,
          name: String(payload.name || target.name || 'Untitled Form').trim() || 'Untitled Form',
          description: String(payload.description ?? target.description ?? ''),
          fields,
          rules,
          compiled_graph: compiled.compiled_graph,
          metadata: isRecord(payload.metadata) ? payload.metadata : target.metadata || {},
          data_sources: isRecord(payload.data_sources) ? payload.data_sources : target.data_sources || {},
          global_rules: Array.isArray(payload.global_rules) ? payload.global_rules : target.global_rules || [],
          dag_hash: compiled.dag_hash,
          updated_at: new Date().toISOString(),
        };

        schemas[index] = updated;
        saveSchemas(schemas);
        return sendJson(res, 200, updated);
      }

      if (method === 'DELETE') {
        const index = schemas.findIndex((schema) => schema.id === key);
        if (index < 0) {
          return sendJson(res, 404, { error: 'Schema not found.' });
        }

        if (schemas[index].status !== 'draft') {
          return sendJson(res, 409, { error: 'Only draft schemas can be deleted.' });
        }

        schemas.splice(index, 1);
        saveSchemas(schemas);
        return sendJson(res, 200, { message: 'Schema deleted' });
      }
    }

    sendJson(res, 404, { error: 'Route not found.', method, path: url.pathname });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    sendJson(res, 500, { error: message });
  }
});

server.listen(PORT, () => {
  console.log(`[helix-preview-api] listening on http://localhost:${PORT}`);
});

function applyCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw.trim()) {
    return {};
  }

  const parsed = JSON.parse(raw);
  return isRecord(parsed) ? parsed : {};
}

function ensureStorage() {
  const storageDir = dirname(STORAGE_FILE);
  if (!existsSync(storageDir)) {
    mkdirSync(storageDir, { recursive: true });
  }

  if (!existsSync(STORAGE_FILE)) {
    writeFileSync(STORAGE_FILE, '[]\n', 'utf-8');
  }
}

function loadSchemas() {
  const content = readFileSync(STORAGE_FILE, 'utf-8');
  const parsed = JSON.parse(content || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

function saveSchemas(schemas) {
  writeFileSync(STORAGE_FILE, `${JSON.stringify(schemas, null, 2)}\n`, 'utf-8');
}

function filterSchemas(schemas, filters) {
  const tenantId = String(filters.tenantId || '').trim();
  const status = String(filters.status || '').trim();
  const search = String(filters.search || '').trim().toLowerCase();

  return schemas
    .filter((schema) => {
      if (tenantId && String(schema.tenant_id || '') !== tenantId) {
        return false;
      }

      if (status && String(schema.status || '') !== status) {
        return false;
      }

      if (search) {
        const haystack = `${String(schema.name || '')} ${String(schema.schema_id || '')}`.toLowerCase();
        return haystack.includes(search);
      }

      return true;
    })
    .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
}

function compileSchema(schemaId, version, tenantId, fields, rules) {
  const normalizedFields = {};

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!isRecord(field)) {
      continue;
    }

    const id = String(field.id || `field_${index + 1}`).trim() || `field_${index + 1}`;
    normalizedFields[id] = {
      id,
      type: String(field.type || 'text'),
      label: String(field.label || id),
      required: Boolean(field.required),
      placeholder: String(field.placeholder || ''),
      default: field.defaultValue ?? field.default ?? null,
      options: Array.isArray(field.options) ? field.options : [],
      dataSource: field.dataSource ?? null,
    };
  }

  const normalizedRules = rules
    .filter((rule) => isRecord(rule))
    .map((rule, index) => ({
      id: String(rule.id || `rule_${index + 1}`),
      dependsOn: Array.isArray(rule.dependsOn) ? rule.dependsOn : [],
      condition: String(rule.condition || 'true'),
      actions: Array.isArray(rule.actions) ? rule.actions : [],
      priority: String(rule.priority || 'override'),
    }));

  const dagEvaluationOrder = Object.keys(normalizedFields);

  const compiledGraph = {
    fields: normalizedFields,
    rules: normalizedRules,
    constants: {
      tenant_id: tenantId,
    },
    dag_evaluation_order: dagEvaluationOrder,
  };

  const dagHash = createHash('sha256')
    .update(JSON.stringify({ schema_id: schemaId, version, compiled_graph: compiledGraph }))
    .digest('hex');

  return {
    compiled_graph: compiledGraph,
    dag_hash: dagHash,
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
