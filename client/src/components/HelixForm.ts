// client/src/components/HelixForm.ts
import { ReactiveStore } from '../store/ReactiveStore';
// import { JsonLogicEvaluator } from '../evaluator/JsonLogicEvaluator';

declare const window: any;
// Mocking the field class import for now as they are registered globally
declare class HelixField extends HTMLElement {}

export class HelixForm extends HTMLElement {
    private formId: string = '';
    private schemaId: string = '';
    private schemaVersion: string = '';

    private mutationObserver: MutationObserver | null = null;
    // private jsonLogicEvaluator: JsonLogicEvaluator;

    private _isInitialized = false;

    constructor() {
        super();
        // this.jsonLogicEvaluator = new JsonLogicEvaluator();
    }

    connectedCallback(): void {
        if (this._isInitialized) return;

        this.formId = this.getAttribute('id') || `form-${Math.random().toString(36).slice(2)}`;
        this.schemaId = this.getAttribute('data-schema-id') || '';
        this.schemaVersion = this.getAttribute('data-schema-version') || '';

        if (!this.schemaId) {
            console.error('[HelixForm] Missing data-schema-id attribute');
            return;
        }

        this.initializeForm();
        this._isInitialized = true;
    }

    private async initializeForm(): Promise<void> {
        // 1. Load schema (from server or embedded)
        const schema = await this.loadSchema();

        // 2. Initialize ReactiveStore with DAG order from server
        // Assuming global store instance for now based on earlier setup
        if(!window.HelixStore) {
            window.HelixStore = new ReactiveStore();
        }
        window.HelixStore.initialize(schema);

        // 3. Connect JsonLogic evaluator to store
        // this.jsonLogicEvaluator.connectToStore(window.HelixStore);

        // 4. Setup MutationObserver for dynamic fields (Self-Awareness)
        this.setupMutationObserver();

        // 5. Initialize all existing helix-field children
        this.initializeExistingFields();

        // 6. Attach form submit handler
        this.setupSubmitHandler();
    }

    private async loadSchema(): Promise<any> {
        // Priority: Embedded schema > data attribute > fetch from server
        const embedded = this.querySelector('script[type="application/json"][data-schema]');
        if (embedded) {
            return JSON.parse(embedded.textContent || '{}');
        }

        // Fallback: Fetch from server
        const response = await fetch(`/api/schemas/${this.schemaId}/${this.schemaVersion}`);
        return response.json();
    }

    private setupMutationObserver(): void {
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node instanceof HTMLElement && 
                        (node.tagName === 'HELIX-FIELD' || node.querySelector('helix-field'))) {
                        
                        // Give the browser a chance to upgrade the custom element
                        setTimeout(() => {
                            this.initializeNewField(node);
                        }, 0);
                    }
                });
            });
        });

        this.mutationObserver.observe(this, {
            childList: true,
            subtree: true
        });
    }

    private initializeExistingFields(): void {
        const fields = this.querySelectorAll('helix-field');
        fields.forEach(field => {
            // Initialization happens in field connectedCallback
            // Just ensuring it's recognized here
        });
    }

    private initializeNewField(node: HTMLElement): void {
        const helixField = node.tagName === 'HELIX-FIELD' ? node : node.querySelector('helix-field');
        if (helixField) {
            console.log(`[HelixForm] Dynamically registered new field: ${helixField.getAttribute('data-id')}`);
            // The field will self-register via its own connectedCallback
        }
    }

    private setupSubmitHandler(): void {
        this.addEventListener('submit', async (e: Event) => {
            e.preventDefault();

            const formData = this.collectFormData();
            
            // Client-side validation
            const validationResult = await this.validateForm(formData);

            if (!validationResult.valid) {
                this.dispatchEvent(new CustomEvent('validation-failed', {
                    detail: validationResult.errors,
                    bubbles: true
                }));
                return;
            }

            // Dispatch success event for Laravel / external handling
            this.dispatchEvent(new CustomEvent('form-submit', {
                detail: {
                    schema_id: this.schemaId,
                    version: this.schemaVersion,
                    data: formData,
                    meta: validationResult.meta
                },
                bubbles: true
            }));
        });
    }

    private collectFormData(): Record<string, any> {
        const data: Record<string, any> = {};
        
        const fields = this.querySelectorAll('helix-field');
        fields.forEach(field => {
            const id = field.getAttribute('data-id');
            if (id && window.HelixStore) {
                data[id] = window.HelixStore.getValue(id);
            }
        });

        return data;
    }

    private async validateForm(formData: Record<string, any>) {
        // In real implementation this would call client-side JsonLogic rules
        // For now, placeholder
        return {
            valid: true,
            meta: {},
            errors: {}
        };
    }

    disconnectedCallback(): void {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
    }

    // Public API
    public getReactiveStore() {
        return window.HelixStore;
    }
}

// Register the custom element
if (!customElements.get('helix-form')) {
    customElements.define('helix-form', HelixForm);
}