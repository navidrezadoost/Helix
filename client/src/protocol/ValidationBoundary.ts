/**
 * Defines the strict separation between predictive UI validation and Authoritative runtime state.
 */
export enum ValidationLayer {
    LOCAL_UX = 'LOCAL_UX',                 // Client-side, fast, predictive (No remote trust required)
    SERVER_AUTHORITY = 'SERVER_AUTHORITY', // Server-side, canonical truth (E.g. PHP backend verifying schema)
    CROSS_FORM = 'CROSS_FORM',             // Orchestration layer between multiple workflow steps
    EXTERNAL_ASYNC = 'EXTERNAL_ASYNC',     // 3rd-party integrations (e.g. Stripe card checks, Address Verification)
    WORKFLOW = 'WORKFLOW'                  // Downstream structural state tests
}

export interface ValidationViolation {
    fieldId: string;
    ruleId: string;
    message: string;
    layer: ValidationLayer;
    severity: 'INFO' | 'WARNING' | 'BLOCKING'; // Only BLOCKING prevents transition to submission
}

/**
 * ValidationBoundary Contract
 * Acts as the artifact transferred between separated validation silos.
 */
export interface ValidationBoundaryContract {
    layer: ValidationLayer;
    isValid: boolean;
    violations: ValidationViolation[];
    timestamp: number;
}
