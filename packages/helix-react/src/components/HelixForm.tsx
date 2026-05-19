import React from 'react';
import { useHelixForm, type UseHelixFormOptions } from '../hooks/useHelixForm';
import { HelixField } from './HelixField';
import { HelixProvider } from '../context/HelixProvider';

export const HelixForm = (options: UseHelixFormOptions) => {
  const form = useHelixForm(options);

  return (
    <HelixProvider store={form.store}>
      <form
        onSubmit={(event: any) => {
          event.preventDefault();
          void form.submit();
        }}
      >
        {Object.entries(form.fields).map(([nodeId, state]: [string, any]) => (
          <HelixField
            key={nodeId}
            nodeId={nodeId}
            state={state}
            onChange={(value) => form.change(nodeId, value)}
          />
        ))}
        <button type="submit" disabled={form.isSubmitting || !form.isValid}>
          {form.isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </form>
    </HelixProvider>
  );
};