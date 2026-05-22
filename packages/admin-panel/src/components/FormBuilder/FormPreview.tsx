import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Eye, EyeOff, FileJson, Play, Sparkles, TriangleAlert } from 'lucide-react';
import type { ChoiceCondition, FieldConfig, FieldOption, FormConnection, ResponsiveDevice, Rule } from '../../types/schema';
import '@smilodon/core';
import { useHelixAdmin } from '../../context/HelixAdminProvider';
import {
  DEFAULT_DATE_FORMAT,
  formatDateValue,
  getDateFormatPlaceholder,
  getFieldKey,
  parseIsoDate,
  toIsoDate,
} from '../../lib/formBuilder';
import {
  getValidationError,
  isValueEmpty,
  resolvePreviewState,
  type PreviewState,
} from '../../lib/previewValidation';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface FormPreviewProps {
  fields: FieldConfig[];
  rules: Rule[];
  connections: FormConnection[];
  activeDevice: ResponsiveDevice;
  layout: {
    device: ResponsiveDevice;
    mode: 'flex' | 'grid';
    columns: number;
    gap: number;
    canvasWidth: number;
    viewportOptions: number[];
  };
}

interface FieldFeedback {
  type: 'idle' | 'error' | 'warning' | 'success';
  message?: string;
}

interface ResolvedChoiceOption {
  option: FieldOption;
  resolvedValue: string | number;
  errors: string[];
  warnings: string[];
  successes: string[];
}

interface ResolvedChoiceField {
  resolvedValue: any;
  errors: string[];
  warnings: string[];
  successes: string[];
  options: ResolvedChoiceOption[];
}

const getPreviewFieldLayout = (field: FieldConfig, device: ResponsiveDevice, columns: number) => {
  const responsive = field.ui?.responsive?.[device];

  return {
    width: responsive?.width ?? field.ui?.width ?? 100,
    gridSpan: Math.min(responsive?.gridSpan ?? field.ui?.gridSpan ?? columns, columns),
  };
};

const buildConditionContext = (fields: FieldConfig[], values: Record<string, any>) => {
  const context: Record<string, any> = {
    values,
  };

  fields.forEach((field) => {
    context[field.id] = values[field.id];
    context[getFieldKey(field)] = values[field.id];
  });

  return context;
};

const evaluateCondition = (condition: string, context: Record<string, any>) => {
  if (!condition.trim()) {
    return false;
  }

  try {
    return Boolean(new Function('ctx', `with (ctx) { return (${condition}); }`)(context));
  } catch {
    return false;
  }
};

const evaluateCalculationExpression = (expression: string, context: Record<string, any>) => {
  if (!expression.trim()) {
    return null;
  }

  try {
    return new Function('ctx', `with (ctx) { return (${expression}); }`)(context);
  } catch {
    return null;
  }
};

const resolveChoiceConditionMatch = (
  condition: ChoiceCondition,
  context: Record<string, any>,
) => {
  if (condition.scope !== 'same-form') {
    return false;
  }

  return evaluateCondition(condition.condition || 'false', context);
};

