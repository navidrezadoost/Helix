import { useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Plus, Trash2, MousePointerClick } from 'lucide-react';
import type { FieldConfig, ResponsiveDevice, Rule } from '../../types/schema';
import { CodeSuggestionTextarea } from './CodeSuggestionTextarea';
import {
  DEFAULT_DATE_FORMAT,
  FLEX_WIDTH_PRESETS,
  getDateFormatPlaceholder,
  normalizeFieldName,
  normalizeOptionValue,
} from '../../lib/formBuilder';

const INPUT_MODE_OPTIONS = ['none', 'text', 'tel', 'url', 'email', 'numeric', 'decimal', 'search'] as const;
const ENTER_KEY_HINT_OPTIONS = ['enter', 'done', 'go', 'next', 'previous', 'search', 'send'] as const;

interface PropertyEditorProps {
  field: FieldConfig | null;
  fields: FieldConfig[];
  rules: Rule[];
  activeDevice: ResponsiveDevice;
  layoutMode: 'flex' | 'grid';
  gridColumns: number;
  defaultLocale?: string;
  onUpdateField: (updates: Partial<FieldConfig>) => void;
  onUpdateRule: (ruleIndex: number, rule: Rule) => void;
  onAddRule: () => void;
  onDeleteRule: (ruleIndex: number) => void;
}

