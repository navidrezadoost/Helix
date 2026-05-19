/**
 * HelixForm.tsx
 * -------------
 * Drop-in React component that wraps useHelixForm.
 * Provides opinionated UI structure while leaving styling to the consumer.
 */

import React from 'react';
import { useHelixForm } from '../hooks/useHelixForm';
import type { FieldFieldState, FieldInputProps, UseHelixFormConfig } from '../hooks/useHelixForm';

interface HelixFormProps extends UseHelixFormConfig {
  /** Render prop for custom field rendering */
  renderField?: (props: {
    name: string;
    fieldState: FieldFieldState;
    inputProps: FieldInputProps;
  }) => React.ReactNode;
  
  /** Render prop for submit button */
  renderSubmit?: (props: {
    isSubmitting: boolean;
    isValid: boolean;
    onClick: () => void;
  }) => React.ReactNode;
  
  /** Loading state renderer */
  renderLoading?: () => React.ReactNode;
  
  /** Error state renderer */
  renderError?: (error: Error) => React.ReactNode;
}

export const HelixForm: React.FC<HelixFormProps> = ({
  renderField,
  renderSubmit,
  renderLoading,
  renderError,
  ...config
}) => {
  const {
    fields,
    isValid,
    isDirty,
    isSubmitting,
    isLoading,
    error,
    submit,
    getFieldProps,
  } = useHelixForm(config);

  if (isLoading) {
    return <>{renderLoading ? renderLoading() : <div>Loading form...</div>}</>;
  }

  if (error) {
    return <>{renderError ? renderError(error) : <div>Error: {error.message}</div>}</>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate // Let Helix handle validation
    >
      {Object.entries(fields).map(([name, fieldState]) => {
        if (!fieldState.visible) return null;

        const inputProps = getFieldProps(name);

        if (renderField) {
          return (
            <div key={name} className="helix-field-wrapper">
              {renderField({ name, fieldState, inputProps })}
            </div>
          );
        }

        // Default rendering
        return (
          <div key={name} className="helix-field-wrapper">
            <label htmlFor={name}>
              {name}
              {fieldState.required && <span className="required">*</span>}
            </label>
            
            <input
              {...inputProps}
              id={name}
              type="text"
              className={!fieldState.isValid ? 'invalid' : ''}
            />
            
            {fieldState.errors.length > 0 && (
              <div id={`${name}-errors`} className="error-messages" role="alert">
                {fieldState.errors.map((err, i) => (
                  <span key={i}>{err}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {renderSubmit ? (
        renderSubmit({ isSubmitting, isValid, onClick: submit })
      ) : (
        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="helix-submit"
        >
          {isSubmitting ? 'Submitting...' : isDirty ? 'Submit' : 'Fill form to submit'}
        </button>
      )}
    </form>
  );
};
