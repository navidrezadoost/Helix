/**
 * Complete React SDK Usage Examples
 * ==================================
 * These examples demonstrate the full range of integration patterns
 * available with @helix/react-sdk.
 */

import React from 'react';
import { useHelixForm, HelixForm } from '../index';
import type { FieldFieldState } from '../hooks/useHelixForm';
import type { WorkflowEvent } from '../protocol/WorkflowEvent';

// ============================================================================
// Example 1: Basic Drop-in Component
// ============================================================================

export function BasicInvoiceForm() {
  return (
    <HelixForm
      schemaId="invoice-v2"
      version={3}
      endpoint="https://api.example.com"
      onWorkflowEvent={(event: WorkflowEvent) => {
        console.log('Workflow event:', event);
      }}
    />
  );
}

// ============================================================================
// Example 2: Headless Hook with Custom UI
// ============================================================================

export function CustomContactForm() {
  const {
    fields,
    isValid,
    isSubmitting,
    submit,
    setValue,
    error,
  } = useHelixForm({
    schemaId: 'contact-form',
    version: 1,
    endpoint: 'https://api.example.com',
    defaultValues: {
      country: 'US',
    },
  });

  return (
    <div className="custom-form">
      <h2>Contact Us</h2>

      {/* Email field */}
      {fields.email?.visible && (
        <div className="field">
          <label>Email {fields.email.required && '*'}</label>
          <input
            type="email"
            value={fields.email.value as string}
            onChange={(e) => setValue('email', e.target.value)}
            aria-invalid={!fields.email.isValid}
          />
          {fields.email.errors.map((err: string, i: number) => (
            <span key={i} className="error">{err}</span>
          ))}
        </div>
      )}

      {/* Message field */}
      {fields.message?.visible && (
        <div className="field">
          <label>Message {fields.message.required && '*'}</label>
          <textarea
            value={fields.message.value as string}
            onChange={(e) => setValue('message', e.target.value)}
            rows={5}
          />
        </div>
      )}

      {/* Conditional field (only visible if certain conditions met) */}
      {fields.company?.visible && (
        <div className="field">
          <label>Company</label>
          <input
            type="text"
            value={fields.company.value as string}
            onChange={(e) => setValue('company', e.target.value)}
          />
        </div>
      )}

      {error && <div className="form-error">{error.message}</div>}

      <button
        onClick={submit}
        disabled={!isValid || isSubmitting}
        className="submit-btn"
      >
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </div>
  );
}

// ============================================================================
// Example 3: SSR / Static Generation (Next.js)
// ============================================================================

interface PageProps {
  compiledGraph: any;
}

export async function getStaticProps() {
  // Fetch schema at build time (no client-side fetch!)
  const res = await fetch(
    'https://api.example.com/api/v1/schemas/invoice-v2?version=3'
  );
  const { data } = await res.json();

  return {
    props: { compiledGraph: data },
    revalidate: 3600, // Revalidate every hour
  };
}

export default function InvoicePageSSR({ compiledGraph }: PageProps) {
  return (
    <main>
      <h1>Create Invoice</h1>
      <HelixForm
        schemaId="invoice-v2"
        version={3}
        endpoint="https://api.example.com"
        compiledGraph={compiledGraph} // Pre-fetched, zero client latency
        onWorkflowEvent={handleWorkflowEvent}
      />
    </main>
  );
}

function handleWorkflowEvent(event: WorkflowEvent) {
  if (event.type === 'SUBMISSION_ACCEPTED') {
    window.location.href = '/success';
  }
}

// ============================================================================
// Example 4: Custom Field Rendering with Advanced Inputs
// ============================================================================

export function AdvancedProductForm() {
  return (
    <HelixForm
      schemaId="product-order"
      version={2}
      endpoint="https://api.example.com"
      renderField={({ name, fieldState, inputProps }: {
        name: string;
        fieldState: FieldFieldState;
        inputProps: ReturnType<typeof useHelixForm>['getFieldProps'] extends (fieldName: string) => infer TResult ? TResult : never;
      }) => {
        // Custom rendering for specific field types
        if (name === 'product_category') {
          return (
            <div className="field">
              <label>{name}</label>
              <select
                value={inputProps.value}
                onChange={(e) => inputProps.onChange(e.target.value)}
              >
                <option value="">Select category...</option>
                <option value="electronics">Electronics</option>
                <option value="clothing">Clothing</option>
                <option value="books">Books</option>
              </select>
            </div>
          );
        }

        if (name === 'quantity') {
          return (
            <div className="field">
              <label>{name}</label>
              <input
                type="number"
                min="1"
                max="100"
                {...inputProps}
              />
            </div>
          );
        }

        if (name === 'delivery_date') {
          return (
            <div className="field">
              <label>{name}</label>
              <input
                type="date"
                {...inputProps}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          );
        }

        // Default rendering for other fields
        return (
          <div className="field">
            <label>{name}</label>
            <input {...inputProps} />
          </div>
        );
      }}
      renderSubmit={({ isSubmitting, isValid, onClick }: {
        isSubmitting: boolean;
        isValid: boolean;
        onClick: () => void;
      }) => (
        <button
          type="button"
          onClick={onClick}
          disabled={!isValid || isSubmitting}
          className="btn-primary"
        >
          {isSubmitting ? (
            <>
              <Spinner /> Processing...
            </>
          ) : (
            'Place Order'
          )}
        </button>
      )}
    />
  );
}

