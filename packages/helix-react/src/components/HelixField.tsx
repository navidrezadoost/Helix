import React from 'react';
import { AsyncSelect } from './AsyncSelect';
import type { FieldState } from '@helix/core';

interface HelixFieldProps {
  nodeId: string;
  state: FieldState;
  onChange: (value: any) => void;
}

export const HelixField: React.FC<HelixFieldProps> = ({ nodeId, state, onChange }) => {
  const { value, visible, required, disabled, errors, options, type, asyncState } = state;
  
  if (!visible) return null;
  
  const hasError = errors.length > 0;
  const isAsyncSelect = type === 'select' && asyncState !== undefined;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let newValue: any = e.target.value;
    if (type === 'number') newValue = parseFloat(newValue);
    if (type === 'boolean') newValue = (e.target as HTMLInputElement).checked;
    onChange(newValue);
  };
  
  if (isAsyncSelect) {
    return (
      <div className={`helix-field helix-field-async ${hasError ? 'has-error' : ''}`}>
        <label htmlFor={nodeId}>
          {nodeId}
          {required && <span className="helix-required">*</span>}
        </label>
        
        <AsyncSelect
          fieldId={nodeId}
          fieldState={state}
          onChange={onChange}
          disabled={disabled}
          required={required}
          prefetchOnFocus={true}
          showCacheWhileLoading={true}
        />
        
        {hasError && (
          <div className="helix-errors">
            {errors.map((err: string, idx: number) => (
              <span key={idx} className="helix-error">{err}</span>
            ))}
          </div>
        )}
        
        {asyncState?.lastFetchedAt && (
          <div className="helix-field-meta">
            Last updated: {new Date(asyncState.lastFetchedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  }
  
  if (type === 'select' && options) {
    return (
      <div className={`helix-field ${hasError ? 'has-error' : ''}`}>
        <label htmlFor={nodeId}>
          {nodeId}
          {required && <span className="helix-required">*</span>}
        </label>
        
        <select
          id={nodeId}
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
        >
          <option value="">Select...</option>
          {options.map((opt: { value: string; label: string }) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        
        {hasError && (
          <div className="helix-errors">
            {errors.map((err: string, idx: number) => (
              <span key={idx} className="helix-error">{err}</span>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`helix-field ${hasError ? 'has-error' : ''}`}>
      <label htmlFor={nodeId}>
        {nodeId}
        {required && <span className="helix-required">*</span>}
      </label>
      
      <input
        id={nodeId}
        type={type === 'number' ? 'number' : 'text'}
        value={value ?? ''}
        onChange={handleChange}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
      />
      
      {hasError && (
        <div className="helix-errors">
          {errors.map((err: string, idx: number) => (
            <span key={idx} className="helix-error">{err}</span>
          ))}
        </div>
      )}
    </div>
  );
};
