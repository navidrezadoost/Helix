import { ReactiveStore, RuntimeGraphBuilder, StoreToEnvelopeAdapter, ExpressionEngine, CompiledGraph } from '@helix/core';

export class HelixFormElement extends HTMLElement {
  private store: ReactiveStore | null = null;
  private adapter: StoreToEnvelopeAdapter | null = null;
  private compiledGraph: CompiledGraph | null = null;
  private unsubscribe: (() => void) | null = null;
  private container: HTMLElement;
  private prefetchConfigs: Array<{ targetField: string; dependsOn: string[] }> = [];
  private prefetchTimeouts: Map<string, number> = new Map();

  static get observedAttributes() {
    return ['schema-id', 'schema-version', 'endpoint', 'platform', 'enable-prefetch'];
  }

  constructor() {
    super();
    this.container = document.createElement('div');
    this.appendChild(this.container);
  }

  async connectedCallback() {
    const schemaId = this.getAttribute('schema-id');
    const version = parseInt(this.getAttribute('schema-version') || '1', 10);
    const endpoint = this.getAttribute('endpoint');
    const platform = this.getAttribute('platform') || 'web';
    const enablePrefetch = this.getAttribute('enable-prefetch') !== 'false';

    if (!schemaId || !endpoint) {
      console.error('helix-form: schema-id and endpoint attributes are required');
      return;
    }

    await this.init(schemaId, version, endpoint, platform);
    
    if (enablePrefetch && this.prefetchConfigs.length > 0) {
      this.setupPrefetchObservers();
    }
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.store) this.store.destroy();
  }

  private async init(schemaId: string, version: number, endpoint: string, platform: string) {
    try {
      const response = await fetch(`${endpoint}/api/v1/schemas/${schemaId}?version=${version}`);
      if (!response.ok) throw new Error(`Failed to fetch schema: ${response.status}`);
      const { data: compiledGraph } = await response.json();

      this.compiledGraph = compiledGraph;
      
      // Extract prefetch configs from populateSelect rules
      for (const rule of compiledGraph.rules || []) {
        for (const action of rule.actions) {
          if (action.type === 'populateSelect') {
            this.prefetchConfigs.push({
              targetField: action.field,
              dependsOn: rule.depends_on || [],
            });
          }
        }
      }

      const engine = new ExpressionEngine();
      const store = new ReactiveStore(engine);
      const dependencyMap = RuntimeGraphBuilder.buildDependencyMap(compiledGraph);
      store.initGraph(compiledGraph, dependencyMap);
      RuntimeGraphBuilder.registerFields(store, compiledGraph, {});

      this.store = store;
      
      this.adapter = new StoreToEnvelopeAdapter(store, compiledGraph, {
        schemaId,
        schemaVersion: version,
        schemaHash: compiledGraph.dagHash,
        platform,
        sdkVersion: 'helix-webcomponents@1.0.0',
        locale: navigator.language,
      });

      this.unsubscribe = store.subscribe(() => this.render());
      this.render();
      
    } catch (error) {
      console.error('HelixForm initialization failed:', error);
      this.container.innerHTML = `<div class="helix-error">Failed to load form: ${(error as Error).message}</div>`;
    }
  }

  private render() {
    if (!this.store || !this.compiledGraph) return;

    const fields = this.store.getAllState();
    
    this.container.innerHTML = `
      <style>
        .helix-form {
          font-family: system-ui, -apple-system, sans-serif;
        }
        .helix-actions {
          margin-top: 20px;
          display: flex;
          gap: 12px;
        }
        .helix-submit {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .helix-submit:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        .helix-submit:hover:not(:disabled) {
          background: #2563eb;
        }
        .helix-error-form {
          color: #dc2626;
          margin-top: 10px;
        }
      </style>
      <div class="helix-form">
        <form id="helix-form-inner">
          ${Array.from(fields.entries()).map(([fieldId]: [string, unknown]) => `
            <helix-field field-id="${fieldId}"></helix-field>
          `).join('')}
          <div class="helix-actions">
            <button type="submit" class="helix-submit" id="helix-submit">Submit</button>
          </div>
        </form>
        <div id="helix-form-error" class="helix-error-form"></div>
      </div>
    `;

    const form = this.container.querySelector('#helix-form-inner');
    const submitBtn = this.container.querySelector('#helix-submit') as HTMLButtonElement;
    const errorDiv = this.container.querySelector('#helix-form-error');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (submitBtn) submitBtn.disabled = true;
        
        try {
          const result = await this.submit();
          if (errorDiv) errorDiv.textContent = '';
          this.dispatchEvent(new CustomEvent('submit-success', { detail: result }));
        } catch (err) {
          const errorMsg = (err as Error).message;
          if (errorDiv) errorDiv.textContent = `Submission failed: ${errorMsg}`;
          this.dispatchEvent(new CustomEvent('submit-error', { detail: { error: errorMsg } }));
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  private setupPrefetchObservers() {
    // Create a mapping from dependency fields to target fields
    const dependencyMap = new Map<string, Set<string>>();
    for (const config of this.prefetchConfigs) {
      for (const dep of config.dependsOn) {
        if (!dependencyMap.has(dep)) {
          dependencyMap.set(dep, new Set());
        }
        dependencyMap.get(dep)!.add(config.targetField);
      }
    }

    // Observe focus events on dependency fields
    const handleFocus = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const fieldId = target.getAttribute('data-field-id') || target.id;
      
      const targetsToPrefetch = dependencyMap.get(fieldId);
      if (!targetsToPrefetch) return;

      for (const targetField of targetsToPrefetch) {
        // Debounce prefetch
        const existingTimeout = this.prefetchTimeouts.get(targetField);
        if (existingTimeout) clearTimeout(existingTimeout);
        
        const timeout = window.setTimeout(() => {
          this.triggerPrefetch(targetField);
          this.prefetchTimeouts.delete(targetField);
        }, 150);
        
        this.prefetchTimeouts.set(targetField, timeout);
      }
    };

    // Attach focus listeners to all fields (dynamic)
    const attachListeners = () => {
      const fields = this.container.querySelectorAll('helix-field');
      for (const field of fields) {
        const fieldId = field.getAttribute('field-id');
        if (fieldId && !field.hasAttribute('data-prefetch-listener')) {
          const input = field.shadowRoot?.querySelector('input, select');
          if (input) {
            input.addEventListener('focus', handleFocus);
            field.setAttribute('data-prefetch-listener', 'true');
          }
        }
      }
    };

    // Initial attachment
    attachListeners();
    
    // Watch for dynamically added fields
    const observer = new MutationObserver(() => attachListeners());
    observer.observe(this.container, { childList: true, subtree: true });
  }

  private triggerPrefetch(targetField: string) {
    if (!this.store) return;
    
    const fieldState = this.store.getFieldState(targetField);
    // Only prefetch if not loading, no error, and no cached data
    if (fieldState?.asyncState?.isLoading) return;
    if (fieldState?.asyncState?.lastError) return;
    if (fieldState?.asyncState?.lastOptions?.length) return;
    
    const currentValue = fieldState?.value;
    if (currentValue !== undefined && currentValue !== null) {
      this.store.dispatch({
        type: 'FIELD_CHANGE',
        nodeId: targetField,
        value: currentValue,
      });
    }
  }

  async submit(): Promise<any> {
    if (!this.store || !this.adapter) {
      throw new Error('Form not initialized');
    }

    this.store.finalize();
    const envelope = this.adapter.extract();
    
    const endpoint = this.getAttribute('endpoint');
    const response = await fetch(`${endpoint}/api/v1/public/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    return response.json();
  }

  getStore(): ReactiveStore | null {
    return this.store;
  }
}

customElements.define('helix-form', HelixFormElement);