function Spinner() {
  return <span className="spinner">⏳</span>;
}

// ============================================================================
// Example 5: Multi-Endpoint Orchestration (CRM + Analytics)
// ============================================================================

export function LeadCaptureForm() {
  const { submit, lastEvent } = useHelixForm({
    schemaId: 'lead-capture',
    version: 1,
    endpoint: 'https://api.example.com',
    onWorkflowEvent: (event: WorkflowEvent) => {
      // Track all events in analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'helix_workflow', {
          event_type: event.type,
          form_id: 'lead-capture',
        });
      }
    },
  });

  React.useEffect(() => {
    if (lastEvent?.type === 'SUBMISSION_ACCEPTED') {
      // Show success message / redirect
      alert('Thank you! We will contact you soon.');
    }
  }, [lastEvent]);

  // Component UI...
  return null;
}

// ============================================================================
// Example 6: Workflow Event Routing (Payment, Approval, Notifications)
// ============================================================================

export function WorkflowAwareForm() {
  const { fields, submit } = useHelixForm({
    schemaId: 'order-workflow',
    version: 1,
    endpoint: 'https://api.example.com',
    onWorkflowEvent: (event: WorkflowEvent) => {
      switch (event.type) {
        case 'PAYMENT_REQUIRED':
          // Redirect to payment gateway
          const checkoutUrl = event.payload.checkout_url;
          window.location.href = checkoutUrl;
          break;

        case 'APPROVAL_PENDING':
          // Show pending state UI
          showNotification('Your order requires manager approval');
          break;

        case 'VALIDATION_FAILED':
          // Highlight errors
          showNotification('Please fix validation errors', 'error');
          break;

        case 'SUBMISSION_ACCEPTED':
          // Success flow
          showNotification('Order submitted successfully!', 'success');
          setTimeout(() => {
            window.location.href = '/orders';
          }, 2000);
          break;
      }
    },
  });

  return <div>{/* Form UI */}</div>;
}

function showNotification(message: string, type: string = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// ============================================================================
// Example 7: Form State Persistence (Draft Saving)
// ============================================================================

export function PersistentApplicationForm() {
  const [savedDraft, setSavedDraft] = React.useState<Record<string, unknown>>(
    () => {
      // Load from localStorage on mount
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('application-draft');
        return stored ? JSON.parse(stored) : {};
      }
      return {};
    }
  );

  const { fields, setValue } = useHelixForm({
    schemaId: 'job-application',
    version: 1,
    endpoint: 'https://api.example.com',
    defaultValues: savedDraft,
  });

  // Auto-save draft every 2 seconds
  React.useEffect(() => {
    const timer = setInterval(() => {
      const draft = Object.entries(fields).reduce((acc, [name, field]) => {
        acc[name] = field.value;
        return acc;
      }, {} as Record<string, unknown>);

      localStorage.setItem('application-draft', JSON.stringify(draft));
    }, 2000);

    return () => clearInterval(timer);
  }, [fields]);

  return <div>{/* Form UI */}</div>;
}

// ============================================================================
// Example 8: Conditional Multi-Step Wizard
// ============================================================================

export function MultiStepOnboardingForm() {
  const { fields } = useHelixForm({
    schemaId: 'onboarding',
    version: 1,
    endpoint: 'https://api.example.com',
  });

  // Derive current step from field visibility/validity
  const currentStep = React.useMemo(() => {
    if (!fields.email?.isValid) return 1;
    if (!fields.password?.isValid) return 2;
    if (!fields.company_name?.isValid) return 3;
    return 4; // Final confirmation
  }, [fields]);

  return (
    <div className="wizard">
      <div className="progress-bar">
        Step {currentStep} of 4
      </div>

      {currentStep === 1 && <EmailStep field={fields.email} />}
      {currentStep === 2 && <PasswordStep field={fields.password} />}
      {currentStep === 3 && <CompanyStep field={fields.company_name} />}
      {currentStep === 4 && <ConfirmationStep />}
    </div>
  );
}

function EmailStep({ field }: any) {
  return <div>{/* Email input */}</div>;
}
function PasswordStep({ field }: any) {
  return <div>{/* Password input */}</div>;
}
function CompanyStep({ field }: any) {
  return <div>{/* Company input */}</div>;
}
function ConfirmationStep() {
  return <div>{/* Review & submit */}</div>;
}
