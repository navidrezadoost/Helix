import React from 'react';
import { useAsyncField } from '../hooks/useAsyncField';
import type { FieldState } from '@helix/core';

export interface AsyncSelectProps {
  fieldId: string;
  fieldState: FieldState;
  onChange: (value: string) => void;
  placeholder?: string;
  loadingComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  showCacheWhileLoading?: boolean;
  prefetchOnFocus?: boolean;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

export const AsyncSelect = ({
  fieldId,
  fieldState,
  onChange,
  placeholder = 'Select an option...',
  loadingComponent,
  errorComponent,
  showCacheWhileLoading = true,
  prefetchOnFocus = true,
  className = '',
  disabled = false,
  required = false,
}: AsyncSelectProps) => {
  const { isLoading, error, retry, showRetry, hasCache } = useAsyncField({
    fieldId,
    autoRetryMs: 30000,
  });
  
  const { value, options = [] } = fieldState;
  
  const displayOptions = showCacheWhileLoading && isLoading && hasCache
    ? (fieldState.asyncState?.lastOptions || options)
    : options;
  
  const showLoading = isLoading && (!showCacheWhileLoading || !hasCache);
  const showError = showRetry && (!showCacheWhileLoading || !hasCache);
  
  const handleFocus = React.useCallback(() => {
    if (prefetchOnFocus && !isLoading && !hasCache && !error) {
      const currentValue = value;
      if (currentValue) {
        // Handled by store
      }
    }
  }, [prefetchOnFocus, isLoading, hasCache, error, value]);
  
  if (showLoading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>;
    }
    return (
      <div className={`helix-async-loading ${className}`}>
        <span className="helix-spinner"></span>
        <span className="helix-loading-text">Loading options...</span>
      </div>
    );
  }
  
  if (showError) {
    if (errorComponent) {
      return <>{errorComponent}</>;
    }
    return (
      <div className={`helix-async-error ${className}`}>
        <span className="helix-error-icon">⚠️</span>
        <span className="helix-error-text">{error}</span>
        <button
          type="button"
          className="helix-retry-button"
          onClick={retry}
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <select
      id={fieldId}
      name={fieldId}
      value={value ?? ''}
      onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
      onFocus={handleFocus}
      disabled={disabled}
      required={required}
      className={`helix-select ${className}`}
      aria-busy={isLoading}
      aria-invalid={!!error}
    >
      <option value="">{placeholder}</option>
      {displayOptions.map((opt: { value: string; label: string }) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