const resolveChoiceConditionState = (
  fields: FieldConfig[],
  values: Record<string, any>,
  field: FieldConfig,
): ResolvedChoiceField => {
  const options = field.options ?? [];
  const baseContext = buildConditionContext(fields, values);
  let resolvedValue = values[field.id];
  const fieldErrors: string[] = [];
  const fieldWarnings: string[] = [];
  const fieldSuccesses: string[] = [];

  (field.choiceConditions ?? []).forEach((condition) => {
    const conditionContext = {
      ...baseContext,
      field,
      selectedValue: resolvedValue,
      selectedValues: Array.isArray(resolvedValue) ? resolvedValue : [resolvedValue].filter((value) => value !== undefined && value !== ''),
    };

    if (!resolveChoiceConditionMatch(condition, conditionContext)) {
      return;
    }

    if (condition.type === 'calculation') {
      const nextValue = evaluateCalculationExpression(condition.calculation?.expression ?? '', conditionContext);
      if (nextValue !== null) {
        resolvedValue = condition.calculation?.outputType === 'number' ? Number(nextValue) : String(nextValue);
      }
      return;
    }

    const message = condition.message?.trim() || `${field.label} triggered a ${condition.type} condition.`;
    if (condition.type === 'validation') {
      fieldErrors.push(message);
      return;
    }

    if (condition.type === 'warning') {
      fieldWarnings.push(message);
      return;
    }

    fieldSuccesses.push(message);
  });

  const resolvedOptions = options.map((option) => {
    let optionResolvedValue: string | number = option.value;
    const optionErrors: string[] = [];
    const optionWarnings: string[] = [];
    const optionSuccesses: string[] = [];

    (option.conditions ?? []).forEach((condition) => {
      const conditionContext = {
        ...baseContext,
        field,
        option,
        optionLabel: option.label,
        optionValue: optionResolvedValue,
        selectedValue: resolvedValue,
        selectedValues: Array.isArray(resolvedValue) ? resolvedValue : [resolvedValue].filter((value) => value !== undefined && value !== ''),
      };

      if (!resolveChoiceConditionMatch(condition, conditionContext)) {
        return;
      }

      if (condition.type === 'calculation') {
        const nextValue = evaluateCalculationExpression(condition.calculation?.expression ?? '', conditionContext);
        if (nextValue !== null) {
          optionResolvedValue = condition.calculation?.outputType === 'number' ? Number(nextValue) : String(nextValue);
        }
        return;
      }

      const fallbackMessage = `${option.label} triggered a ${condition.type} condition.`;
      const message = condition.message?.trim() || fallbackMessage;

      if (condition.type === 'validation') {
        optionErrors.push(message);
        fieldErrors.push(`${option.label}: ${message}`);
        return;
      }

      if (condition.type === 'warning') {
        optionWarnings.push(message);
        fieldWarnings.push(`${option.label}: ${message}`);
        return;
      }

      optionSuccesses.push(message);
    });

    return {
      option,
      resolvedValue: optionResolvedValue,
      errors: optionErrors,
      warnings: optionWarnings,
      successes: optionSuccesses,
    };
  });

  return {
    resolvedValue,
    errors: fieldErrors,
    warnings: fieldWarnings,
    successes: fieldSuccesses,
    options: resolvedOptions,
  };
};

const createSubmissionPayload = (
  fields: FieldConfig[],
  previewState: PreviewState,
  choiceConditionState: Map<string, ResolvedChoiceField>,
) => {
  return fields.reduce<Record<string, any>>((payload, field) => {
    if (!previewState.visible.has(field.id) || field.htmlAttributes?.disabled) {
      return payload;
    }

    const key = getFieldKey(field);
    const value = choiceConditionState.get(field.id)?.resolvedValue ?? previewState.values[field.id];

    if (payload[key] === undefined) {
      payload[key] = value;
      return payload;
    }

    payload[key] = Array.isArray(payload[key])
      ? [...payload[key], value]
      : [payload[key], value];

    return payload;
  }, {});
};

type SmilodonSelectConfig = {
  selection?: {
    mode?: 'single' | 'multi';
    allowDeselect?: boolean;
    closeOnSelect?: boolean;
    maxSelections?: number;
  };
  direction?: 'ltr' | 'rtl';
  searchable?: boolean;
  placeholder?: string;
  clearControl?: {
    enabled?: boolean;
    clearSelection?: boolean;
    clearSearch?: boolean;
    hideWhenEmpty?: boolean;
    ariaLabel?: string;
  };
  multiSelectDisplay?: {
    mode?: 'wrap' | 'vertical' | 'horizontal';
    maxHeight?: string;
    overflowY?: 'auto' | 'scroll' | 'hidden';
  };
  scrollToSelected?: {
    enabled?: boolean;
    multiSelectTarget?: 'first' | 'last';
  };
};

type SmilodonSelectElement = HTMLElement & {
  setItems?: (items: unknown[]) => void;
  setSelectedValues?: (values: unknown[]) => Promise<void>;
  updateConfig?: (config: Partial<SmilodonSelectConfig>) => void;
  setRequired?: (required: boolean) => void;
  setError?: (message: string) => void;
  clearError?: () => void;
  disabled?: boolean;
};

interface SmilodonPreviewSelectProps {
  id: string;
  name: string;
  className: string;
  autoFocus?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  disabled?: boolean;
  placeholder: string;
  isMultiple: boolean;
  value: any;
  options: Array<{ label: string; value: string | number }>;
  required: boolean;
  maxSelections?: number;
  feedback: FieldFeedback;
  onBlur: () => void;
  onValueChange: (nextValue: any) => void;
}

