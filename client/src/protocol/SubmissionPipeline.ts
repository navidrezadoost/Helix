import { SubmissionEnvelope } from './SubmissionEnvelope';
import { WorkflowEvent, WorkflowEventType } from './WorkflowEvent';

type PipelineStage = 
  | 'VALIDATE'
  | 'TRANSFORM'
  | 'SIGN'
  | 'DISPATCH'
  | 'RETRY'
  | 'EMIT';

interface PipelineConfig {
  stages: PipelineStage[];
  endpoints: Array<{
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH';
    headers?: Record<string, string>;
    condition?: string; // Expression: when to send to this endpoint
    timeout: number;
    retries: number;
    retryDelay: number;
  }>;
  eventBus: EventBusPort;
  cryptoProvider: CryptoProvider;
}

interface EventBusPort {
  publish(event: WorkflowEvent): void;
  // subscribe(type: WorkflowEventType, handler: (event: WorkflowEvent) => void): () => void;
}

interface CryptoProvider {
  sign(payload: string, keyId: string): Promise<string>;
  hash(payload: string): Promise<string>;
}

export class SubmissionPipeline {
  private activeSubmissions = new Map<string, AbortController>();

  constructor(private config: PipelineConfig) {}

  /**
   * Execute the full pipeline for a single submission.
   * This is the entry point called after StoreToEnvelopeAdapter.extract().
   */
  async execute(envelope: SubmissionEnvelope): Promise<WorkflowEvent> {
    const traceId = envelope.submissionId;

    // Stage 1: VALIDATE (server authority gate)
    const validationEvent = await this.runValidationStage(envelope, traceId);
    if (validationEvent.type === WorkflowEventType.VALIDATION_FAILED) {
      return validationEvent;
    }

    // Stage 2: TRANSFORM (endpoint-specific payload shaping)
    const transformed = await this.runTransformStage(envelope, traceId);

    // Stage 3: SIGN (cryptographic non-repudiation)
    const signed = await this.runSignStage(transformed, traceId);

    // Stage 4: DISPATCH (multi-endpoint orchestration)
    const dispatchEvents = await this.runDispatchStage(signed, traceId);

    // Stage 5: EMIT (workflow continuation)
    const completionEvent = this.emitCompletion(signed, dispatchEvents, traceId);

    return completionEvent;
  }

  /**
   * Abort an in-flight submission (user navigated away, timeout, etc.)
   */
  abort(submissionId: string): void {
    const controller = this.activeSubmissions.get(submissionId);
    if (controller) {
      controller.abort();
      this.activeSubmissions.delete(submissionId);
    }
  }

  // --- Stage Implementations ---

  private async runValidationStage(
    envelope: SubmissionEnvelope,
    traceId: string
  ): Promise<WorkflowEvent> {
    
    // For now: assume server validation is required and will be checked at dispatch time
    if (!envelope.validation.clientPassed) {
      return {
        eventId: traceId + '_val_fail',
        type: WorkflowEventType.VALIDATION_FAILED,
        timestamp: Date.now(),
        submissionId: traceId,
        payload: {
          envelope_id: traceId,
          reason: 'CLIENT_VALIDATION_FAILED',
        }
      };
    }

    return {
      eventId: traceId + '_val_pass',
      type: WorkflowEventType.VALIDATION_PASSED,
      timestamp: Date.now(),
      submissionId: traceId,
      payload: { envelope_id: traceId, schema_id: envelope.schemaId }
    };
  }

  private async runTransformStage(
    envelope: SubmissionEnvelope,
    traceId: string
  ): Promise<SubmissionEnvelope> {
    // Clone to avoid mutating original
    const transformed: SubmissionEnvelope = JSON.parse(JSON.stringify(envelope));

    // Abstract stub for endpoint specific field filtering...
    return transformed;
  }

  private async runSignStage(
    envelope: SubmissionEnvelope,
    traceId: string
  ): Promise<SubmissionEnvelope> {
    const canonical = JSON.stringify(envelope.data, Object.keys(envelope.data).sort());
    const hash = await this.config.cryptoProvider.hash(canonical + envelope.schemaHash);
    
    (envelope as any).integrity = {
      algorithm: 'sha256',
      value: hash,
    };

    return envelope;
  }

  private async runDispatchStage(
    envelope: SubmissionEnvelope,
    traceId: string
  ): Promise<WorkflowEvent[]> {
    const events: WorkflowEvent[] = [];
    const controller = new AbortController();
    this.activeSubmissions.set(traceId, controller);

    // Parallel dispatch to all configured endpoints
    const dispatches = this.config.endpoints.map(async (endpoint) => {

      for (let attempt = 0; attempt <= endpoint.retries; attempt++) {
        try {
          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers: {
              'Content-Type': 'application/json',
              'X-Helix-Submission-Id': traceId,
              'X-Helix-Schema-Hash': envelope.schemaHash,
              ...endpoint.headers,
            },
            body: JSON.stringify(envelope),
            signal: controller.signal,
          });

          if (response.ok) {
            events.push({
              eventId: traceId + '_ok_' + endpoint.id,
              type: WorkflowEventType.SUBMISSION_ACCEPTED,
              timestamp: Date.now(),
              submissionId: traceId,
              payload: {
                endpoint_id: endpoint.id,
                status: response.status,
                attempt: attempt + 1,
              }
            });
            return;
          }

          if (attempt < endpoint.retries) {
            await this.delay(endpoint.retryDelay * Math.pow(2, attempt));
          }
        } catch (err) {
          if (attempt < endpoint.retries) {
            await this.delay(endpoint.retryDelay * Math.pow(2, attempt));
          } else {
            events.push({
              eventId: traceId + '_fail_' + endpoint.id,
              type: WorkflowEventType.SUBMISSION_REJECTED,
              timestamp: Date.now(),
              submissionId: traceId,
              payload: {
                endpoint_id: endpoint.id,
                error: err instanceof Error ? err.message : 'Unknown error',
                attempts: attempt + 1,
              }
            });
          }
        }
      }
    });

    await Promise.all(dispatches);
    this.activeSubmissions.delete(traceId);

    return events;
  }

  private emitCompletion(
    envelope: SubmissionEnvelope,
    dispatchEvents: WorkflowEvent[],
    traceId: string
  ): WorkflowEvent {
    const allSucceeded = dispatchEvents.every(e => e.type === WorkflowEventType.SUBMISSION_ACCEPTED);
    const anyFailed = dispatchEvents.some(e => e.type === WorkflowEventType.SUBMISSION_REJECTED);

    const type: WorkflowEventType = allSucceeded
      ? WorkflowEventType.SUBMISSION_ACCEPTED
      : anyFailed
      ? WorkflowEventType.SUBMISSION_REJECTED // Or PARTIALLY_ACCEPTED
      : WorkflowEventType.SUBMISSION_REJECTED;

    const event: WorkflowEvent = {
      eventId: traceId + '_completion',
      type,
      timestamp: Date.now(),
      submissionId: traceId,
      payload: {
        envelope_id: traceId,
        schema_id: envelope.schemaId,
        schema_hash: envelope.schemaHash,
        dispatch_results: dispatchEvents.map(e => ({
          endpoint: e.payload.endpoint_id,
          status: e.type === WorkflowEventType.SUBMISSION_ACCEPTED ? 'ok' : 'failed',
        })),
      }
    };

    this.config.eventBus.publish(event);
    return event;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
