# @helix/react-sdk

React bindings for Helix declarative reactive form runtime.

## Installation

```bash
npm install @helix/react-sdk
```

## Features

- **Zero UI opinions**: `useHelixForm` hook returns state, not JSX
- **SSR compatible**: Pre-fetch schemas at build time
- **Deterministic**: Same `SubmissionEnvelope` contract across all platforms
- **Type-safe**: Full TypeScript support
- **Accessible**: Auto-wired ARIA attributes
- **Workflow integration**: Event bus for external orchestration

## Quick Start

### Basic Usage (Component)

```tsx
import { HelixForm } from '@helix/react-sdk';

function InvoiceForm() {
  return (
    <HelixForm
      schemaId="invoice-v2"
      version={3}
      endpoint="https://api.example.com"
      onWorkflowEvent={(event) => {
        if (event.type === 'SUBMISSION_ACCEPTED') {
          alert('Invoice submitted!');
        }
      }}
    />
  );
}
```

### Headless Hook (Custom UI)

```tsx
import { useHelixForm } from '@helix/react-sdk';

function CustomInvoiceForm() {
  const {
    fields,
    isValid,
    submit,
    setValue,
    getFieldProps,
    isSubmitting,
  } = useHelixForm({
    schemaId: 'invoice-v2',
    version: 3,
    endpoint: 'https://api.example.com',
  });

  return (
    <div className="custom-form">
      {fields.email?.visible && (
        <input
          {...getFieldProps('email')}
          className="email-input"
        />
      )}
      
      {fields.amount?.visible && (
        <input
          type="number"
          value={fields.amount.value as number}
          onChange={(e) => setValue('amount', parseFloat(e.target.value))}
        />
      )}
      
      <button onClick={submit} disabled={!isValid || isSubmitting}>
        Pay ${fields.amount?.value || 0}
      </button>
    </div>
  );
}
```

### Pre-fetched Schema (SSR/Static)

Perfect for Next.js, Remix, or other SSR frameworks to avoid client-side schema fetching:

```tsx
// Next.js: fetch schema at build time or server-side
import { HelixForm } from '@helix/react-sdk';

export async function getStaticProps() {
  const res = await fetch('https://api.example.com/api/v1/schemas/invoice-v2?version=3');
  const { data } = await res.json();
  return { props: { compiledGraph: data } };
}

export default function Page({ compiledGraph }) {
  return (
    <HelixForm
      schemaId="invoice-v2"
      version={3}
      endpoint="https://api.example.com"
      compiledGraph={compiledGraph} // No client-side fetch!
    />
  );
}
```

### Custom Field Rendering

```tsx
<HelixForm
  schemaId="contact-form"
  version={1}
  endpoint="https://api.example.com"
  renderField={({ name, fieldState, inputProps }) => {
    if (name === 'message') {
      return (
        <div>
          <label>{name}</label>
          <textarea {...inputProps} rows={5} />
          {fieldState.errors.map((err, i) => (
            <span key={i} className="error">{err}</span>
          ))}
        </div>
      );
    }
    
    return (
      <div>
        <label>{name}</label>
        <input {...inputProps} />
      </div>
    );
  }}
  renderSubmit={({ isSubmitting, isValid, onClick }) => (
    <button onClick={onClick} disabled={isSubmitting || !isValid}>
      {isSubmitting ? 'Sending...' : 'Send Message'}
    </button>
  )}
/>
```

### Workflow Event Integration

```tsx
import { useHelixForm } from '@helix/react-sdk';

function OrderForm() {
  const { submit, fields } = useHelixForm({
    schemaId: 'order-form',
    version: 2,
    endpoint: 'https://api.example.com',
    onWorkflowEvent: (event) => {
      switch (event.type) {
        case 'SUBMISSION_ACCEPTED':
          // Track analytics
          gtag('event', 'form_submit', { form_id: 'order-form' });
          break;
          
        case 'PAYMENT_REQUIRED':
          // Redirect to payment gateway
          window.location.href = event.payload.checkout_url;
          break;
          
        case 'VALIDATION_FAILED':
          // Show toast notification
          toast.error('Please fix form errors');
          break;
      }
    },
  });

  // ... rest of component
}
```

### Multi-Endpoint Dispatch

Send submissions to multiple backends simultaneously:

