# React SDK Integration

## Installation

```bash
npm install @helix/react @helix/core
```

## Basic Usage

```tsx
import { HelixForm, HelixProvider } from '@helix/react';

function App() {
  return (
    <HelixProvider>
      <HelixForm
        schemaId="customer-onboarding"
        version={1}
        endpoint="https://api.helix.com"
        onSuccess={(result) => console.log('Submitted!', result)}
        onError={(error) => console.error('Error:', error)}
      />
    </HelixProvider>
  );
}
```

## Shopify Admin Integration

```tsx
import { Provider as AppBridgeProvider } from '@shopify/app-bridge-react';
import { HelixForm } from '@helix/react';

function ShopifyApp() {
  const appBridgeConfig = {
    apiKey: process.env.SHOPIFY_API_KEY,
    host: new URLSearchParams(location.search).get('host'),
  };

  return (
    <AppBridgeProvider config={appBridgeConfig}>
      <HelixForm
        schemaId="product-configurator"
        endpoint="https://api.helix.com"
        shopifyAuth={true}  // Auto-injects JWT
        onSuccess={() => window.toast.show('Saved!')}
      />
    </AppBridgeProvider>
  );
}
```

## useHelixForm Hook (Advanced)

```tsx
import { useHelixForm } from '@helix/react';

function CustomForm() {
  const { fields, change, submit, isSubmitting, isValid } = useHelixForm({
    schemaId: 'custom-form',
    endpoint: 'https://api.helix.com',
  });

  return (
    <form onSubmit={submit}>
      {Object.entries(fields).map(([id, state]) => (
        <input
          key={id}
          value={state.value ?? ''}
          onChange={(e) => change(id, e.target.value)}
          required={state.required}
          disabled={!state.visible}
        />
      ))}
      <button type="submit" disabled={!isValid || isSubmitting}>
        Submit
      </button>
    </form>
  );
}
```

## Async Field Handling

```tsx
import { useAsyncField } from '@helix/react';

function AsyncSelectField({ fieldId }) {
  const { isLoading, error, retry, showRetry } = useAsyncField({ fieldId });
  
  if (isLoading) return <Spinner />;
  if (showRetry) return <ErrorView onRetry={retry} error={error} />;
  
  return <select {/* ... */} />;
}
```

## Prefetch Configuration

```tsx
<HelixForm
  schemaId="address-form"
  enablePrefetch={true}
  prefetchConfig={[
    { targetField: 'states', dependsOn: 'country', delay: 150 },
    { targetField: 'cities', dependsOn: 'states', delay: 150 }
  ]}
/>
```
