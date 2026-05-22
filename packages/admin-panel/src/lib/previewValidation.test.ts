import { describe, expect, it } from 'vitest';
import type { FieldConfig, FormConnection, Rule } from '../types/schema';
import {
  evaluateConnectionCondition,
  getValidationError,
  isValueEmpty,
  resolvePreviewState,
} from './previewValidation';

const textField = (id: string, label = id): FieldConfig => ({
  id,
  label,
  type: 'text',
});

const numberField = (id: string, label = id): FieldConfig => ({
  id,
  label,
  type: 'number',
});

const dateField = (id: string, label = id): FieldConfig => ({
  id,
  label,
  type: 'date',
});

const validationConnection = (
  operator: FormConnection['operator'],
  validationType: FormConnection['validationType'] = 'error',
): FormConnection => ({
  id: `${operator}-${validationType}`,
  sourceId: 'source',
  targetId: 'target',
  type: 'validation',
  operator,
  validationType,
});

describe('previewValidation matrix: value emptiness by field state', () => {
  const matrix = [
    {
      label: 'checkbox-group is empty when no selected options',
      field: { id: 'choices', label: 'Choices', type: 'checkbox', options: [{ label: 'One', value: 'one' }] } as FieldConfig,
      value: [],
      expected: true,
    },
    {
      label: 'checkbox-group is non-empty when at least one selected option',
      field: { id: 'choices', label: 'Choices', type: 'checkbox', options: [{ label: 'One', value: 'one' }] } as FieldConfig,
      value: ['one'],
      expected: false,
    },
    {
      label: 'single checkbox false is empty',
      field: { id: 'agree', label: 'Agree', type: 'checkbox' } as FieldConfig,
      value: false,
      expected: true,
    },
    {
      label: 'single checkbox true is non-empty',
      field: { id: 'agree', label: 'Agree', type: 'checkbox' } as FieldConfig,
      value: true,
      expected: false,
    },
    {
      label: 'text empty string is empty',
      field: textField('name', 'Name'),
      value: '',
      expected: true,
    },
    {
      label: 'text value is non-empty',
      field: textField('name', 'Name'),
      value: 'Helix',
      expected: false,
    },
  ] as const;

  matrix.forEach((testCase) => {
    it(testCase.label, () => {
      expect(isValueEmpty(testCase.field, testCase.value)).toBe(testCase.expected);
    });
  });
});

describe('previewValidation matrix: field-level validation rules', () => {
  it('validates number min/max when htmlAttributes use string constraints', () => {
    const field: FieldConfig = {
      id: 'age',
      label: 'Age',
      type: 'number',
      htmlAttributes: {
        min: '10',
        max: '20',
      },
    };

    expect(getValidationError(field, '9', false)).toContain('at least 10');
    expect(getValidationError(field, '21', false)).toContain('no more than 20');
    expect(getValidationError(field, '15', false)).toBeNull();
  });

  it('validates required and pattern for text', () => {
    const field: FieldConfig = {
      id: 'code',
      label: 'Code',
      type: 'text',
      validation: {
        pattern: '^H-[0-9]{3}$',
      },
    };

    expect(getValidationError(field, '', true)).toBe('Code is required.');
    expect(getValidationError(field, 'HELIX', false)).toContain('required format');
    expect(getValidationError(field, 'H-123', false)).toBeNull();
  });
});

describe('previewValidation matrix: connection operators across state combinations', () => {
  const matrix = [
    {
      label: 'date lessThan with ISO values',
      connection: validationConnection('lessThan'),
      source: '2026-05-10',
      target: '2026-05-22',
      expected: true,
    },
    {
      label: 'date greaterThan with ISO values',
      connection: validationConnection('greaterThan'),
      source: '2026-05-22',
      target: '2026-05-10',
      expected: true,
    },
    {
      label: 'number greaterThan',
      connection: validationConnection('greaterThan'),
      source: 10,
      target: 2,
      expected: true,
    },
    {
      label: 'number equals by numeric coercion',
      connection: validationConnection('equals'),
      source: '10',
      target: 10,
      expected: true,
    },
    {
      label: 'string contains',
      connection: validationConnection('contains'),
      source: 'helix-admin-panel',
      target: 'admin',
      expected: true,
    },
    {
      label: 'divide blocks divisor zero',
      connection: validationConnection('divide'),
      source: 10,
      target: 0,
      expected: false,
    },
  ] as const;

  matrix.forEach((testCase) => {
    it(testCase.label, () => {
      expect(evaluateConnectionCondition(testCase.connection, testCase.source, testCase.target)).toBe(testCase.expected);
    });
  });
});

describe('previewValidation matrix: state transitions across fields and rules', () => {
  it('applies visibility, requirement, and setValue in rule pass', () => {
    const fields: FieldConfig[] = [
      textField('toggle', 'Toggle'),
      textField('dependent', 'Dependent'),
      textField('computed', 'Computed'),
    ];

    const rules: Rule[] = [
      {
        id: 'rule-1',
        dependsOn: ['toggle'],
        condition: 'toggle === "on"',
        actions: [
          { type: 'show', field: 'dependent' },
          { type: 'setRequired', field: 'dependent', required: true },
          { type: 'setValue', field: 'computed', value: 'autofill' },
        ],
      },
    ];

    const state = resolvePreviewState(fields, rules, [], {
      toggle: 'on',
      dependent: '',
      computed: '',
    });

    expect(state.visible.has('dependent')).toBe(true);
    expect(state.required.has('dependent')).toBe(true);
    expect(state.values.computed).toBe('autofill');
  });

  it('routes triggered connection result to error/warning/success target maps', () => {
    const fields: FieldConfig[] = [
      numberField('source', 'Source'),
      numberField('target', 'Target'),
    ];

    const connections: FormConnection[] = [
      validationConnection('greaterThan', 'error'),
      { ...validationConnection('lessThan', 'warning'), id: 'warn-1' },
      { ...validationConnection('equals', 'success'), id: 'success-1' },
    ];

    const state = resolvePreviewState(fields, [], connections, {
      source: 10,
      target: 5,
    });

    expect(state.errors.has('target')).toBe(true);
    expect(state.warnings.has('target')).toBe(false);
    expect(state.successes.has('target')).toBe(false);

    const warningState = resolvePreviewState(fields, [], [{ ...validationConnection('lessThan', 'warning'), id: 'warn-2' }], {
      source: 1,
      target: 5,
    });
    expect(warningState.warnings.has('target')).toBe(true);

    const successState = resolvePreviewState(fields, [], [{ ...validationConnection('equals', 'success'), id: 'success-2' }], {
      source: 7,
      target: '7',
    });
    expect(successState.successes.has('target')).toBe(true);
  });

  it('skips connection validation when either side is empty', () => {
    const fields: FieldConfig[] = [
      dateField('source', 'Start date'),
      dateField('target', 'End date'),
    ];

    const state = resolvePreviewState(fields, [], [validationConnection('lessThan', 'error')], {
      source: '2026-05-01',
      target: '',
    });

    expect(state.errors.size).toBe(0);
    expect(state.warnings.size).toBe(0);
    expect(state.successes.size).toBe(0);
  });
});