```tsx
import { useHelixForm } from '@helix/react-sdk';

function SyncedForm() {
  const { submit } = useHelixForm({
    schemaId: 'lead-capture',
    version: 1,
    endpoint: 'https://api.example.com',
    pipelineConfig: {
      endpoints: [
        {
          id: 'crm',
          url: 'https://crm.example.com/leads',
          method: 'POST',
          timeout: 5000,
          retries: 2,
          retryDelay: 1000,
        },
        {
          id: 'analytics',
          url: 'https://analytics.example.com/events',
          method: 'POST',
          timeout: 3000,
          retries: 0,
          retryDelay: 0,
        },
      ],
    },
  });

  // ... rest of component
}
```

## API Reference

### `useHelixForm(config)`

#### Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `schemaId` | `string` | Yes | Schema identifier (maps to PHP OPcache) |
| `version` | `number` | Yes | Schema version |
| `endpoint` | `string` | Yes | Laravel API base URL |
| `compiledGraph` | `CompiledGraph` | No | Pre-fetched schema (SSR) |
| `defaultValues` | `Record<string, unknown>` | No | Initial field values |
| `platform` | `string` | No | Platform identifier (default: 'react-sdk') |
| `locale` | `string` | No | Locale code (default: 'en') |
| `onWorkflowEvent` | `(event: WorkflowEvent) => void` | No | Event callback |

#### Return Value

| Property | Type | Description |
|----------|------|-------------|
| `fields` | `Record<string, FieldFieldState>` | Reactive field states |
| `isValid` | `boolean` | Form-level validity |
| `isDirty` | `boolean` | Whether form has been modified |
| `isSubmitting` | `boolean` | Whether submission in progress |
| `isLoading` | `boolean` | Whether schema is loading |
| `error` | `Error \| null` | Error state |
| `submit` | `() => Promise<void>` | Submit handler |
| `setValue` | `(name: string, value: unknown) => void` | Set field value |
| `getFieldProps` | `(name: string) => FieldInputProps` | Get input props |
| `lastEnvelope` | `SubmissionEnvelope \| null` | Last submission payload |
| `lastEvent` | `WorkflowEvent \| null` | Last workflow event |

### `HelixForm` Component

Accepts all `useHelixForm` config props plus:

| Property | Type | Description |
|----------|------|-------------|
| `renderField` | `(props) => ReactNode` | Custom field renderer |
| `renderSubmit` | `(props) => ReactNode` | Custom submit button |
| `renderLoading` | `() => ReactNode` | Loading state |
| `renderError` | `(error: Error) => ReactNode` | Error state |

## Type Definitions

### `FieldFieldState`

```typescript
interface FieldFieldState {
  value: unknown;
  visible: boolean;
  disabled: boolean;
  required: boolean;
  readonly: boolean;
  errors: string[];
  isValid: boolean;
  isDirty: boolean;
  isTouched: boolean;
}
```

### `FieldInputProps`

```typescript
interface FieldInputProps {
  name: string;
  value: string;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled: boolean;
  required: boolean;
  readOnly: boolean;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}
```

## Advanced Patterns

### Conditional Multi-Step Forms

```tsx
function MultiStepForm() {
  const { fields, setValue } = useHelixForm({
    schemaId: 'onboarding',
    version: 1,
    endpoint: 'https://api.example.com',
  });

  const currentStep = useMemo(() => {
    if (!fields.email?.isValid) return 1;
    if (!fields.company?.isValid) return 2;
    return 3;
  }, [fields]);

  return (
    <div>
      {currentStep === 1 && <EmailStep {...fields.email} />}
      {currentStep === 2 && <CompanyStep {...fields.company} />}
      {currentStep === 3 && <ConfirmStep />}
    </div>
  );
}
```

### Form State Persistence

```tsx
function PersistedForm() {
  const [savedValues, setSavedValues] = useLocalStorage('form-draft', {});

  const { fields, setValue } = useHelixForm({
    schemaId: 'application',
    version: 1,
    endpoint: 'https://api.example.com',
    defaultValues: savedValues,
  });

  useEffect(() => {
    const values = Object.entries(fields).reduce((acc, [name, field]) => {
      acc[name] = field.value;
      return acc;
    }, {} as Record<string, unknown>);
    
    setSavedValues(values);
  }, [fields]);

  // ... rest of component
}
```

## License

MIT
