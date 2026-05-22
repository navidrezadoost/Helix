import type { FieldConfig, FormConnection, Rule } from '../types/schema';
import { getFieldKey, parseIsoDate } from './formBuilder';

export interface PreviewState {
  values: Record<string, any>;
  visible: Set<string>;
  required: Set<string>;
  errors: Map<string, string>;
  warnings: Map<string, string>;
  successes: Map<string, string>;
}

const getConnectionMessage = (
  connection: FormConnection,
  sourceField: FieldConfig | undefined,
  targetField: FieldConfig | undefined,
) => {
  const sourceLabel = sourceField?.label ?? sourceField?.id ?? 'Source field';
  const targetLabel = targetField?.label ?? targetField?.id ?? 'Target field';
  const operatorLabelMap: Record<FormConnection['operator'], string> = {
    equals: 'equals',
    notEquals: 'does not equal',
    greaterThan: 'is greater than',
    lessThan: 'is less than',
    contains: 'contains',
    add: 'adds to',
    subtract: 'subtracts from',
    multiply: 'multiplies',
    divide: 'divides',
  };

  return `${sourceLabel} ${operatorLabelMap[connection.operator]} ${targetLabel}.`;
};

const coerceComparableDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const parsedDate = parseIsoDate(value.trim());
    if (parsedDate) {
      return parsedDate.getTime();
    }
  }

  return null;
};

const coerceComparableNumber = (value: unknown) => {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numericValue = Number(trimmed);
    if (!Number.isNaN(numericValue)) {
      return numericValue;
    }
  }

  return null;
};

