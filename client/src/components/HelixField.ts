// client/components/HelixField.ts
import { ReactiveStore } from '../store/ReactiveStore';

// Assuming a singleton store instance for this component.
// In a real implementation, you might pass this via context or a registry.
// For now, we mock the global store access.
declare const window: any;
const getStore = () => window.HelixStore as ReactiveStore;

export class HelixField extends HTMLElement { 
    private fieldId: string = ''; 
    private inputElement: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null; 
    private errorElement: HTMLElement | null = null; 
    private labelElement: HTMLElement | null = null; 

    private unsubscribeFns: Array<() => void> = []; 

    private _isConnected = false; 

    constructor() { 
        super(); 
        // Enable Shadow DOM if needed later for stronger encapsulation 
        // this.attachShadow({ mode: 'open' }); 
    } 

    connectedCallback(): void { 
        if (this._isConnected) return; 
        this._isConnected = true; 

        this.fieldId = this.getAttribute('data-id') || this.getAttribute('name') || ''; 

        if (!this.fieldId) { 
            console.warn('[HelixField] Missing data-id or name attribute'); 
            return; 
        } 

        this.inputElement = this.querySelector('input, select, textarea'); 
        this.errorElement = this.querySelector('.error-msg, .error-message'); 
        this.labelElement = this.querySelector('label'); 

        if (!this.inputElement) { 
            console.warn(`[HelixField] No input element found for field: ${this.fieldId}`); 
            return; 
        } 

        this.setupInputListeners(); 
        this.registerWithStore(); 
        this.initializeFromStore(); 
    } 

    private setupInputListeners(): void { 
        if (!this.inputElement) return; 

        const handleInput = (e: Event) => { 
            const target = e.target as HTMLInputElement | HTMLSelectElement; 
            let value: any = target.value; 

            // Handle different input types 
            if (target.type === 'checkbox' || target.type === 'radio') { 
                value = (target as HTMLInputElement). checked; 
            } else if (target.type === 'number') { 
                value = target.value === '' ? null : Number(target.value); 
            } 

            // Update store (this triggers the DAG evaluation) 
            getStore()?.setValue(this.fieldId, value); 
        }; 

        // Use 'input' for real-time, 'change' for some controls 
        this.inputElement.addEventListener('input', handleInput); 
        this.inputElement.addEventListener('change', handleInput); 

        // Cleanup 
        this.unsubscribeFns.push(() => { 
            this.inputElement?.removeEventListener('input', handleInput); 
            this.inputElement?.removeEventListener('change', handleInput); 
        }); 
    } 

    private localState = {
        value: undefined as any,
        visible: true,
        required: false,
        errors: [] as string[]
    };

    private registerWithStore(): void { 
        const store = getStore();
        if(!store) return;

        // SINGLE SUBSCRIPTION: We receive the unified state ping from the store.
        const unsubscribe = store.subscribe(this.fieldId, (newState) => {
            this.reconcileStateWithDOM();
        });

        this.unsubscribeFns.push(unsubscribe); 
    } 

    private initializeFromStore(): void { 
        this.reconcileStateWithDOM();
    } 

    /**
     * Translate the Store's mathematical state into physical DOM attributes.
     */
    private reconcileStateWithDOM(): void {
        const store = getStore();
        if(!store) return;

        // 1. Pull the unified state from the store's maps
        const storeValue = store.getValue(this.fieldId);
        const isVisible = store.state.visibility.has(this.fieldId) ? store.state.visibility.get(this.fieldId)! : true;
        const isRequired = store.state.required.has(this.fieldId) ? store.state.required.get(this.fieldId)! : false;
        const errors = store.state.errors.get(this.fieldId) || [];

        // 2. Batch DOM mutations via requestAnimationFrame
        requestAnimationFrame(() => {
            // reconcile Value
            if (this.localState.value !== storeValue) {
                this.localState.value = storeValue;
                if (this.inputElement && this.inputElement.value !== String(storeValue ?? '')) {
                     if (this.inputElement.type === 'checkbox' || this.inputElement.type === 'radio') {
                         (this.inputElement as HTMLInputElement).checked = !!storeValue;
                     } else {
                         this.inputElement.value = String(storeValue ?? '');
                     }
                }
            }

            // reconcile Visibility
            if (this.localState.visible !== isVisible) {
                this.localState.visible = isVisible;
                this.applyVisibility(isVisible);
            }

            // reconcile Required
            if (this.localState.required !== isRequired) {
                 this.localState.required = isRequired;
                 this.applyRequired(isRequired);
            }

            // reconcile Errors
            if (JSON.stringify(this.localState.errors) !== JSON.stringify(errors)) {
                 this.localState.errors = [...errors];
                 this.applyErrors(errors);
            }
        });
    }

    private applyVisibility(isVisible: boolean): void { 
        if (isVisible) { 
            this.style.display = '';
            this.removeAttribute('hidden'); 
            this.removeAttribute('aria-hidden'); 
            this.inputElement?.removeAttribute('disabled'); 
        } else { 
            this.style.display = 'none';
            this.setAttribute('hidden', ''); 
            this.setAttribute('aria-hidden', 'true'); 
            this.inputElement?.setAttribute('disabled', 'true'); 
        } 
    } 

    private applyRequired(isRequired: boolean): void {
        if (isRequired) {
            this.toggleAttribute('required', true);
            this.inputElement?.toggleAttribute('required', true);
        } else {
            this.removeAttribute('required');
            this.inputElement?.removeAttribute('required');
        }
    }

    private applyErrors(errors: string[]): void { 
        if (!this.errorElement) return; 

        if (errors && errors.length > 0) { 
            this.errorElement.textContent = errors[0]; 
            this.errorElement.setAttribute('aria-hidden', 'false'); 
            this.inputElement?.setAttribute('aria-invalid', 'true'); 
            this.classList.add('invalid'); 
        } else { 
            this.errorElement.textContent = ''; 
            this.errorElement.setAttribute('aria-hidden', 'true'); 
            this.inputElement?.removeAttribute('aria-invalid'); 
            this.classList.remove('invalid'); 
        } 
    } 

    disconnectedCallback(): void { 
        this.unsubscribeFns.forEach(unsub => unsub()); 
        this.unsubscribeFns = [];
        this._isConnected = false;
    }

    public setValue(value: any): void {
        if (this.inputElement) {
            if (this.inputElement.type === 'checkbox') {
                (this.inputElement as HTMLInputElement).checked = !!value;
            } else {
                this.inputElement.value = String(value ?? '');
            }
        }
    }
}

if (!customElements.get('helix-field')) {
    customElements.define('helix-field', HelixField);
}