// packages/admin-panel/src/components/FormBuilder/DataSourceEditor.tsx

import { useState, type FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  Database,
  Globe2,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { DataSourceConfig, FieldConfig } from '../../types/schema';

interface DataSourceEditorProps {
  dataSources: Record<string, DataSourceConfig>;
  fields: FieldConfig[];
  onChange: (dataSources: Record<string, DataSourceConfig>) => void;
  onTest?: (config: {
    url: string;
    method?: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  }) => Promise<unknown>;
}

export const DataSourceEditor: FC<DataSourceEditorProps> = ({
  dataSources,
  fields,
  onChange,
  onTest,
}) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSourceName, setNewSourceName] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    details?: string;
  } | null>(null);

  const formatResult = (value: unknown) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const addDataSource = () => {
    const name = newSourceName.trim();
    if (!name) {
      setFeedbackModal({
        type: 'error',
        title: 'Name required',
        message: 'Enter a data source name before creating it.',
      });
      return;
    }

    if (dataSources[name]) {
      setFeedbackModal({
        type: 'error',
        title: 'Name already used',
        message: 'Choose a unique name for this data source.',
      });
      return;
    }

    onChange({
      ...dataSources,
      [name]: {
        url: '/api/endpoint',
        method: 'GET',
        valuePath: '$.data[*].{value:id, label:name}',
        cache: 'session',
        debounce: 300,
        dependsOn: [],
      },
    });
    setSelectedSource(name);
    setNewSourceName('');
    setIsAddDialogOpen(false);
  };

  const updateDataSource = (name: string, config: Partial<DataSourceConfig>) => {
    onChange({
      ...dataSources,
      [name]: { ...dataSources[name], ...config },
    });
  };

  const deleteDataSource = (name: string) => {
    const newSources = { ...dataSources };
    delete newSources[name];
    onChange(newSources);
    if (selectedSource === name) setSelectedSource(null);
    setPendingDeleteName(null);
  };

  const selected = selectedSource ? dataSources[selectedSource] : null;
  const sourceNames = Object.keys(dataSources);

  return (
    <>
      <div className="data-source-editor">
        <div className="data-source-list data-source-rail">
          <div className="data-source-hero">
            <div className="data-source-hero-icon">
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h3>Data Sources</h3>
              <p>Connect inputs to remote endpoints, cached lookups, and smart dependencies.</p>
            </div>
            <div className="data-source-hero-badge">
              <Sparkles className="w-3.5 h-3.5" />
              Live bindings
            </div>
          </div>

          <div className="helix-canvas-header data-source-toolbar">
            <div className="data-source-toolbar-meta">
              <span>{sourceNames.length} source{sourceNames.length === 1 ? '' : 's'}</span>
            </div>
            <button type="button" className="fb-btn fb-btn-primary" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          <ul className="data-source-listing">
            {sourceNames.map((name) => (
              <li
                key={name}
                className={selectedSource === name ? 'selected' : ''}
                onClick={() => setSelectedSource(name)}
              >
                <div className="data-source-item-main">
                  <span className="data-source-item-icon"><Database className="w-4 h-4" /></span>
                  <div>
                    <strong>{name}</strong>
                    <small>{dataSources[name].method} · {dataSources[name].cache ?? 'session'} cache</small>
                  </div>
                </div>
                <button type="button" className="data-source-delete-button" onClick={(e: any) => { e.stopPropagation(); setPendingDeleteName(name); }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>

          {sourceNames.length === 0 ? (
            <div className="empty-state data-source-empty-state" style={{ minHeight: 160 }}>
              <div className="data-source-empty-icon">
                <Database className="w-6 h-6" />
              </div>
              <p>No data sources yet.</p>
              <span>Add one to power async selects and field-driven lookups.</span>
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="data-source-config data-source-workspace">
            <div className="data-source-config-header">
              <div>
                <h3>Configure: {selectedSource}</h3>
                <p>Shape endpoint behavior, caching, request headers, and triggering fields.</p>
              </div>
              <div className="data-source-config-pill">
                <Globe2 className="w-4 h-4" />
                {selected.method} request
              </div>
            </div>
          
          <label>
            URL Template:
            <input
              type="text"
              value={selected.url}
              onChange={(e: any) => updateDataSource(selectedSource!, { url: e.target.value })}
              placeholder="/api/states?country={{country}}"
            />
            <small>Use {`{{fieldName}}`} for variable interpolation</small>
          </label>

          <label>
            Method:
            <select
              value={selected.method}
              onChange={(e: any) => updateDataSource(selectedSource!, { method: e.target.value as 'GET' | 'POST' })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>

          <label>
            Value Path (JSONPath):
            <input
              type="text"
              value={selected.valuePath}
              onChange={(e: any) => updateDataSource(selectedSource!, { valuePath: e.target.value })}
              placeholder="$.data[*].{value:code, label:name}"
            />
          </label>

          <label>
            Cache:
            <select
              value={selected.cache}
              onChange={(e: any) => updateDataSource(selectedSource!, { cache: e.target.value as any })}
            >
              <option value="session">Session (browser storage)</option>
              <option value="request">Request (per page load)</option>
              <option value="none">None</option>
            </select>
          </label>

          <label>
            Debounce (ms):
            <input
              type="number"
              value={selected.debounce || 300}
              onChange={(e: any) => updateDataSource(selectedSource!, { debounce: parseInt(e.target.value, 10) })}
            />
          </label>

          <label>
            Depends On (fields that trigger this data source):
            <div className="checkbox-group">
              {fields.map((field: FieldConfig) => (
                <label key={field.id}>
                  <input
                    type="checkbox"
                    checked={selected.dependsOn?.includes(field.id) || false}
                    onChange={(e: any) => {
                      const current = selected.dependsOn || [];
                      const updated = e.target.checked
                        ? [...current, field.id]
                        : current.filter((f: string) => f !== field.id);
                      updateDataSource(selectedSource!, { dependsOn: updated });
                    }}
                  />
                  {field.label || field.id}
                </label>
              ))}
            </div>
          </label>

          <label>
            Headers (JSON):
            <textarea
              value={JSON.stringify(selected.headers || {}, null, 2)}
              onChange={(e: any) => {
                try {
                  const headers = JSON.parse(e.target.value);
                  updateDataSource(selectedSource!, { headers });
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              rows={5}
            />
          </label>

          <button
            className="test-button"
            onClick={async () => {
              const previewUrl = selected.url.replace(/\{\{(\w+)\}\}/g, (_: string, field: string) => {
                const exampleField = fields.find((f: FieldConfig) => f.id === field);
                return String(exampleField?.defaultValue ?? `test_${field}`);
              });

              try {
                setIsTesting(true);
                const result = onTest
                  ? await onTest({
                      url: previewUrl,
                      method: selected.method,
                      headers: selected.headers,
                    })
                  : await fetch(previewUrl, {
                      method: selected.method,
                      headers: selected.headers,
                    }).then(res => res.json());

                setFeedbackModal({
                  type: 'success',
                  title: 'Endpoint responds',
                  message: 'The endpoint returned data successfully.',
                  details: formatResult(result),
                });
              } catch (err) {
                setFeedbackModal({
                  type: 'error',
                  title: 'Endpoint test failed',
                  message: err instanceof Error ? err.message : 'Unknown error',
                });
              } finally {
                setIsTesting(false);
              }
            }}
            disabled={isTesting}
          >
            <Play className="w-4 h-4" />
            {isTesting ? 'Testing endpoint...' : 'Test Endpoint'}
          </button>
        </div>
        ) : (
          <div className="data-source-config data-source-workspace data-source-workspace-empty">
            <div className="data-source-empty-stage">
              <div className="data-source-empty-orb">
                <Globe2 className="w-8 h-8" />
              </div>
              <h3>Select a data source</h3>
              <p>Choose a source from the left rail to configure endpoint behavior and field bindings.</p>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isAddDialogOpen ? (
          <motion.div className="fb-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="fb-modal-card" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}>
              <div className="fb-modal-header">
                <div className="fb-modal-icon">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3>Create data source</h3>
                  <p>Name the source you want to bind to remote data.</p>
                </div>
                <button type="button" className="fb-modal-close" onClick={() => setIsAddDialogOpen(false)}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="fb-modal-body">
                <label>
                  Data source name
                  <input
                    type="text"
                    className="fb-input"
                    value={newSourceName}
                    onChange={(e: any) => setNewSourceName(e.target.value)}
                    placeholder="countries_lookup"
                    autoFocus
                  />
                </label>
              </div>

              <div className="fb-modal-footer">
                <button type="button" className="fb-btn fb-btn-secondary" onClick={() => setIsAddDialogOpen(false)}>Cancel</button>
                <button type="button" className="fb-btn fb-btn-primary" onClick={addDataSource}>
                  <Plus className="w-4 h-4" />
                  Create source
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {pendingDeleteName ? (
          <motion.div className="fb-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="fb-modal-card fb-modal-card-compact" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}>
              <div className="fb-modal-header">
                <div className="fb-modal-icon danger">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3>Delete data source</h3>
                  <p>This removes <strong>{pendingDeleteName}</strong> from the form builder.</p>
                </div>
              </div>
              <div className="fb-modal-footer">
                <button type="button" className="fb-btn fb-btn-secondary" onClick={() => setPendingDeleteName(null)}>Cancel</button>
                <button type="button" className="fb-btn fb-btn-danger" onClick={() => deleteDataSource(pendingDeleteName)}>
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}

        {feedbackModal ? (
          <motion.div className="fb-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="fb-modal-card fb-modal-card-wide" initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }}>
              <div className="fb-modal-header">
                <div className={`fb-modal-icon ${feedbackModal.type}`}>
                  {feedbackModal.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </div>
                <div>
                  <h3>{feedbackModal.title}</h3>
                  <p>{feedbackModal.message}</p>
                </div>
                <button type="button" className="fb-modal-close" onClick={() => setFeedbackModal(null)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
              {feedbackModal.details ? (
                <div className="fb-modal-body">
                  <pre className="fb-modal-code">{feedbackModal.details}</pre>
                </div>
              ) : null}
              <div className="fb-modal-footer">
                <button type="button" className="fb-btn fb-btn-primary" onClick={() => setFeedbackModal(null)}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};
