/**
 * Defines standard lifecycle and operation triggers for the Event Bus.
 * Forms are no longer static inputs; they are orchestrated event emitters.
 */
export enum WorkflowEventType {
    RUNTIME_INITIALIZED = 'RUNTIME_INITIALIZED',
    FORM_LOADED = 'FORM_LOADED',
    
    VALIDATION_PASSED = 'VALIDATION_PASSED',
    VALIDATION_FAILED = 'VALIDATION_FAILED',
    
    SUBMISSION_REQUESTED = 'SUBMISSION_REQUESTED', // Intent to submit (allows middleware interception)
    SUBMISSION_ACCEPTED = 'SUBMISSION_ACCEPTED',   // Backend recorded it
    SUBMISSION_REJECTED = 'SUBMISSION_REJECTED',
    
    WORKFLOW_TRIGGERED = 'WORKFLOW_TRIGGERED',     // Subsequent logic starting (zapier, email, webhook)
    PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',
    APPROVAL_PENDING = 'APPROVAL_PENDING'
}

/**
 * Universal Event Contract
 * Broadcast across the host environment so parent applications (like a Vue frontend or WP instance)
 * can natively hook into Helix logic and bridge the execution boundary.
 */
export interface WorkflowEvent<P = any> {
    eventId: string;
    submissionId?: string; // Correlates event to a specific SubmissionEnvelope
    type: WorkflowEventType;
    timestamp: number;
    payload: P;
}
