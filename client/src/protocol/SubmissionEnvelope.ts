/**
 * HostMetadata captures the untrusted host environment where the Helix runtime is currently embedded.
 */
export interface HostMetadata {
    platform: string; // e.g., 'wordpress', 'react', 'vue', 'shopify', 'ios-webview'
    sdkVersion: string;
    locale: string;
    timezone: string;
    embeddedMode: 'iframe' | 'webcomponent' | 'headless' | 'ssr';
    hostCapabilities?: Record<string, boolean>;
}

/**
 * ValidationState represents the strictly separated predictive UX state
 * and flags expectations for the authoritative server boundary.
 */
export interface ValidationState {
    clientPassed: boolean;
    serverRequired: boolean; // Tells the Orchestration Pipeline if an authoritative check is mandatory
}

/**
 * The Universal Submission Envelope
 * 
 * This is the deterministic payload contract. It guarantees that regardless of where
 * Helix runs (WordPress, static HTML, Vue), the exact same network structure is
 * dispatched for event execution, workflow pipelines, and persistence.
 */
export interface SubmissionEnvelope<T = Record<string, any>> {
    schemaId: string;
    schemaHash: string;      // Canonical ID. Binds this submission cryptographically to the exact CompiledGraph version
    submissionId: string;    // Globally unique idempotency key / Nonce
    timestamp: number;       // High-resolution commit timestamp

    data: T;                 // The finalized, deterministic state output from the ReactiveStore

    meta: HostMetadata;
    validation: ValidationState;
    integrity: { algorithm: string; value: string }; // Cryptographic hash of (data + schemaHash)
}