export const PropertyEditor: FC<PropertyEditorProps> = ({
  field,
  fields,
  rules,
  activeDevice,
  layoutMode,
  gridColumns,
  defaultLocale,
  onUpdateField,
  onUpdateRule,
  onAddRule,
  onDeleteRule,
}) => {
  const panelVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
  };

  const groupVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: index * 0.05, duration: 0.3 },
    }),
  };

  const duplicateNames = new Set(
    fields
      .map((candidate) => (candidate.name?.trim() || candidate.id).toLowerCase())
      .filter((name, index, collection) => collection.indexOf(name) !== index),
  );

  const fieldConditionSuggestions = useMemo(() => {
    const fieldTokens = fields.flatMap((candidate) => {
      const name = candidate.name?.trim();
      return [candidate.id, name, name ? `values.${name}` : null].filter(Boolean) as string[];
    });

    return [
      ...fieldTokens,
      'true',
      'false',
      '&&',
      '||',
      '===',
      '!==',
      '>',
      '<',
      '>=',
      '<=',
    ];
  }, [fields]);

  const deviceLabel = activeDevice.charAt(0).toUpperCase() + activeDevice.slice(1);
  const deviceSettings = field?.ui?.responsive?.[activeDevice];
  const effectiveWidth = deviceSettings?.width ?? field?.ui?.width ?? 100;
  const effectiveGridSpan = deviceSettings?.gridSpan ?? field?.ui?.gridSpan ?? gridColumns;
  const widthPresetValue = FLEX_WIDTH_PRESETS.includes(effectiveWidth as (typeof FLEX_WIDTH_PRESETS)[number])
    ? `${effectiveWidth}`
    : 'custom';
  const dateFormat = field?.dateConfig?.format?.trim() || DEFAULT_DATE_FORMAT;
  const dateFormatPresets = [DEFAULT_DATE_FORMAT, 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD MMM YYYY'];
  const dateFormatPresetValue = dateFormatPresets.includes(dateFormat) ? dateFormat : 'custom';
  const htmlAttributes = field?.htmlAttributes ?? {};
  const supportsReadOnly = field ? ['text', 'number', 'date', 'textarea'].includes(field.type) : false;
  const supportsTextLengths = field ? ['text', 'textarea'].includes(field.type) : false;
  const supportsInputMode = field ? ['text', 'number', 'textarea'].includes(field.type) : false;
  const supportsRange = field ? ['number', 'date'].includes(field.type) : false;
  const supportsDirection = field ? ['text', 'textarea', 'select'].includes(field.type) : false;

  const updateHtmlAttributes = (updates: Partial<NonNullable<FieldConfig['htmlAttributes']>>) => {
    if (!field) {
      return;
    }

    const nextAttributes = {
      ...(field.htmlAttributes ?? {}),
      ...updates,
    } as NonNullable<FieldConfig['htmlAttributes']>;

    Object.keys(nextAttributes).forEach((key) => {
      if (nextAttributes[key as keyof typeof nextAttributes] === undefined) {
        delete nextAttributes[key as keyof typeof nextAttributes];
      }
    });

    onUpdateField({ htmlAttributes: nextAttributes });
  };

  const updateHtmlNumberAttribute = (
    key: keyof NonNullable<FieldConfig['htmlAttributes']>,
    rawValue: string,
  ) => {
    const trimmedValue = rawValue.trim();
    updateHtmlAttributes({
      [key]: trimmedValue === '' ? undefined : Number(trimmedValue),
    } as Partial<NonNullable<FieldConfig['htmlAttributes']>>);
  };

  const updateValidation = (updates: Partial<NonNullable<FieldConfig['validation']>>) => {
    if (!field) {
      return;
    }

    const nextValidation = {
      ...(field.validation ?? {}),
      ...updates,
    };

    Object.keys(nextValidation).forEach((key) => {
      if (nextValidation[key as keyof typeof nextValidation] === undefined || nextValidation[key as keyof typeof nextValidation] === '') {
        delete nextValidation[key as keyof typeof nextValidation];
      }
    });

    onUpdateField({ validation: nextValidation });
  };

  const updateResponsiveLayout = (updates: { width?: number; gridSpan?: number }) => {
    if (!field) {
      return;
    }

    if (activeDevice === 'desktop') {
      onUpdateField({
        ui: {
          ...field.ui,
          ...updates,
        },
      });
      return;
    }

    onUpdateField({
      ui: {
        ...field.ui,
        responsive: {
          ...(field.ui?.responsive ?? {}),
          [activeDevice]: {
            ...(field.ui?.responsive?.[activeDevice] ?? {}),
            ...updates,
          },
        },
      },
    });
  };

  const clearResponsiveLayout = () => {
    if (!field || activeDevice === 'desktop') {
      return;
    }

    const responsive = { ...(field.ui?.responsive ?? {}) };
    delete responsive[activeDevice];

    onUpdateField({
      ui: {
        ...field.ui,
        responsive,
      },
    });
  };

  return (
    <aside className="fb-panel fb-property-editor">
      <div className="fb-panel-header">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings className="w-4 h-4" /> Properties
        </h3>
      </div>
      <div className="fb-panel-content">

      <AnimatePresence mode="wait">
        {field ? (
          <motion.div
            key={field.id}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
          <motion.div className="fb-property-group" variants={groupVariants} custom={0}>
            <label htmlFor="field-label">Label</label>
            <input
              id="field-label"
              className="fb-input"
              value={field.label}
              onChange={(event) => {
                const nextLabel = event.target.value;
                const currentAutoName = normalizeFieldName(field.label, field.type);
                const shouldSyncName = !field.name?.trim() || field.name === currentAutoName;

                onUpdateField({
                  label: nextLabel,
                  ...(shouldSyncName ? { name: normalizeFieldName(nextLabel, field.type) } : {}),
                });
              }}
            />
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={1}>
            <label htmlFor="field-name">Input name</label>
            <input
              id="field-name"
              className="fb-input"
              value={field.name ?? ''}
              onChange={(event) => onUpdateField({ name: normalizeFieldName(event.target.value, field.type) })}
              placeholder="Unique server field name"
            />
            {duplicateNames.has((field.name?.trim() || field.id).toLowerCase()) ? (
              <p className="fb-hint fb-warning-text">
                Duplicate input name. Submitting this form can send duplicate values to the server.
              </p>
            ) : (
              <p className="fb-hint">Automatically normalized to lowercase_with_underscores for safe submission keys.</p>
            )}
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={2}>
            <label htmlFor="field-id">Field ID</label>
            <input id="field-id" className="fb-input" value={field.id} disabled />
            <p className="fb-hint">Generated from the field name plus a ULID so it stays unique and stable.</p>
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={3}>
            <label htmlFor="field-placeholder">Placeholder</label>
            <input
              id="field-placeholder"
              className="fb-input"
              value={field.placeholder ?? ''}
              onChange={(event) => onUpdateField({ placeholder: event.target.value })}
              placeholder="Enter placeholder text..."
            />
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={4}>
            <label htmlFor="field-required">Required</label>
            <select
              id="field-required"
              className="fb-select"
              value={field.required ? 'yes' : 'no'}
              onChange={(event) => onUpdateField({ required: event.target.value === 'yes' })}
            >
              <option value="no">Optional</option>
              <option value="yes">Required</option>
            </select>
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={5}>
            <label>Default value</label>
            {field.type === 'checkbox' && (field.options?.length ?? 0) > 0 ? (
              <select
                className="fb-select"
                multiple
                value={Array.isArray(field.defaultValue) ? field.defaultValue : []}
                onChange={(event) => onUpdateField({
                  defaultValue: Array.from(event.target.selectedOptions as ArrayLike<{ value: string }>).map((option) => option.value),
                })}
                style={{ minHeight: '110px' }}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === 'checkbox' ? (
              <select
                className="fb-select"
                value={field.defaultValue ? 'checked' : 'unchecked'}
                onChange={(event) => onUpdateField({ defaultValue: event.target.value === 'checked' })}
              >
                <option value="unchecked">Unchecked</option>
                <option value="checked">Checked</option>
              </select>
            ) : field.type === 'select' && field.selectionMode === 'multiple' ? (
              <select
                className="fb-select"
                multiple
                value={Array.isArray(field.defaultValue) ? field.defaultValue : []}
                onChange={(event) => onUpdateField({
                  defaultValue: Array.from(event.target.selectedOptions as ArrayLike<{ value: string }>).map((option) => option.value),
                })}
                style={{ minHeight: '110px' }}
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === 'select' || field.type === 'radio' ? (
              <select
                className="fb-select"
                value={String(field.defaultValue ?? '')}
                onChange={(event) => onUpdateField({ defaultValue: event.target.value || undefined })}
              >
                <option value="">No default</option>
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            ) : field.type === 'file' ? (
              <p className="fb-hint">Browsers do not allow a predefined file value for security reasons.</p>
            ) : (
              <input
                className="fb-input"
                type={field.type === 'number' ? 'number' : 'text'}
                value={field.defaultValue ?? ''}
                onChange={(event) => onUpdateField({
                  defaultValue: field.type === 'number'
                    ? (event.target.value === '' ? undefined : Number(event.target.value))
                    : event.target.value,
                })}
                placeholder="Optional default value"
              />
            )}
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={6}>
            <label>HTML attributes</label>
            <div className="fb-layout-grid">
              <div>
                <label htmlFor="field-disabled">Disabled</label>
                <select
                  id="field-disabled"
                  className="fb-select"
                  value={htmlAttributes.disabled ? 'yes' : 'no'}
                  onChange={(event) => updateHtmlAttributes({ disabled: event.target.value === 'yes' })}
                >
                  <option value="no">Enabled</option>
                  <option value="yes">Disabled</option>
                </select>
              </div>
              <div>
                <label htmlFor="field-autofocus">Autofocus</label>
                <select
                  id="field-autofocus"
                  className="fb-select"
                  value={htmlAttributes.autoFocus ? 'yes' : 'no'}
                  onChange={(event) => updateHtmlAttributes({ autoFocus: event.target.value === 'yes' })}
                >
                  <option value="no">Off</option>
                  <option value="yes">On</option>
                </select>
              </div>
            </div>

            <div className="fb-layout-grid">
              <div>
                <label htmlFor="field-autocomplete">Autocomplete</label>
                <input
                  id="field-autocomplete"
                  className="fb-input"
                  value={htmlAttributes.autoComplete ?? ''}
                  onChange={(event) => updateHtmlAttributes({ autoComplete: event.target.value || undefined })}
                  placeholder="on, off, email, street-address..."
                />
              </div>
              {supportsDirection ? (
                <div>
                  <label htmlFor="field-dir">Direction</label>
                  <select
                    id="field-dir"
                    className="fb-select"
                    value={htmlAttributes.dir ?? ''}
                    onChange={(event) => updateHtmlAttributes({
                      dir: (event.target.value || undefined) as NonNullable<FieldConfig['htmlAttributes']>['dir'],
                    })}
                  >
                    <option value="">Auto</option>
                    <option value="ltr">LTR</option>
                    <option value="rtl">RTL</option>
                    <option value="auto">Browser auto</option>
                  </select>
                </div>
              ) : null}
            </div>

            {supportsReadOnly ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-readonly">Readonly</label>
                  <select
                    id="field-readonly"
                    className="fb-select"
                    value={htmlAttributes.readOnly ? 'yes' : 'no'}
                    onChange={(event) => updateHtmlAttributes({ readOnly: event.target.value === 'yes' })}
                  >
                    <option value="no">Editable</option>
                    <option value="yes">Readonly</option>
                  </select>
                </div>
                {supportsInputMode ? (
                  <div>
                    <label htmlFor="field-inputmode">Input mode</label>
                    <select
                      id="field-inputmode"
                      className="fb-select"
                      value={htmlAttributes.inputMode ?? ''}
                      onChange={(event) => updateHtmlAttributes({
                        inputMode: (event.target.value || undefined) as NonNullable<FieldConfig['htmlAttributes']>['inputMode'],
                      })}
                    >
                      <option value="">Default</option>
                      {INPUT_MODE_OPTIONS.map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}

            {supportsInputMode ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-enterkeyhint">Enter key hint</label>
                  <select
                    id="field-enterkeyhint"
                    className="fb-select"
                    value={htmlAttributes.enterKeyHint ?? ''}
                    onChange={(event) => updateHtmlAttributes({
                      enterKeyHint: (event.target.value || undefined) as NonNullable<FieldConfig['htmlAttributes']>['enterKeyHint'],
                    })}
                  >
                    <option value="">Default</option>
                    {ENTER_KEY_HINT_OPTIONS.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </div>
                {field.type === 'text' ? (
                  <div>
                    <label htmlFor="field-pattern">Pattern</label>
                    <input
                      id="field-pattern"
                      className="fb-input"
                      value={field.validation?.pattern ?? htmlAttributes.pattern ?? ''}
                      onChange={(event) => {
                        const nextPattern = event.target.value || undefined;
                        updateHtmlAttributes({ pattern: nextPattern });
                        updateValidation({ pattern: nextPattern });
                      }}
                      placeholder="[A-Za-z0-9_]+"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {supportsTextLengths ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-minlength">Min length</label>
                  <input
                    id="field-minlength"
                    type="number"
                    className="fb-input"
                    min={0}
                    value={htmlAttributes.minLength ?? field.validation?.min ?? ''}
                    onChange={(event) => {
                      const trimmedValue = event.target.value.trim();
                      const nextValue = trimmedValue === '' ? undefined : Number(trimmedValue);
                      updateHtmlAttributes({ minLength: nextValue });
                      updateValidation({ min: nextValue });
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="field-maxlength">Max length</label>
                  <input
                    id="field-maxlength"
                    type="number"
                    className="fb-input"
                    min={0}
                    value={htmlAttributes.maxLength ?? field.validation?.max ?? ''}
                    onChange={(event) => {
                      const trimmedValue = event.target.value.trim();
                      const nextValue = trimmedValue === '' ? undefined : Number(trimmedValue);
                      updateHtmlAttributes({ maxLength: nextValue });
                      updateValidation({ max: nextValue });
                    }}
                  />
                </div>
              </div>
            ) : null}

            {supportsRange ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-min">Min</label>
                  <input
                    id="field-min"
                    type={field.type === 'date' ? 'text' : 'number'}
                    className="fb-input"
                    value={String(htmlAttributes.min ?? field.validation?.min ?? '')}
                    onChange={(event) => {
                      const nextValue = event.target.value.trim();
                      const normalized = nextValue === ''
                        ? undefined
                        : field.type === 'number'
                          ? Number(nextValue)
                          : nextValue;
                      updateHtmlAttributes({ min: normalized });
                      if (field.type === 'number') {
                        updateValidation({ min: normalized as number | undefined });
                      }
                    }}
                    placeholder={field.type === 'date' ? '2026-12-31' : '0'}
                  />
                </div>
                <div>
                  <label htmlFor="field-max">Max</label>
                  <input
                    id="field-max"
                    type={field.type === 'date' ? 'text' : 'number'}
                    className="fb-input"
                    value={String(htmlAttributes.max ?? field.validation?.max ?? '')}
                    onChange={(event) => {
                      const nextValue = event.target.value.trim();
                      const normalized = nextValue === ''
                        ? undefined
                        : field.type === 'number'
                          ? Number(nextValue)
                          : nextValue;
                      updateHtmlAttributes({ max: normalized });
                      if (field.type === 'number') {
                        updateValidation({ max: normalized as number | undefined });
                      }
                    }}
                    placeholder={field.type === 'date' ? '2026-12-31' : '100'}
                  />
                </div>
              </div>
            ) : null}

            {field.type === 'number' || field.type === 'date' ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-step">Step</label>
                  <input
                    id="field-step"
                    className="fb-input"
                    value={String(htmlAttributes.step ?? '')}
                    onChange={(event) => updateHtmlAttributes({
                      step: event.target.value.trim() === ''
                        ? undefined
                        : event.target.value === 'any'
                          ? 'any'
                          : Number(event.target.value),
                    })}
                    placeholder={field.type === 'date' ? '1' : 'any'}
                  />
                </div>
                <div>
                  <label htmlFor="field-list">List / datalist id</label>
                  <input
                    id="field-list"
                    className="fb-input"
                    value={htmlAttributes.list ?? ''}
                    onChange={(event) => updateHtmlAttributes({ list: event.target.value || undefined })}
                    placeholder="optional_datalist_id"
                  />
                </div>
              </div>
            ) : null}

            {field.type === 'textarea' ? (
              <>
                <div className="fb-layout-grid">
                  <div>
                    <label htmlFor="field-rows">Rows</label>
                    <input
                      id="field-rows"
                      type="number"
                      className="fb-input"
                      min={2}
                      value={htmlAttributes.rows ?? 4}
                      onChange={(event) => updateHtmlNumberAttribute('rows', event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="field-cols">Cols</label>
                    <input
                      id="field-cols"
                      type="number"
                      className="fb-input"
                      min={1}
                      value={htmlAttributes.cols ?? ''}
                      onChange={(event) => updateHtmlNumberAttribute('cols', event.target.value)}
                    />
                  </div>
                </div>
                <div className="fb-layout-grid">
                  <div>
                    <label htmlFor="field-wrap">Wrap</label>
                    <select
                      id="field-wrap"
                      className="fb-select"
                      value={htmlAttributes.wrap ?? ''}
                      onChange={(event) => updateHtmlAttributes({
                        wrap: (event.target.value || undefined) as NonNullable<FieldConfig['htmlAttributes']>['wrap'],
                      })}
                    >
                      <option value="">Browser default</option>
                      <option value="soft">soft</option>
                      <option value="hard">hard</option>
                      <option value="off">off</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="field-resize">Resize</label>
                    <select
                      id="field-resize"
                      className="fb-select"
                      value={htmlAttributes.resize ?? 'vertical'}
                      onChange={(event) => updateHtmlAttributes({
                        resize: event.target.value as NonNullable<FieldConfig['htmlAttributes']>['resize'],
                      })}
                    >
                      <option value="none">none</option>
                      <option value="vertical">vertical</option>
                      <option value="horizontal">horizontal</option>
                      <option value="both">both</option>
                    </select>
                  </div>
                </div>
                <div className="fb-layout-grid">
                  <div>
                    <label htmlFor="field-spellcheck">Spellcheck</label>
                    <select
                      id="field-spellcheck"
                      className="fb-select"
                      value={htmlAttributes.spellCheck === false ? 'false' : 'true'}
                      onChange={(event) => updateHtmlAttributes({ spellCheck: event.target.value === 'true' })}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  </div>
                </div>
              </>
            ) : null}

            {field.type === 'select' ? (
              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-select-size">Visible size</label>
                  <input
                    id="field-select-size"
                    type="number"
                    className="fb-input"
                    min={1}
                    value={htmlAttributes.size ?? (field.selectionMode === 'multiple' ? 4 : 1)}
                    onChange={(event) => updateHtmlNumberAttribute('size', event.target.value)}
                  />
                </div>
              </div>
            ) : null}

            {field.type === 'file' ? (
              <>
                <div className="fb-layout-grid">
                  <div>
                    <label htmlFor="field-accept">Accept</label>
                    <input
                      id="field-accept"
                      className="fb-input"
                      value={htmlAttributes.accept ?? ''}
                      onChange={(event) => updateHtmlAttributes({ accept: event.target.value || undefined })}
                      placeholder="image/*,.pdf"
                    />
                  </div>
                  <div>
                    <label htmlFor="field-file-multiple">Multiple files</label>
                    <select
                      id="field-file-multiple"
                      className="fb-select"
                      value={htmlAttributes.multiple ? 'yes' : 'no'}
                      onChange={(event) => updateHtmlAttributes({ multiple: event.target.value === 'yes' })}
                    >
                      <option value="no">Single</option>
                      <option value="yes">Multiple</option>
                    </select>
                  </div>
                </div>
                <div className="fb-layout-grid">
                  <div>
                    <label htmlFor="field-capture">Capture</label>
                    <select
                      id="field-capture"
                      className="fb-select"
                      value={htmlAttributes.capture ?? ''}
                      onChange={(event) => updateHtmlAttributes({
                        capture: (event.target.value || undefined) as NonNullable<FieldConfig['htmlAttributes']>['capture'],
                      })}
                    >
                      <option value="">Not set</option>
                      <option value="user">Front camera</option>
                      <option value="environment">Back camera</option>
                    </select>
                  </div>
                </div>
              </>
            ) : null}
          </motion.div>

          <motion.div className="fb-property-group" variants={groupVariants} custom={7}>
            <label>Canvas layout</label>
            <div className="fb-device-layout-note">
              <span>Editing {deviceLabel} layout</span>
              {activeDevice !== 'desktop' ? (
                <button type="button" className="fb-device-reset" onClick={clearResponsiveLayout}>
                  Use desktop sizing
                </button>
              ) : (
                <span>Base layout</span>
              )}
            </div>
            <div className="fb-layout-grid">
              {layoutMode === 'flex' ? (
                <div>
                  <label htmlFor="field-width">Flex width %</label>
                  <select
                    id="field-width"
                    className="fb-select"
                    value={widthPresetValue}
                    onChange={(event) => updateResponsiveLayout({
                      width: event.target.value === 'custom'
                        ? effectiveWidth
                        : Number(event.target.value) || 100,
                    })}
                  >
                    {FLEX_WIDTH_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>{preset}%</option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                  {widthPresetValue === 'custom' ? (
                    <input
                      type="number"
                      className="fb-input fb-inline-followup"
                      min={1}
                      max={100}
                      value={effectiveWidth}
                      onChange={(event) => updateResponsiveLayout({
                        width: Number(event.target.value) || 100,
                      })}
                      placeholder="Enter custom width %"
                    />
                  ) : null}
                </div>
              ) : (
                <div>
                  <label htmlFor="field-grid-span">Grid span</label>
                  <select
                    id="field-grid-span"
                    className="fb-select"
                    value={effectiveGridSpan}
                    onChange={(event) => updateResponsiveLayout({
                      gridSpan: Number(event.target.value) || gridColumns,
                    })}
                  >
                    {Array.from({ length: gridColumns }, (_, index) => index + 1).map((span) => (
                      <option key={span} value={span}>
                        Span {span} / {gridColumns}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="field-height">Height px</label>
                <input
                  id="field-height"
                  type="number"
                  className="fb-input"
                  min={76}
                  max={260}
                  value={field.ui?.height ?? 92}
                  onChange={(event) => onUpdateField({
                    ui: {
                      ...field.ui,
                      height: Number(event.target.value) || 92,
                    },
                  })}
                />
              </div>
            </div>
            <div className="fb-layout-grid">
              <div>
                <label htmlFor="field-hidden">Visibility</label>
                <select
                  id="field-hidden"
                  className="fb-select"
                  value={field.ui?.hidden ? 'hidden' : 'visible'}
                  onChange={(event) => onUpdateField({
                    ui: {
                      ...field.ui,
                      hidden: event.target.value === 'hidden',
                    },
                  })}
                >
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
              <div>
                <label htmlFor="field-lock">Movement</label>
                <select
                  id="field-lock"
                  className="fb-select"
                  value={field.ui?.locked ? 'locked' : 'editable'}
                  onChange={(event) => onUpdateField({
                    ui: {
                      ...field.ui,
                      locked: event.target.value === 'locked',
                    },
                  })}
                >
                  <option value="editable">Editable</option>
                  <option value="locked">Locked</option>
                </select>
              </div>
            </div>
          </motion.div>

          {field.type === 'date' ? (
            <motion.div
              className="fb-property-group"
              variants={groupVariants}
              custom={8}
              initial="hidden"
              animate="visible"
            >
              <label htmlFor="field-date-renderer">Calendar rendering</label>
              <select
                id="field-date-renderer"
                className="fb-select"
                value={field.dateConfig?.useCustomCalendar === false ? 'native' : 'custom'}
                onChange={(event) => onUpdateField({
                  dateConfig: {
                    format: dateFormat,
                    locale: field.dateConfig?.locale?.trim() || defaultLocale || 'en',
                    useCustomCalendar: event.target.value === 'custom',
                  },
                })}
              >
                <option value="custom">Custom calendar + formatted value</option>
                <option value="native">Native browser date input</option>
              </select>
              <p className="fb-hint">Use the custom calendar when the client must see the exact configured format.</p>

              <div className="fb-layout-grid">
                <div>
                  <label htmlFor="field-date-format">Date format</label>
                  <select
                    id="field-date-format"
                    className="fb-select"
                    value={dateFormatPresetValue}
                    onChange={(event) => onUpdateField({
                      dateConfig: {
                        format: event.target.value === 'custom' ? dateFormat : event.target.value,
                        locale: field.dateConfig?.locale?.trim() || defaultLocale || 'en',
                        useCustomCalendar: field.dateConfig?.useCustomCalendar !== false,
                      },
                    })}
                  >
                    {dateFormatPresets.map((preset) => (
                      <option key={preset} value={preset}>{preset}</option>
                    ))}
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="field-date-locale">Locale</label>
                  <input
                    id="field-date-locale"
                    className="fb-input"
                    value={field.dateConfig?.locale ?? defaultLocale ?? 'en'}
                    onChange={(event) => onUpdateField({
                      dateConfig: {
                        format: dateFormat,
                        locale: event.target.value,
                        useCustomCalendar: field.dateConfig?.useCustomCalendar !== false,
                      },
                    })}
                    placeholder="en-US"
                  />
                </div>
              </div>

              {dateFormatPresetValue === 'custom' ? (
                <div className="fb-inline-followup-wrap">
                  <input
                    className="fb-input fb-inline-followup"
                    value={dateFormat}
                    onChange={(event) => onUpdateField({
                      dateConfig: {
                        format: event.target.value || DEFAULT_DATE_FORMAT,
                        locale: field.dateConfig?.locale?.trim() || defaultLocale || 'en',
                        useCustomCalendar: field.dateConfig?.useCustomCalendar !== false,
                      },
                    })}
                    placeholder={DEFAULT_DATE_FORMAT}
                  />
                </div>
              ) : null}

              <p className="fb-hint">Preview placeholder: {field.placeholder || getDateFormatPlaceholder(dateFormat)}</p>
            </motion.div>
          ) : null}

          {field.type === 'select' ? (
            <motion.div
              className="fb-property-group"
              variants={groupVariants}
              custom={9}
              initial="hidden"
              animate="visible"
            >
              {field.type === 'select' ? (
                <div className="fb-property-group">
                  <label htmlFor="field-selection-mode">Selection mode</label>
                  <select
                    id="field-selection-mode"
                    className="fb-select"
                    value={field.selectionMode ?? 'single'}
                    onChange={(event) => onUpdateField({
                      selectionMode: event.target.value as 'single' | 'multiple',
                    })}
                  >
                    <option value="single">Single select</option>
                    <option value="multiple">Multi-select</option>
                  </select>
                </div>
              ) : null}

              <label>Options</label>
              <div className="fb-option-list">
                {(field.options ?? []).map((option, optionIndex) => {
                  const normalizedLabelValue = normalizeOptionValue(option.label, `option_${optionIndex + 1}`);
                  const shouldSyncOptionValue = !option.value?.trim() || option.value === normalizedLabelValue;

                  return (
                    <div key={`${option.value}-${optionIndex}`} className="fb-option-row">
                      <input
                        className="fb-input"
                        value={option.label}
                        onChange={(event) => {
                          const nextLabel = event.target.value;
                          const nextOptions = [...(field.options ?? [])];
                          nextOptions[optionIndex] = {
                            ...nextOptions[optionIndex],
                            label: nextLabel,
                            ...(shouldSyncOptionValue
                              ? { value: normalizeOptionValue(nextLabel, `option_${optionIndex + 1}`) }
                              : {}),
                          };
                          onUpdateField({ options: nextOptions });
                        }}
                        placeholder={`Option ${optionIndex + 1} label`}
                      />
                      <input
                        className="fb-input"
                        value={option.value}
                        onChange={(event) => {
                          const nextOptions = [...(field.options ?? [])];
                          nextOptions[optionIndex] = {
                            ...nextOptions[optionIndex],
                            value: normalizeOptionValue(event.target.value, `option_${optionIndex + 1}`),
                          };
                          onUpdateField({ options: nextOptions });
                        }}
                        placeholder={`option_${optionIndex + 1}`}
                      />
                      <button
                        type="button"
                        className="fb-btn fb-btn-ghost fb-btn-icon"
                        onClick={() => onUpdateField({
                          options: (field.options ?? []).filter((_, index) => index !== optionIndex),
                        })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="fb-btn fb-btn-secondary"
                onClick={() => onUpdateField({
                  options: [
                    ...(field.options ?? []),
                    {
                      label: `Option ${(field.options ?? []).length + 1}`,
                      value: `option_${(field.options ?? []).length + 1}`,
                    },
                  ],
                })}
              >
                <Plus className="w-4 h-4" />
                Add option
              </button>
              <p className="fb-hint">Option values are normalized to lowercase_with_underscores. Use the Data Sources tab when the client needs remote options.</p>
            </motion.div>
          ) : null}

          {(field.type === 'radio' || field.type === 'checkbox') ? (
            <motion.div className="fb-property-group" variants={groupVariants} custom={9} initial="hidden" animate="visible">
              <label>Options</label>
              <p className="fb-hint">
                Manage {field.type === 'radio' ? 'radio button' : 'checkbox'} options, field-level conditions, per-option validations, and calculations directly on the selected field in the canvas instead of the properties panel.
              </p>
            </motion.div>
          ) : null}
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          className="fb-property-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <MousePointerClick className="w-10 h-10 mb-4" strokeWidth={1.5} />
          <p>Select a field on the canvas to edit its properties</p>
        </motion.div>
      )}
      </AnimatePresence>

      <div className="fb-rules-section">
        <div className="fb-rules-header">
          <h3>Rules</h3>
          <motion.button
            type="button"
            className="fb-btn fb-btn-primary"
            onClick={onAddRule}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </motion.button>
        </div>

        <AnimatePresence>
          {rules.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="fb-hint"
              style={{ textAlign: 'center', padding: '20px 0' }}
            >
              No rules configured yet
            </motion.p>
          ) : (
            rules.map((rule: Rule, index: number) => (
              <motion.div
                key={rule.id}
                className="fb-rule-card"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="fb-rule-card-header">
                  <strong>{rule.id}</strong>
                  <motion.button
                    type="button"
                    className="fb-btn fb-btn-ghost fb-btn-icon"
                    onClick={() => onDeleteRule(index)}
                    whileHover={{ scale: 1.1, color: '#ef4444' }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>

                <div className="fb-property-group">
                  <label>Depends On</label>
                  <select
                    className="fb-select"
                    multiple
                    value={rule.dependsOn}
                    onChange={(event) => {
                      const dependsOn = Array.from(
                        event.target.selectedOptions as ArrayLike<{ value: string }>
                      ).map((option) => option.value);
                      onUpdateRule(index, { ...rule, dependsOn });
                    }}
                    style={{ minHeight: '80px' }}
                  >
                    {fields.map((candidate: FieldConfig) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fb-property-group">
                  <label>Condition</label>
                  <CodeSuggestionTextarea
                    value={rule.condition}
                    onChange={(nextValue) => onUpdateRule(index, { ...rule, condition: nextValue })}
                    rows={3}
                    suggestions={fieldConditionSuggestions}
                    placeholder="field_value === 'something'"
                  />
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
      </div>
    </aside>
  );
};