const compareComparableValues = (sourceValue: unknown, targetValue: unknown) => {
  const sourceDate = coerceComparableDate(sourceValue);
  const targetDate = coerceComparableDate(targetValue);

  if (sourceDate !== null && targetDate !== null) {
    return {
      source: sourceDate,
      target: targetDate,
      kind: 'number' as const,
    };
  }

  const sourceNumber = coerceComparableNumber(sourceValue);
  const targetNumber = coerceComparableNumber(targetValue);

  if (sourceNumber !== null && targetNumber !== null) {
    return {
      source: sourceNumber,
      target: targetNumber,
      kind: 'number' as const,
    };
  }

  return {
    source: String(sourceValue ?? ''),
    target: String(targetValue ?? ''),
    kind: 'string' as const,
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

const toNumberConstraint = (value: number | string | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const evaluateConnectionCondition = (connection: FormConnection, sourceValue: any, targetValue: any) => {
  const comparableValues = compareComparableValues(sourceValue, targetValue);

  switch (connection.operator) {
    case 'equals':
      return comparableValues.source === comparableValues.target;
    case 'notEquals':
      return comparableValues.source !== comparableValues.target;
    case 'greaterThan':
      if (comparableValues.kind === 'number') {
        return comparableValues.source > comparableValues.target;
      }
      return comparableValues.source.localeCompare(comparableValues.target, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) > 0;
    case 'lessThan':
      if (comparableValues.kind === 'number') {
        return comparableValues.source < comparableValues.target;
      }
      return comparableValues.source.localeCompare(comparableValues.target, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) < 0;
    case 'contains':
      return String(sourceValue ?? '').includes(String(targetValue ?? ''));
    case 'add':
      return Number(sourceValue) + Number(targetValue) !== 0;
    case 'subtract':
      return Number(sourceValue) - Number(targetValue) !== 0;
    case 'multiply':
      return Number(sourceValue) * Number(targetValue) !== 0;
    case 'divide':
      return Number(targetValue) !== 0 && Number(sourceValue) / Number(targetValue) !== 0;
    default:
      return false;
  }
};

export const isValueEmpty = (field: FieldConfig, value: any) => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (field.type === 'checkbox') {
    if ((field.options?.length ?? 0) > 0) {
      return !Array.isArray(value) || value.length === 0;
    }

    return !Boolean(value);
  }

  return value === undefined || value === null || value === '';
};

export const getValidationError = (field: FieldConfig, value: any, isRequired: boolean) => {
  if (isRequired && isValueEmpty(field, value)) {
    return field.validation?.errorMessage || `${field.label} is required.`;
  }

  if (isValueEmpty(field, value)) {
    return null;
  }

  if (Array.isArray(value)) {
    const minSelectionCount = field.validation?.min ?? field.htmlAttributes?.minLength;
    const maxSelectionCount = field.validation?.max ?? field.htmlAttributes?.maxLength;

    if (minSelectionCount !== undefined && value.length < minSelectionCount) {
      return field.validation?.errorMessage || `Select at least ${minSelectionCount} option${minSelectionCount === 1 ? '' : 's'}.`;
    }

    if (maxSelectionCount !== undefined && value.length > maxSelectionCount) {
      return field.validation?.errorMessage || `Select no more than ${maxSelectionCount} option${maxSelectionCount === 1 ? '' : 's'}.`;
    }

    return null;
  }

  if (field.type === 'number') {
    const numericValue = typeof value === 'number' ? value : Number(value);
    const numericMin = toNumberConstraint(field.validation?.min ?? field.htmlAttributes?.min);
    const numericMax = toNumberConstraint(field.validation?.max ?? field.htmlAttributes?.max);

    if (Number.isNaN(numericValue)) {
      return field.validation?.errorMessage || 'Enter a valid number.';
    }

    if (numericMin !== undefined && numericValue < numericMin) {
      return field.validation?.errorMessage || `Value must be at least ${numericMin}.`;
    }

    if (numericMax !== undefined && numericValue > numericMax) {
      return field.validation?.errorMessage || `Value must be no more than ${numericMax}.`;
    }

    return null;
  }

  const stringValue = String(value);
  const minLength = field.validation?.min ?? field.htmlAttributes?.minLength;
  const maxLength = field.validation?.max ?? field.htmlAttributes?.maxLength;
  const pattern = field.validation?.pattern ?? field.htmlAttributes?.pattern;

  if (minLength !== undefined && stringValue.length < minLength) {
    return field.validation?.errorMessage || `Enter at least ${minLength} characters.`;
  }

  if (maxLength !== undefined && stringValue.length > maxLength) {
    return field.validation?.errorMessage || `Use no more than ${maxLength} characters.`;
  }

  if (pattern) {
    try {
      const expression = new RegExp(pattern);
      if (!expression.test(stringValue)) {
        return field.validation?.errorMessage || 'Value does not match the required format.';
      }
    } catch {
      return null;
    }
  }

  return null;
};

export const resolvePreviewState = (
  fields: FieldConfig[],
  rules: Rule[],
  connections: FormConnection[],
  baseValues: Record<string, any>,
): PreviewState => {
  let values = { ...baseValues };
  const visible = new Set(
    fields.filter((field) => !field.ui?.hidden).map((field) => field.id),
  );
  const required = new Set(
    fields.filter((field) => field.required).map((field) => field.id),
  );
  const errors = new Map<string, string>();
  const warnings = new Map<string, string>();
  const successes = new Map<string, string>();

  for (let pass = 0; pass < 3; pass += 1) {
    let didChange = false;

    rules.forEach((rule) => {
      const context = buildConditionContext(fields, values);
      const isActive = evaluateCondition(rule.condition || 'false', context);

      if (!isActive) {
        return;
      }

      rule.actions.forEach((action) => {
        if (action.type === 'show') {
          visible.add(action.field);
          return;
        }

        if (action.type === 'hide') {
          visible.delete(action.field);
          return;
        }

        if (action.type === 'setRequired') {
          if (action.required === false) {
            required.delete(action.field);
          } else {
            required.add(action.field);
          }
          return;
        }

        if (action.type === 'setError' && action.message) {
          errors.set(action.field, action.message);
          return;
        }

        if (action.type === 'setValue' && action.value !== undefined && values[action.field] !== action.value) {
          values = {
            ...values,
            [action.field]: action.value,
          };
          didChange = true;
        }
      });
    });

    if (!didChange) {
      break;
    }
  }

  connections.forEach((connection) => {
    if (connection.type !== 'validation') {
      return;
    }

    const sourceField = fields.find((field) => field.id === connection.sourceId);
    const targetField = fields.find((field) => field.id === connection.targetId);
    const sourceValue = values[connection.sourceId];
    const targetValue = values[connection.targetId];

    if (isValueEmpty(sourceField ?? { type: 'text', id: '', label: '' }, sourceValue) || isValueEmpty(targetField ?? { type: 'text', id: '', label: '' }, targetValue)) {
      return;
    }

    if (!evaluateConnectionCondition(connection, sourceValue, targetValue)) {
      return;
    }

    const message = getConnectionMessage(connection, sourceField, targetField);

    if (connection.validationType === 'error') {
      errors.set(connection.targetId, message);
      return;
    }

    if (connection.validationType === 'warning') {
      warnings.set(connection.targetId, message);
      return;
    }

    successes.set(connection.targetId, message);
  });

  return {
    values,
    visible,
    required,
    errors,
    warnings,
    successes,
  };
};
