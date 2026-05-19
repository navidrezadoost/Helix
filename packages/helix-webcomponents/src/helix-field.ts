import { ReactiveStore, FieldState } from '@helix/core';

export class HelixFieldElement extends HTMLElement {
  private store: ReactiveStore | null = null;
  private fieldId: string = '';
  private unsubscribe: (() => void) | null = null;
  private renderRoot: ShadowRoot;

  static get observedAttributes() {
    return ['field-id'];
  }

  constructor() {
    super();
    this.renderRoot = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.fieldId = this.getAttribute('field-id') || '';
    if (!this.fieldId) return;

    const formElement = this.closest('helix-form');
    if (formElement && (formElement as any).store) {
      this.store = (formElement as any).store;
      this.init();
    }
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (name === 'field-id' && oldValue !== newValue) {
      this.fieldId = newValue;
      if (this.store) {
        this.unsubscribe?.();
        this.init();
      }
    }
  }

  private init() {
    if (!this.store || !this.fieldId) return;

    const update = () => {
      const state = this.store!.getFieldState(this.fieldId);
      if (state) this.render(state);
    };

    this.unsubscribe = this.store.subscribe(update);
    update();
  }

  private render(state: FieldState) {
    const { value, visible, required, disabled, errors, type, options, asyncState } = state;

    if (!visible) {
      this.renderRoot.innerHTML = '';
      return;
    }

    const hasError = errors.length > 0;
    const isAsyncSelect = type === 'select' && asyncState !== undefined;

    if (isAsyncSelect) {
      // Use custom async-select web component
      this.renderRoot.innerHTML = `
        <style>
          .helix-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 16px;
          }
          .helix-label {
            font-weight: 500;
            font-size: 14px;
          }
          .helix-required {
            color: #dc2626;
            margin-left: 4px;
          }
          .helix-errors {
            color: #dc2626;
            font-size: 12px;
          }
        </style>
        <div class="helix-field">
          <label class="helix-label" for="${this.fieldId}">
            ${this.fieldId}
            ${required ? '<span class="helix-required">*</span>' : ''}
          </label>
          <helix-async-select
            field-id="${this.fieldId}"
            prefetch-on-focus="true"
            show-cache="true"
          ></helix-async-select>
          ${hasError ? `
            <div class="helix-errors">
              ${errors.map((e: string) => `<div>${this.escapeHtml(e)}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
      return;
    }

    // Regular input rendering (text, number, sync select)
    this.renderRoot.innerHTML = `
      <style>
        .helix-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-bottom: 16px;
        }
        .helix-label {
          font-weight: 500;
          font-size: 14px;
        }
        .helix-required {
          color: #dc2626;
          margin-left: 4px;
        }
        .helix-input, .helix-select {
          padding: 8px 12px;
          border: 1px solid ${hasError ? '#dc2626' : '#d1d5db'};
          border-radius: 6px;
          font-size: 14px;
        }
        .helix-input:focus, .helix-select:focus {
          outline: none;
          border-color: #3b82f6;
          ring: 2px solid #3b82f6;
        }
        .helix-errors {
          color: #dc2626;
          font-size: 12px;
        }
      </style>
      <div class="helix-field">
        <label class="helix-label" for="${this.fieldId}">
          ${this.fieldId}
          ${required ? '<span class="helix-required">*</span>' : ''}
        </label>
        ${type === 'select' && options ? `
          <select class="helix-select" id="${this.fieldId}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''}>
            <option value="">Select...</option>
            ${options.map((opt: { value: string; label: string }) => `
              <option value="${this.escapeHtml(opt.value)}" ${value === opt.value ? 'selected' : ''}>
                ${this.escapeHtml(opt.label)}
              </option>
            `).join('')}
          </select>
        ` : `
          <input 
            class="helix-input"
            id="${this.fieldId}"
            type="${type === 'number' ? 'number' : 'text'}"
            value="${this.escapeHtml(String(value ?? ''))}"
            ${disabled ? 'disabled' : ''}
            ${required ? 'required' : ''}
          />
        `}
        ${hasError ? `
          <div class="helix-errors">
            ${errors.map((e: string) => `<div>${this.escapeHtml(e)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Bind event listeners
    const input = this.renderRoot.querySelector('input, select');
    if (input) {
      input.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        let newValue: any = target.value;
        if (type === 'number') newValue = parseFloat(newValue);
        this.store?.dispatch({
          type: 'FIELD_CHANGE',
          nodeId: this.fieldId,
          value: newValue,
        });
      });
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

customElements.define('helix-field', HelixFieldElement);