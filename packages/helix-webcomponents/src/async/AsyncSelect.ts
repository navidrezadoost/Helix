import { ReactiveStore } from '@helix/core';

export interface AsyncSelectState {
  isLoading: boolean;
  error: string | null;
  options: Array<{ value: string; label: string }>;
  lastFetchedAt: number | null;
}

export class AsyncSelectElement extends HTMLElement {
  private store: ReactiveStore | null = null;
  private fieldId: string = '';
  private selectElement: HTMLSelectElement | null = null;
  private loadingIndicator: HTMLElement | null = null;
  private errorContainer: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private retryButton: HTMLButtonElement | null = null;
  private prefetchOnFocus: boolean = true;
  private showCacheWhileLoading: boolean = true;
  private autoRetryMs: number = 30000;
  private autoRetryTimeout: number | null = null;
  private mutationObserver: MutationObserver | null = null;

  static get observedAttributes() {
    return ['field-id', 'prefetch-on-focus', 'show-cache', 'auto-retry-ms'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.fieldId = this.getAttribute('field-id') || '';
    this.prefetchOnFocus = this.getAttribute('prefetch-on-focus') !== 'false';
    this.showCacheWhileLoading = this.getAttribute('show-cache') !== 'false';
    this.autoRetryMs = parseInt(this.getAttribute('auto-retry-ms') || '30000', 10);

    if (!this.fieldId) {
      console.error('AsyncSelect: field-id attribute is required');
      return;
    }

    // Find parent helix-form and get its store
    const formElement = this.closest('helix-form');
    if (formElement && (formElement as any).store) {
      this.store = (formElement as any).store;
      this.init();
    } else {
      // Wait for form to initialize
      const observer = new MutationObserver(() => {
        const form = this.closest('helix-form');
        if (form && (form as any).store) {
          this.store = (form as any).store;
          this.init();
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      this.mutationObserver = observer;
    }
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.autoRetryTimeout) clearTimeout(this.autoRetryTimeout);
    if (this.mutationObserver) this.mutationObserver.disconnect();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    
    switch (name) {
      case 'prefetch-on-focus':
        this.prefetchOnFocus = newValue !== 'false';
        break;
      case 'show-cache':
        this.showCacheWhileLoading = newValue !== 'false';
        break;
      case 'auto-retry-ms':
        this.autoRetryMs = parseInt(newValue, 10) || 30000;
        break;
    }
  }

  private init() {
    if (!this.store) return;

    this.render();
    this.bindEvents();
    this.subscribeToStore();
    this.setupPrefetch();
  }

  private render() {
    if (!this.shadowRoot) return;

    const currentState = this.getCurrentState();
    const { isLoading, error, options, lastFetchedAt } = currentState;
    const fieldState = this.store!.getFieldState(this.fieldId);
    const value = fieldState?.value ?? '';
    const disabled = fieldState?.disabled ?? false;
    const required = fieldState?.required ?? false;
    const hasCache = options.length > 0;

    const showLoading = isLoading && (!this.showCacheWhileLoading || !hasCache);
    const showError = !isLoading && error !== null && (!this.showCacheWhileLoading || !hasCache);
    const displayOptions = this.showCacheWhileLoading && isLoading && hasCache
      ? (fieldState?.asyncState?.lastOptions || options)
      : options;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: inherit;
        }
        
        .helix-async-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .helix-async-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #f9fafb;
          border-radius: 6px;
          color: #6b7280;
        }
        
        .helix-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #e5e7eb;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .helix-async-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: #fee2e2;
          border-radius: 6px;
          color: #dc2626;
          font-size: 14px;
        }
        
        .helix-retry-button {
          padding: 4px 12px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }
        
        .helix-retry-button:hover {
          background: #b91c1c;
        }
        
        .helix-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }
        