const SmilodonPreviewSelect: FC<SmilodonPreviewSelectProps> = ({
  id,
  name,
  className,
  autoFocus,
  dir,
  disabled,
  placeholder,
  isMultiple,
  value,
  options,
  required,
  maxSelections,
  feedback,
  onBlur,
  onValueChange,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<SmilodonSelectElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const createSelectElement = (): SmilodonSelectElement => {
      const EnhancedSelectCtor = customElements.get('enhanced-select') as (new () => HTMLElement) | undefined;
      if (EnhancedSelectCtor) {
        return new EnhancedSelectCtor() as SmilodonSelectElement;
      }

      return document.createElement('enhanced-select') as SmilodonSelectElement;
    };

    const element = createSelectElement();
    host.innerHTML = '';
    host.appendChild(element);
    selectRef.current = element;

    return () => {
      selectRef.current = null;
      host.innerHTML = '';
    };
  }, []);

  const config = useMemo<Partial<SmilodonSelectConfig>>(() => {
    const searchable = (options.length > 8)
      || isMultiple;

    return {
      selection: {
        mode: isMultiple ? 'multi' : 'single',
        allowDeselect: !required,
        closeOnSelect: !isMultiple,
        maxSelections: isMultiple && maxSelections && maxSelections > 0 ? maxSelections : undefined,
      },
      direction: dir === 'rtl' ? 'rtl' : 'ltr',
      searchable,
      placeholder,
      clearControl: {
        enabled: true,
        clearSelection: true,
        clearSearch: true,
        hideWhenEmpty: true,
        ariaLabel: 'Clear selected values',
      },
      multiSelectDisplay: {
        mode: 'wrap',
        maxHeight: '120px',
        overflowY: 'auto',
      },
      scrollToSelected: {
        enabled: true,
        multiSelectTarget: 'last',
      },
    };
  }, [dir, isMultiple, maxSelections, options.length, placeholder, required]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    selectElement.id = id;
    selectElement.setAttribute('name', name);
    selectElement.className = className;
    selectElement.setAttribute('aria-invalid', String(feedback.type === 'error'));
    selectElement.tabIndex = 0;
  }, [className, feedback.type, id, name]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    const isDark = document.documentElement.classList.contains('dark')
      || document.body.classList.contains('dark');

    selectElement.style.setProperty('--select-bg', 'var(--fb-surface)');
    selectElement.style.setProperty('--select-dropdown-bg', 'var(--fb-surface)');
    selectElement.style.setProperty('--select-text-color', 'var(--fb-text)');
    selectElement.style.setProperty('--select-text-placeholder', 'var(--fb-text-muted)');
    selectElement.style.setProperty('--select-border', 'var(--fb-border)');
    selectElement.style.setProperty('--select-border-focus', 'var(--fb-accent)');
    selectElement.style.setProperty('--select-shadow-focus', isDark ? '0 0 0 3px rgba(245, 245, 245, 0.12)' : '0 0 0 3px rgba(23, 23, 23, 0.06)');

    selectElement.style.setProperty('--select-option-bg', 'var(--fb-surface)');
    selectElement.style.setProperty('--select-option-color', 'var(--fb-text)');
    selectElement.style.setProperty('--select-option-hover-bg', 'var(--fb-surface-hover)');
    selectElement.style.setProperty('--select-option-hover-color', 'var(--fb-text)');

    selectElement.style.setProperty('--select-option-selected-bg', isDark ? 'rgba(245, 245, 245, 0.12)' : 'var(--fb-accent-soft)');
    selectElement.style.setProperty('--select-option-selected-color', 'var(--fb-text)');
    selectElement.style.setProperty('--select-option-selected-indicator-bg', 'var(--fb-accent)');

    selectElement.style.setProperty('--select-badge-bg', isDark ? 'rgba(245, 245, 245, 0.12)' : 'var(--fb-accent-soft)');
    selectElement.style.setProperty('--select-badge-color', 'var(--fb-text)');
    selectElement.style.setProperty('--select-badge-border', isDark ? '1px solid rgba(245, 245, 245, 0.2)' : '1px solid var(--fb-border)');
    selectElement.style.setProperty('--select-badge-remove-bg', isDark ? 'rgba(245, 245, 245, 0.16)' : 'rgba(23, 23, 23, 0.08)');
    selectElement.style.setProperty('--select-badge-remove-color', 'var(--fb-text)');
    selectElement.style.setProperty('--select-badge-remove-hover-bg', 'var(--fb-danger-soft)');
    selectElement.style.setProperty('--select-badge-remove-hover-color', 'var(--fb-danger)');
  }, [feedback.type]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    selectElement.setItems?.(options);
  }, [options]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    selectElement.updateConfig?.(config);
    selectElement.disabled = Boolean(disabled);
    selectElement.setRequired?.(required);
  }, [config, disabled, required]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement?.setSelectedValues) {
      return;
    }

    const nextValues = isMultiple
      ? (Array.isArray(value) ? value : [])
      : (value === undefined || value === null || value === '' ? [] : [value]);

    void selectElement.setSelectedValues(nextValues);
  }, [isMultiple, value]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<{ selectedValues?: unknown[] }>).detail;
      const selectedValues = Array.isArray(detail?.selectedValues) ? detail.selectedValues : [];
      onValueChange(isMultiple ? selectedValues : (selectedValues[0] ?? ''));
    };

    const handleBlur = () => {
      onBlur();
    };

    selectElement.addEventListener('change', handleChange);
    selectElement.addEventListener('blur', handleBlur);
    selectElement.addEventListener('focusout', handleBlur);

    return () => {
      selectElement.removeEventListener('change', handleChange);
      selectElement.removeEventListener('blur', handleBlur);
      selectElement.removeEventListener('focusout', handleBlur);
    };
  }, [isMultiple, onBlur, onValueChange]);

  useEffect(() => {
    const selectElement = selectRef.current;
    if (!selectElement) {
      return;
    }

    if (feedback.type === 'error' && feedback.message) {
      selectElement.setError?.(feedback.message);
      return;
    }

    selectElement.clearError?.();
  }, [feedback.message, feedback.type]);

  useEffect(() => {
    if (!autoFocus) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      selectRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  return <div ref={hostRef} />;
};

export const FormPreview: FC<FormPreviewProps> = ({ fields, rules, connections, activeDevice, layout }) => {
  const { locale } = useHelixAdmin();
  const [formValues, setFormValues] = useState<Record<string, any>>(() => (
    fields.reduce<Record<string, any>>((accumulator, field) => {
      accumulator[field.id] = field.defaultValue
        ?? (field.type === 'checkbox'
          ? ((field.options?.length ?? 0) > 0 ? [] : false)
          : field.type === 'select' && field.selectionMode === 'multiple'
            ? []
            : '');
      return accumulator;
    }, {})
  ));
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submittedPayload, setSubmittedPayload] = useState<Record<string, any> | null>(null);
  const [openDateFieldId, setOpenDateFieldId] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<{ type: 'idle' | 'error' | 'success'; message: string }>({
    type: 'idle',
    message: '',
  });

  const previewState = useMemo(
    () => resolvePreviewState(fields, rules, connections, formValues),
    [connections, fields, formValues, rules],
  );

  const visibleFields = useMemo(
    () => fields.filter((field) => previewState.visible.has(field.id)),
    [fields, previewState.visible],
  );

  const choiceConditionState = useMemo(
    () => fields.reduce<Map<string, ResolvedChoiceField>>((collection, field) => {
      if (field.type === 'checkbox' || field.type === 'radio' || field.type === 'select') {
        collection.set(field.id, resolveChoiceConditionState(fields, previewState.values, field));
      }
      return collection;
    }, new Map<string, ResolvedChoiceField>()),
    [fields, previewState.values],
  );

  const livePayload = useMemo(
    () => createSubmissionPayload(fields, previewState, choiceConditionState),
    [choiceConditionState, fields, previewState],
  );

  const fieldFeedback = useMemo(() => {
    return visibleFields.reduce<Map<string, FieldFeedback>>((feedbackMap, field) => {
      const shouldShowFeedback = submitAttempted || Boolean(touchedFields[field.id]);
      if (!shouldShowFeedback) {
        feedbackMap.set(field.id, { type: 'idle' });
        return feedbackMap;
      }

      const choiceState = choiceConditionState.get(field.id);
      const ruleError = previewState.errors.get(field.id);
      const connectionWarning = previewState.warnings.get(field.id);
      const connectionSuccess = previewState.successes.get(field.id);
      const validationError = getValidationError(
        field,
        choiceState?.resolvedValue ?? previewState.values[field.id],
        previewState.required.has(field.id),
      );
      const finalError = ruleError || choiceState?.errors[0] || validationError;

      if (finalError) {
        feedbackMap.set(field.id, { type: 'error', message: finalError });
        return feedbackMap;
      }

      if (choiceState?.warnings[0] || connectionWarning) {
        feedbackMap.set(field.id, { type: 'warning', message: choiceState?.warnings[0] || connectionWarning });
        return feedbackMap;
      }

      if (choiceState?.successes[0] || connectionSuccess) {
        feedbackMap.set(field.id, { type: 'success', message: choiceState?.successes[0] || connectionSuccess });
        return feedbackMap;
      }

      if (!isValueEmpty(field, previewState.values[field.id]) || previewState.required.has(field.id)) {
        feedbackMap.set(field.id, { type: 'success', message: `${field.label} is valid.` });
        return feedbackMap;
      }

      feedbackMap.set(field.id, { type: 'idle' });
      return feedbackMap;
    }, new Map<string, FieldFeedback>());
  }, [choiceConditionState, previewState.errors, previewState.required, previewState.successes, previewState.values, previewState.warnings, submitAttempted, touchedFields, visibleFields]);

  const validationSummary = useMemo(() => {
    const errors = visibleFields.reduce<Record<string, string>>((collection, field) => {
      const choiceState = choiceConditionState.get(field.id);
      const ruleError = previewState.errors.get(field.id);
      const validationError = getValidationError(
        field,
        choiceState?.resolvedValue ?? previewState.values[field.id],
        previewState.required.has(field.id),
      );
      const finalError = ruleError || choiceState?.errors[0] || validationError;

      if (finalError) {
        collection[field.id] = finalError;
      }

      return collection;
    }, {});

    const successes = visibleFields
      .filter((field) => !errors[field.id])
      .filter((field) => !isValueEmpty(field, previewState.values[field.id]) || previewState.required.has(field.id))
      .map((field) => getFieldKey(field));

    const warnings = visibleFields.reduce<Record<string, string>>((collection, field) => {
      const message = choiceConditionState.get(field.id)?.warnings[0] || previewState.warnings.get(field.id);
      if (message) {
        collection[field.id] = message;
      }
      return collection;
    }, {});

    return {
      errorCount: Object.keys(errors).length,
      successCount: successes.length,
      warningCount: Object.keys(warnings).length,
      errors,
      warnings,
      successes,
    };
  }, [choiceConditionState, previewState.errors, previewState.required, previewState.values, previewState.warnings, visibleFields]);

  const previewFormStyle = useMemo(() => {
    if (layout.mode === 'grid') {
      return {
        display: 'grid',
        gap: `${layout.gap}px`,
        gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
      };
    }

    return {
      display: 'flex',
      flexWrap: 'wrap' as const,
      gap: `${layout.gap}px`,
      alignContent: 'flex-start' as const,
    };
  }, [layout.columns, layout.gap, layout.mode]);

  const handleValueChange = (fieldId: string, value: any) => {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldId]: value,
    }));
    setTouchedFields((currentValues) => ({
      ...currentValues,
      [fieldId]: true,
    }));
  };

  const markTouched = (fieldId: string) => {
    setTouchedFields((currentValues) => ({
      ...currentValues,
      [fieldId]: true,
    }));
  };

  const handleSubmit = (event: any) => {
    event.preventDefault();
    setSubmitAttempted(true);

    if (validationSummary.errorCount > 0) {
      setSubmissionState({
        type: 'error',
        message: `Preview blocked submission. Fix ${validationSummary.errorCount} validation issue${validationSummary.errorCount === 1 ? '' : 's'} first.`,
      });
      return;
    }

    setSubmittedPayload(livePayload);
    setSubmissionState({
      type: 'success',
      message: 'All rules and validations passed. Payload generated successfully.',
    });
  };

  const renderField = (field: FieldConfig) => {
    const choiceState = choiceConditionState.get(field.id);
    const fieldValue = choiceState?.resolvedValue ?? previewState.values[field.id] ?? '';
    const feedback = fieldFeedback.get(field.id) ?? { type: 'idle' as const };
    const htmlAttributes = field.htmlAttributes ?? {};
    const commonProps = {
      id: `preview-${field.id}`,
      name: getFieldKey(field),
      className: `fb-preview-control ${feedback.type === 'error' ? 'has-error' : ''} ${feedback.type === 'success' ? 'has-success' : ''}`.trim(),
      'aria-invalid': feedback.type === 'error',
      autoFocus: htmlAttributes.autoFocus,
      autoComplete: htmlAttributes.autoComplete,
      dir: htmlAttributes.dir,
      disabled: htmlAttributes.disabled,
      onBlur: () => markTouched(field.id),
    };

    if (field.type === 'textarea') {
      return (
        <textarea
          {...commonProps}
          value={fieldValue}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          readOnly={htmlAttributes.readOnly}
          rows={htmlAttributes.rows ?? 4}
          cols={htmlAttributes.cols}
          wrap={htmlAttributes.wrap}
          spellCheck={htmlAttributes.spellCheck}
          minLength={htmlAttributes.minLength}
          maxLength={htmlAttributes.maxLength}
          inputMode={htmlAttributes.inputMode}
          enterKeyHint={htmlAttributes.enterKeyHint}
          style={{ resize: htmlAttributes.resize }}
          onChange={(event: any) => handleValueChange(field.id, event.target.value)}
        />
      );
    }

    if (field.type === 'select') {
      const isMultiple = field.selectionMode === 'multiple';
      const resolvedOptions = choiceState?.options ?? (field.options ?? []).map((option) => ({
        option,
        resolvedValue: option.value,
        errors: [],
        warnings: [],
        successes: [],
      }));

      return (
        <SmilodonPreviewSelect
          id={`preview-${field.id}`}
          name={getFieldKey(field)}
          className={commonProps.className}
          autoFocus={htmlAttributes.autoFocus}
          dir={htmlAttributes.dir}
          disabled={htmlAttributes.disabled}
          placeholder={field.placeholder || 'Select an option'}
          isMultiple={isMultiple}
          value={fieldValue}
          required={previewState.required.has(field.id)}
          maxSelections={isMultiple && typeof field.validation?.max === 'number' ? field.validation.max : undefined}
          feedback={feedback}
          options={resolvedOptions.map(({ option, resolvedValue }) => ({
            value: resolvedValue,
            label: option.label,
          }))}
          onBlur={() => markTouched(field.id)}
          onValueChange={(nextValue) => handleValueChange(field.id, nextValue)}
        />
      );
    }

    if (field.type === 'date' && field.dateConfig?.useCustomCalendar !== false) {
      const dateFormat = field.dateConfig?.format?.trim() || DEFAULT_DATE_FORMAT;
      const dateLocale = field.dateConfig?.locale?.trim() || locale;
      const formattedValue = formatDateValue(fieldValue, dateFormat, dateLocale);
      const parsedDate = parseIsoDate(fieldValue);

      return (
        <Popover
          open={openDateFieldId === field.id}
          onOpenChange={(open: boolean) => setOpenDateFieldId(open ? field.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${commonProps.className} fb-preview-date-trigger ${formattedValue ? '' : 'is-empty'}`.trim()}
              aria-invalid={feedback.type === 'error'}
              autoFocus={htmlAttributes.autoFocus}
              dir={htmlAttributes.dir}
              disabled={htmlAttributes.disabled}
              onBlur={() => markTouched(field.id)}
            >
              <CalendarDays className="w-4 h-4" />
              <span>{formattedValue || field.placeholder || getDateFormatPlaceholder(dateFormat)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="fb-preview-date-popover" align="start">
            <div className="fb-preview-date-popover-header">
              <strong>{field.label}</strong>
              <span>{dateLocale} · {dateFormat}</span>
            </div>
            <Calendar
              mode="single"
              selected={parsedDate ?? undefined}
              onSelect={(nextDate: Date | undefined) => {
                handleValueChange(field.id, nextDate ? toIsoDate(nextDate) : '');
                setOpenDateFieldId(null);
              }}
            />
            <div className="fb-preview-date-popover-actions">
              <button
                type="button"
                className="fb-btn fb-btn-secondary"
                onClick={() => {
                  handleValueChange(field.id, '');
                  setOpenDateFieldId(null);
                }}
              >
                Clear date
              </button>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    if (field.type === 'checkbox') {
      if ((field.options?.length ?? 0) > 0) {
        const selectedValues = Array.isArray(fieldValue) ? fieldValue : [];
        const resolvedOptions = choiceState?.options ?? (field.options ?? []).map((option) => ({
          option,
          resolvedValue: option.value,
          errors: [],
          warnings: [],
          successes: [],
        }));

        return (
          <div className="fb-preview-radio-group">
            {resolvedOptions.map(({ option, resolvedValue, errors, warnings, successes }) => {
              const optionMessage = errors[0] || warnings[0] || successes[0];
              const optionState = errors[0] ? 'error' : warnings[0] ? 'warning' : successes[0] ? 'success' : 'idle';
              const isChecked = selectedValues.some((value) => value === option.value || value === resolvedValue);

              return (
              <label key={option.value} className="fb-preview-choice-row">
                <input
                  type="checkbox"
                  name={getFieldKey(field)}
                  autoFocus={htmlAttributes.autoFocus && isChecked}
                  disabled={htmlAttributes.disabled}
                  checked={isChecked}
                  onChange={(event: any) => handleValueChange(
                    field.id,
                    event.target.checked
                      ? [...selectedValues, resolvedValue]
                      : selectedValues.filter((value: string | number) => value !== option.value && value !== resolvedValue),
                  )}
                  onBlur={() => markTouched(field.id)}
                />
                <span>
                  {option.label}
                  {optionMessage ? <small className={`fb-preview-choice-note ${optionState}`}>{optionMessage}</small> : null}
                </span>
              </label>
              );
            })}
          </div>
        );
      }

      return (
        <label className="fb-preview-choice-row" htmlFor={`preview-${field.id}`}>
          <input
            {...commonProps}
            type="checkbox"
            autoFocus={htmlAttributes.autoFocus}
            disabled={htmlAttributes.disabled}
            checked={Boolean(fieldValue)}
            onChange={(event: any) => handleValueChange(field.id, event.target.checked)}
          />
          <span>{field.placeholder || `Toggle ${field.label}`}</span>
        </label>
      );
    }

    if (field.type === 'radio') {
      const options = choiceState?.options ?? (field.options ?? []).map((option) => ({
        option,
        resolvedValue: option.value,
        errors: [],
        warnings: [],
        successes: [],
      }));
      return (
        <div className="fb-preview-radio-group">
          {options.map(({ option, resolvedValue, errors, warnings, successes }) => {
            const optionMessage = errors[0] || warnings[0] || successes[0];
            const optionState = errors[0] ? 'error' : warnings[0] ? 'warning' : successes[0] ? 'success' : 'idle';

            return (
            <label key={option.value} className="fb-preview-choice-row">
              <input
                type="radio"
                name={getFieldKey(field)}
                autoFocus={htmlAttributes.autoFocus && (option.value === fieldValue || resolvedValue === fieldValue)}
                disabled={htmlAttributes.disabled}
                checked={fieldValue === option.value || fieldValue === resolvedValue}
                onChange={() => handleValueChange(field.id, resolvedValue)}
                onBlur={() => markTouched(field.id)}
              />
              <span>
                {option.label}
                {optionMessage ? <small className={`fb-preview-choice-note ${optionState}`}>{optionMessage}</small> : null}
              </span>
            </label>
            );
          })}
        </div>
      );
    }

    if (field.type === 'file') {
      return (
        <input
          {...commonProps}
          type="file"
          accept={htmlAttributes.accept}
          multiple={htmlAttributes.multiple}
          capture={htmlAttributes.capture}
          onChange={(event: any) => handleValueChange(
            field.id,
            htmlAttributes.multiple
              ? Array.from<File>(event.target.files ?? []).map((file) => file.name)
              : event.target.files?.[0]?.name ?? '',
          )}
        />
      );
    }

    return (
      <input
        {...commonProps}
        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
        value={fieldValue}
        readOnly={htmlAttributes.readOnly}
        min={typeof htmlAttributes.min === 'number' || typeof htmlAttributes.min === 'string' ? htmlAttributes.min : undefined}
        max={typeof htmlAttributes.max === 'number' || typeof htmlAttributes.max === 'string' ? htmlAttributes.max : undefined}
        minLength={htmlAttributes.minLength}
        maxLength={htmlAttributes.maxLength}
        step={htmlAttributes.step}
        pattern={htmlAttributes.pattern}
        inputMode={htmlAttributes.inputMode}
        enterKeyHint={htmlAttributes.enterKeyHint}
        list={htmlAttributes.list}
        placeholder={field.type === 'date'
          ? field.placeholder || getDateFormatPlaceholder(field.dateConfig?.format)
          : field.placeholder || `Enter ${field.label.toLowerCase()}`}
        onChange={(event: any) => handleValueChange(field.id, event.target.value)}
      />
    );
  };

  return (
    <div className="fb-preview-layout">
      <section className="fb-preview-stage fb-panel">
        <div className="fb-preview-header">
          <div>
            <h3>Live form preview</h3>
            <p>Try the form exactly as an end user would and inspect the generated payload in real time.</p>
          </div>
          <div className="fb-preview-toolbar">
            <span className="fb-preview-badge">
              <Sparkles className="w-3.5 h-3.5" />
              Interactive mode
            </span>
            <span className="fb-preview-badge muted">
              {visibleFields.length} visible field{visibleFields.length === 1 ? '' : 's'}
            </span>
            <span className={`fb-preview-badge ${validationSummary.errorCount > 0 ? 'danger' : 'success'}`}>
              {validationSummary.errorCount > 0 ? <TriangleAlert className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {validationSummary.errorCount > 0
                ? `${validationSummary.errorCount} error${validationSummary.errorCount === 1 ? '' : 's'}`
                : `${validationSummary.successCount} valid`}
            </span>
            {validationSummary.warningCount > 0 ? (
              <span className="fb-preview-badge warning">
                <TriangleAlert className="w-3.5 h-3.5" />
                {validationSummary.warningCount} warning{validationSummary.warningCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>

        {submissionState.type !== 'idle' ? (
          <div className={`fb-preview-submit-state ${submissionState.type}`}>
            {submissionState.type === 'error' ? <TriangleAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{submissionState.message}</span>
          </div>
        ) : null}

        <form
          className={`fb-preview-form fb-preview-form-${layout.mode}`}
          onSubmit={handleSubmit}
          style={{ maxWidth: `${layout.canvasWidth}px`, margin: '0 auto' }}
        >
          {visibleFields.length === 0 ? (
            <div className="fb-preview-empty">
              <EyeOff className="w-10 h-10" />
              <p>No visible fields in preview mode.</p>
            </div>
          ) : (
            <div className="fb-preview-form-grid" style={previewFormStyle}>
              {visibleFields.map((field) => {
                const fieldLayout = getPreviewFieldLayout(field, activeDevice, layout.columns);

                return (
                  <motion.div
                    key={field.id}
                    className="fb-preview-field"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={layout.mode === 'grid'
                      ? {
                          gridColumn: `span ${fieldLayout.gridSpan} / span ${fieldLayout.gridSpan}`,
                          minWidth: 0,
                        }
                      : {
                          width: `${Math.min(Math.max(fieldLayout.width, 25), 100)}%`,
                          maxWidth: '100%',
                        }}
                  >
                    <div className="fb-preview-field-header">
                      <label htmlFor={`preview-${field.id}`}>{field.label}</label>
                      <div className="fb-preview-field-meta">
                        <span>{getFieldKey(field)}</span>
                        {previewState.required.has(field.id) ? <strong>Required</strong> : null}
                        {fieldFeedback.get(field.id)?.type === 'success' ? <strong className="success">Valid</strong> : null}
                        {fieldFeedback.get(field.id)?.type === 'warning' ? <strong className="warning">Warning</strong> : null}
                      </div>
                    </div>
                    {renderField(field)}
                    {fieldFeedback.get(field.id)?.type === 'error' ? (
                      <p className="fb-preview-error">{fieldFeedback.get(field.id)?.message}</p>
                    ) : null}
                    {fieldFeedback.get(field.id)?.type === 'warning' ? (
                      <p className="fb-preview-warning">{fieldFeedback.get(field.id)?.message}</p>
                    ) : null}
                    {fieldFeedback.get(field.id)?.type === 'success' ? (
                      <p className="fb-preview-success">{fieldFeedback.get(field.id)?.message}</p>
                    ) : null}
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="fb-preview-actions">
            <button type="submit" className="fb-btn fb-btn-primary">
              <Play className="w-4 h-4" />
              Run output
            </button>
          </div>
        </form>
      </section>

      <aside className="fb-preview-output fb-panel">
        <div className="fb-preview-output-header">
          <h3>
            <FileJson className="w-4 h-4" />
            Output in action
          </h3>
          <span className="fb-preview-badge muted">
            <Eye className="w-3.5 h-3.5" />
            Live payload
          </span>
        </div>

        <div className="fb-preview-output-block">
          <h4>Current payload</h4>
          <pre>{JSON.stringify(livePayload, null, 2)}</pre>
        </div>

        <div className="fb-preview-output-block">
          <h4>Last submitted payload</h4>
          <pre>{JSON.stringify(submittedPayload ?? { status: 'Not submitted yet' }, null, 2)}</pre>
        </div>

        <div className="fb-preview-output-block">
          <h4>Validation state</h4>
          <pre>{JSON.stringify({
            errors: validationSummary.errors,
            warnings: validationSummary.warnings,
            successes: validationSummary.successes,
            submission: submissionState,
          }, null, 2)}</pre>
        </div>
      </aside>
    </div>
  );
};
