// client/src/evaluator/JsonLogicEvaluator.ts
import { ReactiveStore } from '../store/ReactiveStore';
import { RuntimeEffect } from '../runtime/effects';

type JsonLogicRule = any; // JsonLogic AST

export class JsonLogicEvaluator {
    private store: ReactiveStore | null = null;

    constructor() {}

    public connectToStore(store: ReactiveStore): void {
        this.store = store;
    }

    /**
     * Evaluates a JsonLogic rule against the current form state
     */
    public evaluate(rule: JsonLogicRule, fieldContext?: string): any {
        if (!rule || typeof rule !== 'object') {
            return rule; // Primitive value
        }

        try {
            // Use json-logic-js if available, otherwise fallback to our safe evaluator
            if (typeof (window as any).jsonLogic !== 'undefined') {
                return (window as any).jsonLogic.apply(rule, this.getStateForLogic());
            }

            return this.safeEvaluate(rule, this.getStateForLogic());
        } catch (error) {
            console.error(`[JsonLogicEvaluator] Error evaluating rule for field ${fieldContext}:`, error);
            return false;
        }
    }

    /**
     * Converts our flat Map-based state into a plain object suitable for JsonLogic
     */
    private getStateForLogic(): Record<string, any> {
        const state: Record<string, any> = {};
        if (!this.store) return state;

        const storeMap = (this.store as any).state.values as Map<string, any>;
        for (const [key, value] of storeMap) {
            state[key] = value;
        }

        return state;
    }

    /**
     * Lightweight safe evaluator (fallback if json-logic-js is not loaded)
     */
    private safeEvaluate(rule: JsonLogicRule, data: Record<string, any>): any {
        const operator = Object.keys(rule)[0];
        const values = rule[operator];

        switch (operator) {
            case 'var':
                return data[values] ?? null;

            case '==':
            case '===':
                return this.safeEvaluate(values[0], data) === this.safeEvaluate(values[1], data);

            case '!=':
            case '!==':
                return this.safeEvaluate(values[0], data) !== this.safeEvaluate(values[1], data);

            case '>':
                return this.safeEvaluate(values[0], data) > this.safeEvaluate(values[1], data);

            case '>=':
                return this.safeEvaluate(values[0], data) >= this.safeEvaluate(values[1], data);

            case '<':
                return this.safeEvaluate(values[0], data) < this.safeEvaluate(values[1], data);

            case '<=':
                return this.safeEvaluate(values[0], data) <= this.safeEvaluate(values[1], data);

            case 'and':
                return values.every((v: any) => this.safeEvaluate(v, data));

            case 'or':
                return values.some((v: any) => this.safeEvaluate(v, data));

            case '!':
                return !this.safeEvaluate(values, data);

            case '+':
                return values.reduce((a: number, b: any) => a + this.safeEvaluate(b, data), 0);

            case '*':
                return values.reduce((a: number, b: any) => a * this.safeEvaluate(b, data), 1);

            default:
                console.warn(`[JsonLogicEvaluator] Unsupported operator: ${operator}`);
                return false;
        }
    }

    /**
     * PURE FUNCTION: Evaluates rules and returns an array of RuntimeEffects.
     * Does NOT mutate the store directly.
     */
    public evaluateFieldRules(fieldId: string, relational: any): RuntimeEffect[] {
        const effects: RuntimeEffect[] = [];
        if (!relational || !this.store) return effects;

        // Visibility Effect
        if (relational.visibility !== undefined) {
            const isVisible = this.evaluate(relational.visibility, fieldId);
            effects.push({
                type: 'visibility',
                field: fieldId,
                visible: !!isVisible
            });
        }

        // Required Effect
        if (relational.required) {
            const isRequired = this.evaluate(relational.required, fieldId);
            effects.push({
                type: 'required',
                field: fieldId,
                required: !!isRequired
            });
        }

        // Field-level rules (e.g. SetError array)
        if (Array.isArray(relational.rules)) {
            const fieldErrors: string[] = [];
            for (const rule of relational.rules) {
                if (rule.condition) {
                    const conditionMet = this.evaluate(rule.condition, fieldId);
                    if (conditionMet && rule.action === 'setError') {
                        fieldErrors.push(rule.message || 'Validation error');
                    }
                }
            }
            if (fieldErrors.length > 0) {
                effects.push({
                    type: 'error',
                    field: fieldId,
                    errors: fieldErrors
                });
            } else {
                 // Explicitly clear errors if conditions are no longer met
                 effects.push({
                    type: 'error',
                    field: fieldId,
                    errors: []
                });
            }
        }

        return effects;
    }

    /**
     * PURE FUNCTION: Process form-level rules and return MetaEffects
     */
    public evaluateFormLevelRules(formId: string, formLevelRules: any[]): RuntimeEffect[] {
        const effects: RuntimeEffect[] = [];

        for (const rule of formLevelRules) {
            if (rule.condition) {
                const result = this.evaluate(rule.condition);
                if (result && rule.actions) {
                    for (const action of rule.actions) {
                        if (action.type === 'set_meta') {
                            effects.push({
                                type: 'meta',
                                field: formId, // formId acts as the key for form-level meta
                                key: action.key,
                                value: action.value
                            });
                        }
                    }
                }
            }
        }

        return effects;
    }
}

// Global singleton for easy access
export const JsonLogicEvaluatorInstance = new JsonLogicEvaluator();