        .helix-select:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }
        
        .helix-select:focus {
          outline: none;
          border-color: #3b82f6;
          ring: 2px solid #3b82f6;
        }
        
        .helix-field-meta {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }
      </style>
      
      <div class="helix-async-container">
        ${showLoading ? `
          <div class="helix-async-loading">
            <div class="helix-spinner"></div>
            <span>Loading options...</span>
          </div>
        ` : showError ? `
          <div class="helix-async-error">
            <span>⚠️</span>
            <span>${this.escapeHtml(error || 'Unknown error')}</span>
            <button class="helix-retry-button" data-retry>Retry</button>
          </div>
        ` : `
          <select class="helix-select" data-select 
            ${disabled ? 'disabled' : ''}
            ${required ? 'required' : ''}
            aria-busy="${isLoading}"
            aria-invalid="${!!error}"
          >
            <option value="">Select an option...</option>
            ${displayOptions.map((opt: { value: string; label: string }) => `
              <option value="${this.escapeHtml(opt.value)}" ${value === opt.value ? 'selected' : ''}>
                ${this.escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
        `}
        
        ${lastFetchedAt && !showLoading && !showError ? `
          <div class="helix-field-meta">
            Updated: ${new Date(lastFetchedAt).toLocaleTimeString()}
          </div>
        ` : ''}
      </div>
    `;

    // Cache element references
    this.selectElement = this.shadowRoot.querySelector('[data-select]');
    this.retryButton = this.shadowRoot.querySelector('[data-retry]');
  }

  private bindEvents() {
    if (!this.shadowRoot) return;

    // Select change event
    if (this.selectElement) {
      this.selectElement.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        if (this.store) {
          this.store.dispatch({
            type: 'FIELD_CHANGE',
            nodeId: this.fieldId,
            value: target.value,
          });
        }
      });
    }

    // Retry button
    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => {
        this.retry();
      });
    }
  }

  private subscribeToStore() {
    if (!this.store) return;

    const updateState = () => {
      this.render();
      this.bindEvents();
    };

    this.unsubscribe = this.store.subscribe(updateState);
    updateState();
  }

  private setupPrefetch() {
    if (!this.prefetchOnFocus || !this.selectElement) return;

    const handleFocus = () => {
      // Check if we need to prefetch (no error, not loading, no cache)
      const state = this.getCurrentState();
      if (!state.isLoading && !state.error && state.options.length === 0) {
        // Trigger prefetch by dispatching current value
        const fieldState = this.store?.getFieldState(this.fieldId);
        if (fieldState?.value && this.store) {
          this.store.dispatch({
            type: 'FIELD_CHANGE',
            nodeId: this.fieldId,
            value: fieldState.value,
          });
        }
      }
    };

    this.selectElement.addEventListener('focus', handleFocus);
  }

  private getCurrentState(): AsyncSelectState {
    if (!this.store) {
      return { isLoading: false, error: null, options: [], lastFetchedAt: null };
    }

    const fieldState = this.store.getFieldState(this.fieldId);
    const asyncState = fieldState?.asyncState;
    
    return {
      isLoading: asyncState?.isLoading ?? false,
      error: asyncState?.lastError ?? null,
      options: fieldState?.options ?? [],
      lastFetchedAt: asyncState?.lastFetchedAt ?? null,
    };
  }

  private retry() {
    if (!this.store) return;
    
    // Clear any pending auto-retry
    if (this.autoRetryTimeout) {
      clearTimeout(this.autoRetryTimeout);
      this.autoRetryTimeout = null;
    }
    
    const fieldState = this.store.getFieldState(this.fieldId);
    if (fieldState?.value !== undefined && fieldState.value !== null) {
      this.store.dispatch({
        type: 'FIELD_CHANGE',
        nodeId: this.fieldId,
        value: fieldState.value,
      });
    }
  }

  private scheduleAutoRetry() {
    if (this.autoRetryMs <= 0) return;
    
    const state = this.getCurrentState();
    if (state.error && !state.isLoading) {
      if (this.autoRetryTimeout) clearTimeout(this.autoRetryTimeout);
      this.autoRetryTimeout = window.setTimeout(() => {
        this.retry();
      }, this.autoRetryMs);
    }
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

customElements.define('helix-async-select', AsyncSelectElement);