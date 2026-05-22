import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import * as Sortable from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Info,
  Layers,
  Laptop,
  Link2,
  Lock,
  Minus,
  Plus,
  Settings,
  Smartphone,
  Tablet,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type {
  ChoiceCondition,
  ChoiceConditionScope,
  ChoiceConditionType,
  FieldConfig,
  FieldOption,
  FormConnection,
  ResponsiveDevice,
  Rule,
} from '../../types/schema';
import { getDateFormatPlaceholder, normalizeOptionValue } from '../../lib/formBuilder';

const useSortable = (Sortable as any).useSortable as (args: any) => any;

interface FormCanvasProps {
  fields: FieldConfig[];
  rules: Rule[];
  connections: FormConnection[];
  layout: {
    device: ResponsiveDevice;
    mode: 'flex' | 'grid';
    columns: number;
    gap: number;
    canvasWidth: number;
    viewportOptions: number[];
  };
  activeDevice: ResponsiveDevice;
  selectedFieldId: string | null;
  activeDragFieldId?: string | null;
  dragOverFieldId?: string | null;
  onDeviceChange?: (device: ResponsiveDevice) => void;
  onSelectField: (fieldId: string) => void;
  onDeleteField: (fieldId: string) => void;
  onConnectionsChange?: (connections: FormConnection[]) => void;
  onLayoutChange?: (updates: { mode?: 'flex' | 'grid'; columns?: number; gap?: number; canvasWidth?: number }) => void;
  onDuplicateField?: (fieldId: string) => void;
  onUpdateField?: (fieldId: string, updates: Partial<FieldConfig>) => void;
  onReorderFields?: (fields: FieldConfig[]) => void;
}

interface LayoutSize {
  width: number;
  height: number;
  gridSpan?: number;
}

const MIN_FLEX_WIDTH = 25;
const MAX_FLEX_WIDTH = 100;

const defaultSize: LayoutSize = {
  width: 100,
  height: 92,
};

const deviceDefinitions: Array<{ id: ResponsiveDevice; label: string; icon: FC<any> }> = [
  { id: 'desktop', label: 'Desktop', icon: Laptop },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

const getFieldName = (field: FieldConfig) => (field.name?.trim() || field.id).trim();

const getFieldSize = (field: FieldConfig, device: ResponsiveDevice): LayoutSize => {
  const responsive = field.ui?.responsive?.[device];

  return {
    width: responsive?.width ?? field.ui?.width ?? defaultSize.width,
    height: field.ui?.height ?? defaultSize.height,
    gridSpan: responsive?.gridSpan ?? field.ui?.gridSpan ?? 12,
  };
};

const getValidationColor = (type: FormConnection['validationType'], isHovered: boolean) => {
  const opacity = isHovered ? 0.95 : 0.18;

  if (type === 'error') {
    return `rgba(239, 68, 68, ${opacity})`;
  }

  if (type === 'warning') {
    return `rgba(245, 158, 11, ${opacity})`;
  }

  return `rgba(34, 197, 94, ${opacity})`;
};

const createChoiceCondition = (type: ChoiceConditionType = 'validation'): ChoiceCondition => ({
  id: `choice_condition_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  scope: 'same-form',
  type,
  condition: 'true',
  message: type === 'validation' ? 'Validation failed' : type === 'warning' ? 'Check this option' : 'Condition passed',
  calculation: {
    expression: '0',
    outputType: 'number',
  },
  httpConfig: {
    eventName: '',
    url: '',
    method: 'GET',
    valuePath: '$.data',
    successCondition: 'true',
  },
});

const CHOICE_CONDITION_TYPE_OPTIONS: Array<{ value: ChoiceConditionType; label: string }> = [
  { value: 'validation', label: 'Validation error' },
  { value: 'warning', label: 'Warning' },
  { value: 'success', label: 'Success' },
  { value: 'calculation', label: 'Calculation' },
];

const CHOICE_CONDITION_SCOPE_OPTIONS: Array<{ value: ChoiceConditionScope; label: string }> = [
  { value: 'same-form', label: 'Same form' },
  { value: 'other-form', label: 'Other form' },
  { value: 'http-event', label: 'HTTP event' },
];

const RadialMenu: FC<{
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: string) => void;
}> = ({ isOpen, position, onClose, onAction }) => {
  const menuItems = [
    { id: 'connect', icon: Link2, label: 'Connect', angle: 0 },
    { id: 'duplicate', icon: Copy, label: 'Duplicate', angle: 45 },
    { id: 'visibility', icon: Eye, label: 'Visibility', angle: 90 },
    { id: 'lock', icon: Lock, label: 'Lock', angle: 135 },
    { id: 'settings', icon: Settings, label: 'Settings', angle: 180 },
    { id: 'moveUp', icon: ChevronUp, label: 'Move up', angle: 225 },
    { id: 'moveDown', icon: ChevronDown, label: 'Move down', angle: 270 },
    { id: 'delete', icon: Trash2, label: 'Delete', angle: 315 },
  ];

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            className="radial-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="radial-menu"
            style={{ left: position.x, top: position.y }}
            initial={{ scale: 0.75, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.75, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 24 }}
          >
            <button type="button" className="radial-center" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
            {menuItems.map((item, index) => {
              const angleRad = (item.angle * Math.PI) / 180;
              const x = Math.cos(angleRad) * 70;
              const y = Math.sin(angleRad) * 70;
              const Icon = item.icon;

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  className={`radial-item ${item.id === 'delete' ? 'radial-item-danger' : ''}`}
                  style={{
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    transition: { delay: index * 0.025, type: 'spring', stiffness: 440 },
                  }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onAction(item.id)}
                  title={item.label}
                >
                  <Icon className="w-4 h-4" />
                </motion.button>
              );
            })}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
};

const ConnectionModal: FC<{
  isOpen: boolean;
  sourceField: FieldConfig | null;
  fields: FieldConfig[];
  onClose: () => void;
  onCreateConnection: (connection: Omit<FormConnection, 'id'>) => void;
}> = ({ isOpen, sourceField, fields, onClose, onCreateConnection }) => {
  const [targetId, setTargetId] = useState('');
  const [connectionType, setConnectionType] = useState<FormConnection['type']>('dependency');
  const [operator, setOperator] = useState<FormConnection['operator']>('equals');
  const [validationType, setValidationType] = useState<FormConnection['validationType']>('warning');

  useEffect(() => {
    if (!isOpen) {
      setTargetId('');
      setConnectionType('dependency');
      setOperator('equals');
      setValidationType('warning');
    }
  }, [isOpen]);

  const availableTargets = useMemo(
    () => fields.filter((field) => field.id !== sourceField?.id),
    [fields, sourceField?.id],
  );

  const handleCreate = () => {
    if (!sourceField || !targetId) {
      return;
    }

    onCreateConnection({
      sourceId: sourceField.id,
      targetId,
      type: connectionType,
      operator,
      validationType,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="connection-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="connection-modal"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 18 }}
            onClick={(event: any) => event.stopPropagation()}
          >
            <div className="connection-modal-header">
              <h3>Create connection</h3>
              <p>Map {sourceField?.label ?? 'field'} to another field with logic and validation.</p>
            </div>

            <div className="connection-modal-body">
              <div className="connection-form-group">
                <label htmlFor="connection-target">Target field</label>
                <select
                  id="connection-target"
                  value={targetId}
                  onChange={(event: any) => setTargetId(event.target.value)}
                  className="fb-select"
                >
                  <option value="">Select a field...</option>
                  {availableTargets.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.label} · {getFieldName(field)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="connection-form-group">
                <label>Connection type</label>
                <div className="connection-type-buttons">
                  {(['dependency', 'validation', 'calculation'] as const).map((type) => (
                    <motion.button
                      key={type}
                      type="button"
                      className={`connection-type-btn ${connectionType === type ? 'active' : ''}`}
                      onClick={() => setConnectionType(type)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {type}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="connection-form-group">
                <label htmlFor="connection-operator">Operator</label>
                <select
                  id="connection-operator"
                  value={operator}
                  onChange={(event: any) => setOperator(event.target.value as FormConnection['operator'])}
                  className="fb-select"
                >
                  <optgroup label="Logical">
                    <option value="equals">Equals</option>
                    <option value="notEquals">Not equals</option>
                    <option value="greaterThan">Greater than</option>
                    <option value="lessThan">Less than</option>
                    <option value="contains">Contains</option>
                  </optgroup>
                  <optgroup label="Arithmetic">
                    <option value="add">Add (+)</option>
                    <option value="subtract">Subtract (-)</option>
                    <option value="multiply">Multiply (×)</option>
                    <option value="divide">Divide (÷)</option>
                  </optgroup>
                </select>
              </div>

              <div className="connection-form-group">
                <label>Validation type</label>
                <div className="validation-type-buttons">
                  {([
                    ['error', XCircle, 'validation-error', 'Error'],
                    ['warning', AlertTriangle, 'validation-warning', 'Warning'],
                    ['success', CheckCircle2, 'validation-success', 'Success'],
                  ] as const).map(([value, Icon, className, label]) => (
                    <motion.button
                      key={value}
                      type="button"
                      className={`validation-btn ${className} ${validationType === value ? 'active' : ''}`}
                      onClick={() => setValidationType(value)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            <div className="connection-modal-footer">
              <button type="button" className="fb-btn fb-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="fb-btn fb-btn-primary" onClick={handleCreate} disabled={!targetId}>
                <Link2 className="w-4 h-4" />
                Create connection
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const ConnectionLines: FC<{
  connections: FormConnection[];
  fieldPositions: Map<string, DOMRect>;
  hoveredFieldId: string | null;
  containerRef: { current: HTMLDivElement | null };
}> = ({ connections, fieldPositions, hoveredFieldId, containerRef }) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) {
        return;
      }

      setSize({
        width: containerRef.current.scrollWidth,
        height: containerRef.current.scrollHeight,
      });
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [containerRef, fieldPositions, connections.length]);

  return (
    <svg className="connection-lines-svg" width={size.width} height={size.height}>
      <defs>
        <marker id="arrowhead-error" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
        </marker>
        <marker id="arrowhead-warning" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
        </marker>
        <marker id="arrowhead-success" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
        </marker>
      </defs>

      {connections.map((connection) => {
        const sourceRect = fieldPositions.get(connection.sourceId);
        const targetRect = fieldPositions.get(connection.targetId);

        if (!sourceRect || !targetRect || !containerRef.current) {
          return null;
        }

        const containerRect = containerRef.current.getBoundingClientRect();
        const startX = sourceRect.right - containerRect.left + containerRef.current.scrollLeft - 8;
        const startY = sourceRect.top + sourceRect.height / 2 - containerRect.top + containerRef.current.scrollTop;
        const endX = targetRect.left - containerRect.left + containerRef.current.scrollLeft + 8;
        const endY = targetRect.top + targetRect.height / 2 - containerRect.top + containerRef.current.scrollTop;
        const controlPointX = startX + (endX - startX) / 2;
        const isHovered = hoveredFieldId === connection.sourceId || hoveredFieldId === connection.targetId;

        return (
          <motion.g key={connection.id}>
            <motion.path
              d={`M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`}
              fill="none"
              stroke={getValidationColor(connection.validationType, isHovered)}
              strokeWidth={isHovered ? 3 : 2}
              strokeDasharray={isHovered ? '0' : '7 6'}
              markerEnd={isHovered ? `url(#arrowhead-${connection.validationType})` : undefined}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
            {isHovered ? (
              <motion.g initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}>
                <rect
                  x={controlPointX - 38}
                  y={(startY + endY) / 2 - 13}
                  width={76}
                  height={26}
                  rx={7}
                  fill="#ffffff"
                  stroke={getValidationColor(connection.validationType, true)}
                  strokeWidth={1}
                />
                <text
                  x={controlPointX}
                  y={(startY + endY) / 2 + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#171717"
                >
                  {connection.operator}
                </text>
              </motion.g>
            ) : null}
          </motion.g>
        );
      })}
    </svg>
  );
};

const FieldPreview: FC<{ field: FieldConfig }> = ({ field }) => {
  const placeholder = field.type === 'date'
    ? field.placeholder?.trim() || getDateFormatPlaceholder(field.dateConfig?.format)
    : field.type === 'select' && field.selectionMode === 'multiple'
      ? field.placeholder?.trim() || 'Select one or more options'
      : field.placeholder?.trim() || `Enter ${field.label.toLowerCase()}`;
  const previewOptions = field.options?.length
    ? field.options.slice(0, 3)
    : [
        { value: 'option_1', label: 'Option one' },
        { value: 'option_2', label: 'Option two' },
        { value: 'option_3', label: 'Option three' },
      ];

  const previewLabel = (
    <div className="field-preview-heading">
      <span className="field-preview-label">
        {field.label}
        {field.required ? <span className="field-preview-required">*</span> : null}
      </span>
      <span className="field-preview-caption">{field.name?.trim() || field.id}</span>
    </div>
  );

  if (field.type === 'textarea') {
    return (
      <div className="field-preview-frame">
        {previewLabel}
        <textarea
          className="field-preview-input field-preview-textarea"
          placeholder={placeholder}
          rows={3}
          readOnly
        />
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="field-preview-frame">
        {previewLabel}
        <div className="field-preview-control field-preview-select">
          <span className="field-preview-placeholder">{placeholder || (field.selectionMode === 'multiple' ? 'Select options' : 'Select an option')}</span>
        </div>
        <div className="field-preview-chips">
          {previewOptions.map((option) => (
            <span key={option.value} className="field-preview-chip">{option.label}</span>
          ))}
        </div>
        {field.selectionMode === 'multiple' ? <span className="field-preview-caption">Multiple selection enabled</span> : null}
      </div>
    );
  }

  if (field.type === 'checkbox' || field.type === 'radio') {
    return (
      <div className="field-preview-frame">
        {previewLabel}
        <div className="field-preview-options-list">
          {previewOptions.map((option, index) => (
            <label key={option.value} className="field-preview-choice">
              <span className={`field-preview-choice-indicator ${field.type === 'radio' ? 'radio' : 'checkbox'} ${index === 0 ? 'checked' : ''}`} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'file') {
    return (
      <div className="field-preview-frame">
        {previewLabel}
        <div className="field-preview-control field-preview-file">
          <span className="field-preview-file-button">Choose file</span>
          <span className="field-preview-placeholder">{placeholder || 'No file selected'}</span>
        </div>
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="field-preview-frame">
        {previewLabel}
        <div className="field-preview-control field-preview-date">
          <span className="field-preview-placeholder">{placeholder || 'YYYY-MM-DD'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="field-preview-frame">
      {previewLabel}
      <input
        className="field-preview-input"
        type={field.type === 'number' ? 'number' : 'text'}
        placeholder={placeholder}
        readOnly
      />
    </div>
  );
};

const ChoiceConditionEditor: FC<{
  title: string;
  description: string;
  conditions: ChoiceCondition[];
  onChange: (conditions: ChoiceCondition[]) => void;
}> = ({ title, description, conditions, onChange }) => {
  const updateCondition = (conditionId: string, updates: Partial<ChoiceCondition>) => {
    onChange(conditions.map((condition) => (
      condition.id === conditionId
        ? {
            ...condition,
            ...updates,
            calculation: {
              expression: updates.calculation?.expression ?? condition.calculation?.expression ?? '0',
              outputType: updates.calculation?.outputType ?? condition.calculation?.outputType ?? 'number',
            },
            httpConfig: {
              eventName: updates.httpConfig?.eventName ?? condition.httpConfig?.eventName ?? '',
              url: updates.httpConfig?.url ?? condition.httpConfig?.url ?? '',
              method: updates.httpConfig?.method ?? condition.httpConfig?.method ?? 'GET',
              valuePath: updates.httpConfig?.valuePath ?? condition.httpConfig?.valuePath ?? '$.data',
              successCondition: updates.httpConfig?.successCondition ?? condition.httpConfig?.successCondition ?? 'true',
            },
          }
        : condition
    )));
  };

  return (
    <div className="field-inline-condition-editor">
      <div className="field-inline-condition-header">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <button
          type="button"
          className="fb-btn fb-btn-secondary"
          onClick={() => onChange([...conditions, createChoiceCondition()])}
        >
          <Plus className="w-4 h-4" />
          Add condition
        </button>
      </div>

      {conditions.length > 0 ? (
        <div className="field-inline-condition-list">
          {conditions.map((condition, conditionIndex) => (
            <div key={condition.id} className="field-inline-condition-card">
              <div className="field-inline-condition-topbar">
                <span>Condition {conditionIndex + 1}</span>
                <button
                  type="button"
                  className="fb-btn fb-btn-ghost fb-btn-icon"
                  onClick={() => onChange(conditions.filter((candidate) => candidate.id !== condition.id))}
                  aria-label={`Delete condition ${conditionIndex + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="field-inline-condition-grid">
                <label className="field-inline-option-input-group">
                  <span>Source</span>
                  <select
                    className="fb-select"
                    value={condition.scope}
                    onChange={(event) => updateCondition(condition.id, {
                      scope: event.target.value as ChoiceConditionScope,
                    })}
                  >
                    {CHOICE_CONDITION_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>

                <label className="field-inline-option-input-group">
                  <span>Type</span>
                  <select
                    className="fb-select"
                    value={condition.type}
                    onChange={(event) => updateCondition(condition.id, {
                      type: event.target.value as ChoiceConditionType,
                    })}
                  >
                    {CHOICE_CONDITION_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {condition.scope === 'other-form' ? (
                <div className="field-inline-condition-grid">
                  <label className="field-inline-option-input-group">
                    <span>Form ID</span>
                    <input
                      className="fb-input"
                      value={condition.otherFormId ?? ''}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateCondition(condition.id, { otherFormId: event.target.value })}
                      placeholder="externalForm"
                    />
                  </label>
                  <label className="field-inline-option-input-group">
                    <span>Field key</span>
                    <input
                      className="fb-input"
                      value={condition.otherFieldId ?? ''}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateCondition(condition.id, { otherFieldId: event.target.value })}
                      placeholder="status"
                    />
                  </label>
                </div>
              ) : null}

              {condition.scope === 'http-event' ? (
                <>
                  <div className="field-inline-condition-grid">
                    <label className="field-inline-option-input-group">
                      <span>Event name</span>
                      <input
                        className="fb-input"
                        value={condition.httpConfig?.eventName ?? ''}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) => updateCondition(condition.id, {
                          httpConfig: {
                            ...condition.httpConfig,
                            eventName: event.target.value,
                          },
                        })}
                        placeholder="validateOption"
                      />
                    </label>
                    <label className="field-inline-option-input-group">
                      <span>Method</span>
                      <select
                        className="fb-select"
                        value={condition.httpConfig?.method ?? 'GET'}
                        onChange={(event) => updateCondition(condition.id, {
                          httpConfig: {
                            ...condition.httpConfig,
                            method: event.target.value as 'GET' | 'POST' | 'PUT',
                          },
                        })}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </label>
                  </div>
                  <label className="field-inline-option-input-group">
                    <span>URL</span>
                    <input
                      className="fb-input"
                      value={condition.httpConfig?.url ?? ''}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateCondition(condition.id, {
                        httpConfig: {
                          ...condition.httpConfig,
                          url: event.target.value,
                        },
                      })}
                      placeholder="https://api.example.com/validate"
                    />
                  </label>
                  <div className="field-inline-condition-grid">
                    <label className="field-inline-option-input-group">
                      <span>Value path</span>
                      <input
                        className="fb-input"
                        value={condition.httpConfig?.valuePath ?? '$.data'}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) => updateCondition(condition.id, {
                          httpConfig: {
                            ...condition.httpConfig,
                            valuePath: event.target.value,
                          },
                        })}
                        placeholder="$.data.valid"
                      />
                    </label>
                    <label className="field-inline-option-input-group">
                      <span>Success condition</span>
                      <input
                        className="fb-input"
                        value={condition.httpConfig?.successCondition ?? 'true'}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) => updateCondition(condition.id, {
                          httpConfig: {
                            ...condition.httpConfig,
                            successCondition: event.target.value,
                          },
                        })}
                        placeholder="response?.valid === true"
                      />
                    </label>
                  </div>
                </>
              ) : null}

              <label className="field-inline-option-input-group">
                <span>When</span>
                <textarea
                  className="fb-input field-inline-condition-textarea"
                  value={condition.condition}
                  rows={3}
                  onKeyDown={(event) => event.stopPropagation()}
                  onChange={(event) => updateCondition(condition.id, { condition: event.target.value })}
                  placeholder={condition.scope === 'same-form'
                    ? 'values.country === "US" && values.age >= 18'
                    : condition.scope === 'other-form'
                      ? 'forms.orderForm?.status === "approved"'
                      : 'response?.valid === true'}
                />
              </label>

              {condition.type === 'calculation' ? (
                <div className="field-inline-condition-grid">
                  <label className="field-inline-option-input-group">
                    <span>Calculation</span>
                    <input
                      className="fb-input"
                      value={condition.calculation?.expression ?? '0'}
                      onKeyDown={(event) => event.stopPropagation()}
                      onChange={(event) => updateCondition(condition.id, {
                        calculation: {
                          expression: event.target.value,
                          outputType: condition.calculation?.outputType ?? 'number',
                        },
                      })}
                      placeholder='Number(values.quantity) * 10'
                    />
                  </label>
                  <label className="field-inline-option-input-group">
                    <span>Output type</span>
                    <select
                      className="fb-select"
                      value={condition.calculation?.outputType ?? 'number'}
                      onChange={(event) => updateCondition(condition.id, {
                        calculation: {
                          expression: condition.calculation?.expression ?? '0',
                          outputType: event.target.value as 'string' | 'number',
                        },
                      })}
                    >
                      <option value="number">Number</option>
                      <option value="string">String</option>
                    </select>
                  </label>
                </div>
              ) : (
                <label className="field-inline-option-input-group">
                  <span>Message</span>
                  <input
                    className="fb-input"
                    value={condition.message ?? ''}
                    onKeyDown={(event) => event.stopPropagation()}
                    onChange={(event) => updateCondition(condition.id, { message: event.target.value })}
                    placeholder={condition.type === 'success' ? 'Option is valid' : 'Explain this condition'}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="field-inline-options-empty">No conditions yet.</p>
      )}
    </div>
  );
};

const ChoiceOptionsEditor: FC<{
  field: FieldConfig;
  onUpdateField?: (fieldId: string, updates: Partial<FieldConfig>) => void;
}> = ({ field, onUpdateField }) => {
  if (!onUpdateField || (field.type !== 'checkbox' && field.type !== 'radio' && field.type !== 'select')) {
    return null;
  }

  const isSelectField = field.type === 'select';
  const options = field.options ?? [];
  const [expandedOptionId, setExpandedOptionId] = useState<string | null>(null);
  const [isSelectOptionsModalOpen, setIsSelectOptionsModalOpen] = useState(false);

  const renderOptionsList = () => {
    if (options.length === 0) {
      return (
        <p className="field-inline-options-empty">
          No options yet. Add the first choice to turn this into a selectable group.
        </p>
      );
    }

    return (
      <div className="field-inline-options-list">
        {options.map((option, optionIndex) => {
          const normalizedLabelValue = normalizeOptionValue(option.label, `option_${optionIndex + 1}`);
          const shouldSyncOptionValue = !option.value?.trim() || option.value === normalizedLabelValue;
          const isExpanded = expandedOptionId === option.value;

          return (
            <div key={`${option.value}-${optionIndex}`} className="field-inline-option-card">
              <div className="field-inline-option-row">
                <label className="field-inline-option-input-group">
                  <span>Label</span>
                  <input
                    className="fb-input"
                    value={option.label}
                    onKeyDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const nextLabel = event.target.value;
                      const nextOptions = [...options];
                      nextOptions[optionIndex] = {
                        ...nextOptions[optionIndex],
                        label: nextLabel,
                        ...(shouldSyncOptionValue
                          ? { value: normalizeOptionValue(nextLabel, `option_${optionIndex + 1}`) }
                          : {}),
                      };
                      onUpdateField(field.id, { options: nextOptions });
                    }}
                    placeholder={`Option ${optionIndex + 1} label`}
                  />
                </label>
                <label className="field-inline-option-input-group">
                  <span>Value</span>
                  <input
                    className="fb-input"
                    value={option.value}
                    onKeyDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const nextOptions = [...options];
                      nextOptions[optionIndex] = {
                        ...nextOptions[optionIndex],
                        value: normalizeOptionValue(event.target.value, `option_${optionIndex + 1}`),
                      };
                      onUpdateField(field.id, { options: nextOptions });
                    }}
                    placeholder={`option_${optionIndex + 1}`}
                  />
                </label>
                <div className="field-inline-option-actions">
                  <button
                    type="button"
                    className="fb-btn fb-btn-ghost field-inline-option-toggle"
                    onClick={() => setExpandedOptionId(isExpanded ? null : option.value)}
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    Conditions
                  </button>
                  <button
                    type="button"
                    className="fb-btn fb-btn-ghost fb-btn-icon"
                    onClick={() => onUpdateField(field.id, {
                      options: options.filter((_, index) => index !== optionIndex),
                    })}
                    aria-label={`Delete option ${optionIndex + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isExpanded ? (
                <ChoiceConditionEditor
                  title={`${option.label || `Option ${optionIndex + 1}`} conditions`}
                  description="Set validation, warnings, success states, or calculated values for this option. Number calculations are stored as numbers for the runtime core."
                  conditions={option.conditions ?? []}
                  onChange={(conditions) => {
                    const nextOptions = [...options] as FieldOption[];
                    nextOptions[optionIndex] = {
                      ...nextOptions[optionIndex],
                      conditions,
                    };
                    onUpdateField(field.id, { options: nextOptions });
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="field-inline-options-editor"
      onClick={(event: any) => event.stopPropagation()}
      onMouseDown={(event: any) => event.stopPropagation()}
      onKeyDown={(event: any) => event.stopPropagation()}
    >
      {!isSelectField ? (
        <div className="field-inline-options-header">
          <div>
            <strong>
              {field.type === 'radio'
                ? 'Radio options'
                : 'Checkbox options'}
            </strong>
            <p>Manage choices directly on the canvas.</p>
          </div>
          <button
            type="button"
            className="fb-btn fb-btn-secondary field-inline-options-add"
            onClick={() => onUpdateField(field.id, {
              options: [
                ...options,
                {
                  label: `Option ${options.length + 1}`,
                  value: `option_${options.length + 1}`,
                },
              ],
            })}
          >
            <Plus className="w-4 h-4" />
            Add option
          </button>
        </div>
      ) : null}

      <ChoiceConditionEditor
        title={field.type === 'radio'
          ? 'Field-level conditions'
          : field.type === 'checkbox'
            ? 'Checkbox group conditions'
            : 'Select field conditions'}
        description="Apply validation, warnings, success states, or calculations to the whole field. Same-form conditions are previewed immediately; other-form and HTTP event conditions are saved for runtime orchestration."
        conditions={field.choiceConditions ?? []}
        onChange={(choiceConditions) => onUpdateField(field.id, { choiceConditions })}
      />

      {isSelectField ? (
        <div className="field-inline-options-modal-trigger-row">
          <button
            type="button"
            className="fb-btn fb-btn-secondary"
            onClick={() => setIsSelectOptionsModalOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Open Select Options
          </button>
          <span className="field-inline-options-count">{options.length} option{options.length === 1 ? '' : 's'}</span>
        </div>
      ) : renderOptionsList()}

      <AnimatePresence>
        {isSelectField && isSelectOptionsModalOpen ? (
          <motion.div
            className="select-options-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSelectOptionsModalOpen(false)}
          >
            <motion.div
              className="select-options-modal"
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              onClick={(event: any) => event.stopPropagation()}
            >
              <div className="select-options-modal-header">
                <div>
                  <h3>Select Options</h3>
                </div>
                <button
                  type="button"
                  className="fb-btn fb-btn-ghost fb-btn-icon"
                  onClick={() => setIsSelectOptionsModalOpen(false)}
                  aria-label="Close select options modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="select-options-modal-body">
                {renderOptionsList()}
              </div>
              <div className="select-options-modal-footer">
                <button
                  type="button"
                  className="fb-btn fb-btn-secondary"
                  onClick={() => onUpdateField(field.id, {
                    options: [
                      ...options,
                      {
                        label: `Option ${options.length + 1}`,
                        value: `option_${options.length + 1}`,
                      },
                    ],
                  })}
                >
                  <Plus className="w-4 h-4" />
                  Add option
                </button>
                <button
                  type="button"
                  className="fb-btn fb-btn-secondary"
                  onClick={() => setIsSelectOptionsModalOpen(false)}
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

interface SortableFieldItemProps {
  field: FieldConfig;
  index: number;
  device: ResponsiveDevice;
  isSelected: boolean;
  layoutMode: 'flex' | 'grid';
  gridColumns: number;
  activeDragFieldId: string | null;
  dragOverFieldId: string | null;
  dragGapPosition: 'before' | 'after' | null;
  duplicateNames: Set<string>;
  connections: FormConnection[];
  onUpdateField?: (fieldId: string, updates: Partial<FieldConfig>) => void;
  onSelect: () => void;
  onOpenMenu: (fieldId: string, event: any) => void;
  onResize: (fieldId: string, size: LayoutSize) => void;
  onPositionUpdate: (fieldId: string, rect: DOMRect) => void;
  onHover: (fieldId: string | null) => void;
}

const SortableFieldItem = forwardRef<HTMLDivElement, SortableFieldItemProps>(({
  field,
  index,
  device,
  isSelected,
  layoutMode,
  gridColumns,
  activeDragFieldId,
  dragOverFieldId,
  dragGapPosition,
  duplicateNames,
  connections,
  onUpdateField,
  onSelect,
  onOpenMenu,
  onResize,
  onPositionUpdate,
  onHover,
}, forwardedRef) => {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: field.ui?.locked,
  });
  const stableTransform = transform
    ? {
        ...transform,
        scaleX: 1,
        scaleY: 1,
      }
    : null;

  const size = getFieldSize(field, device);
  const fieldName = getFieldName(field);
  const isDuplicate = duplicateNames.has(fieldName.toLowerCase());
  const connectionCount = connections.filter(
    (connection) => connection.sourceId === field.id || connection.targetId === field.id,
  ).length;
  const isDragTarget = dragOverFieldId === field.id && activeDragFieldId !== field.id;

  useEffect(() => {
    if (fieldRef.current) {
      onPositionUpdate(field.id, fieldRef.current.getBoundingClientRect());
    }
  }, [field.id, size.width, size.height, onPositionUpdate, isDragging]);

  useEffect(() => {
    const handleWindowUpdate = () => {
      if (fieldRef.current) {
        onPositionUpdate(field.id, fieldRef.current.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', handleWindowUpdate);
    return () => window.removeEventListener('resize', handleWindowUpdate);
  }, [field.id, onPositionUpdate]);

  const handleResizeStart = (event: any, direction: 'left' | 'right' | 'bottom' | 'corner') => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const containerWidth = fieldRef.current?.parentElement?.clientWidth ?? 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const widthDelta = direction === 'left'
        ? (-deltaX / containerWidth) * 100
        : (deltaX / containerWidth) * 100;
      const nextWidth = direction === 'bottom'
        ? startWidth
        : Math.max(MIN_FLEX_WIDTH, Math.min(MAX_FLEX_WIDTH, startWidth + widthDelta));
      const nextHeight = direction === 'left' || direction === 'right'
        ? startHeight
        : Math.max(76, Math.min(260, startHeight + deltaY));
      const columnWidth = containerWidth / Math.max(gridColumns, 1);
      const nextGridSpan = Math.max(
        1,
        Math.min(
          gridColumns,
          Math.round(
            (size.gridSpan ?? gridColumns)
            + ((direction === 'left' ? -deltaX : deltaX) / Math.max(columnWidth, 1)),
          ),
        ),
      );

      onResize(field.id, {
        width: Number(nextWidth.toFixed(1)),
        height: Math.round(nextHeight),
        gridSpan: nextGridSpan,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={(node: HTMLDivElement | null) => {
        setNodeRef(node);
        fieldRef.current = node;

        if (!forwardedRef) {
          return;
        }

        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
          return;
        }

        forwardedRef.current = node;
      }}
      className={[
        'canvas-field-item-shell',
        isDragging ? 'dragging-active' : '',
        isDragTarget ? 'drag-over-target' : '',
        dragGapPosition ? `drag-gap-${dragGapPosition}` : '',
      ].filter(Boolean).join(' ')}
      style={{
        width: layoutMode === 'flex' ? `${Math.min(Math.max(size.width, MIN_FLEX_WIDTH), MAX_FLEX_WIDTH)}%` : '100%',
        maxWidth: '100%',
        gridColumn: layoutMode === 'grid'
          ? `span ${Math.min(size.gridSpan ?? gridColumns, gridColumns)} / span ${Math.min(size.gridSpan ?? gridColumns, gridColumns)}`
          : undefined,
        transform: CSS.Transform.toString(stableTransform),
        transition: isDragging ? undefined : transition,
        zIndex: isDragging ? 30 : 1,
        willChange: isDragging ? 'transform' : undefined,
      }}
    >
      <motion.div
        className={[
          'canvas-field-item',
          isSelected ? 'selected' : '',
          field.ui?.locked ? 'locked' : '',
          field.ui?.hidden ? 'hidden-field' : '',
          isDragging ? 'dragging' : '',
        ].filter(Boolean).join(' ')}
        style={{
          minHeight: `${size.height}px`,
        }}
        {...attributes}
        {...listeners}
        onClick={onSelect}
        onContextMenu={(event: any) => {
          event.preventDefault();
          onOpenMenu(field.id, event);
        }}
        onMouseEnter={() => onHover(field.id)}
        onMouseLeave={() => onHover(null)}
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: field.ui?.hidden ? 0.56 : 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92, x: -18 }}
        whileHover={isDragging ? undefined : { y: -2 }}
        transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      >
      <div className="field-number">{index + 1}</div>

      <button
        type="button"
        className="field-drag-handle"
        aria-label={`Drag ${field.label}`}
        onClick={(event: any) => event.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <div className="field-content">
        <div className="field-preview-shell">
          <FieldPreview field={field} />
        </div>
        {isSelected ? <ChoiceOptionsEditor field={field} onUpdateField={onUpdateField} /> : null}
      </div>

      <div className="field-overlay-tools">
        <div className="field-info-anchor" onClick={(event: any) => event.stopPropagation()}>
          <button type="button" className="field-info-trigger" aria-label={`Show ${field.label} details`}>
            <Info className="w-4 h-4" />
          </button>
          <div className="field-info-popover">
            <div className="field-info-header">
              <div className="field-label-group">
                <span className="field-label">{field.label}</span>
                <span className="field-type-badge">{field.type}</span>
                {field.required ? <span className="field-required-dot" title="Required" /> : null}
              </div>
              <div className="field-status-icons">
                {field.ui?.locked ? <Lock className="w-3.5 h-3.5" /> : null}
                {field.ui?.hidden ? <EyeOff className="w-3.5 h-3.5" /> : null}
                {connectionCount > 0 ? (
                  <span className="connection-badge">
                    <Link2 className="w-3 h-3" />
                    {connectionCount}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="field-info-grid">
              <div>
                <span>Name</span>
                <strong>{fieldName}</strong>
              </div>
              <div>
                <span>ID</span>
                <strong className="field-id">{field.id}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{layoutMode === 'grid' ? `Span ${Math.min(size.gridSpan ?? gridColumns, gridColumns)}/${gridColumns}` : `${size.width}%`} · {size.height}px</strong>
              </div>
            </div>
            {isDuplicate ? (
              <div className="field-info-warning">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Duplicate input name detected.</span>
              </div>
            ) : null}
          </div>
        </div>

        <motion.button
          type="button"
          className="field-menu-trigger"
          onClick={(event: any) => {
            event.stopPropagation();
            onOpenMenu(field.id, event);
          }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
        >
          <Plus className="w-4 h-4" />
        </motion.button>
      </div>

      {isSelected && !field.ui?.locked ? (
        <>
          <div className="resize-handle resize-handle-left" onMouseDown={(event: any) => handleResizeStart(event, 'left')} />
          <div className="resize-handle resize-handle-right" onMouseDown={(event: any) => handleResizeStart(event, 'right')} />
          <div className="resize-handle resize-handle-bottom" onMouseDown={(event: any) => handleResizeStart(event, 'bottom')} />
          <div className="resize-handle resize-handle-corner" onMouseDown={(event: any) => handleResizeStart(event, 'corner')} />
        </>
      ) : null}
      </motion.div>
    </div>
  );
});

export const FormCanvas: FC<FormCanvasProps> = ({
  fields,
  rules,
  connections,
  layout,
  activeDevice,
  selectedFieldId,
  activeDragFieldId,
  dragOverFieldId,
  onDeviceChange,
  onSelectField,
  onDeleteField,
  onConnectionsChange,
  onLayoutChange,
  onDuplicateField,
  onUpdateField,
  onReorderFields,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [radialMenuState, setRadialMenuState] = useState<{
    isOpen: boolean;
    fieldId: string | null;
    position: { x: number; y: number };
  }>({ isOpen: false, fieldId: null, position: { x: 0, y: 0 } });
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [fieldPositions, setFieldPositions] = useState<Map<string, DOMRect>>(new Map());
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);

  const duplicateNames = useMemo(() => {
    const names = new Map<string, number>();

    fields.forEach((field) => {
      const key = getFieldName(field).toLowerCase();
      names.set(key, (names.get(key) ?? 0) + 1);
    });

    return new Set(Array.from(names.entries()).filter(([, count]) => count > 1).map(([name]) => name));
  }, [fields]);

  const handleOpenRadialMenu = useCallback((fieldId: string, event: any) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setRadialMenuState({
      isOpen: true,
      fieldId,
      position: {
        x: rect.right + 24,
        y: rect.top + rect.height / 2,
      },
    });
  }, []);

  const closeRadialMenu = useCallback(() => {
    setRadialMenuState({ isOpen: false, fieldId: null, position: { x: 0, y: 0 } });
  }, []);

  const handlePositionUpdate = useCallback((fieldId: string, rect: DOMRect) => {
    setFieldPositions((previous) => {
      const next = new Map(previous);
      next.set(fieldId, rect);
      return next;
    });
  }, []);

  const handleFieldResize = useCallback((fieldId: string, size: LayoutSize) => {
    if (!onUpdateField) {
      return;
    }

    const field = fields.find((candidate) => candidate.id === fieldId);
    const responsive = { ...(field?.ui?.responsive ?? {}) };

    if (layout.device === 'desktop') {
      onUpdateField(fieldId, {
        ui: {
          ...field?.ui,
          width: size.width,
          height: size.height,
          gridSpan: size.gridSpan ?? field?.ui?.gridSpan ?? layout.columns,
          responsive,
        },
      });
      return;
    }

    onUpdateField(fieldId, {
      ui: {
        ...field?.ui,
        height: size.height,
        responsive: {
          ...responsive,
          [layout.device]: {
            ...(responsive[layout.device] ?? {}),
            width: size.width,
            gridSpan: size.gridSpan ?? responsive[layout.device]?.gridSpan ?? field?.ui?.gridSpan ?? layout.columns,
          },
        },
      },
    });
  }, [fields, layout.columns, layout.device, onUpdateField]);

  const handleRadialAction = useCallback((action: string) => {
    const fieldId = radialMenuState.fieldId;

    if (!fieldId) {
      return;
    }

    const fieldIndex = fields.findIndex((field) => field.id === fieldId);
    const field = fields[fieldIndex];

    if (!field) {
      return;
    }

    if (action === 'connect') {
      setConnectionModalOpen(true);
      return;
    }

    if (action === 'duplicate') {
      onDuplicateField?.(fieldId);
      closeRadialMenu();
      return;
    }

    if (action === 'visibility') {
      onUpdateField?.(fieldId, {
        ui: {
          ...field.ui,
          hidden: !field.ui?.hidden,
        },
      });
      closeRadialMenu();
      return;
    }

    if (action === 'lock') {
      onUpdateField?.(fieldId, {
        ui: {
          ...field.ui,
          locked: !field.ui?.locked,
        },
      });
      closeRadialMenu();
      return;
    }

    if (action === 'settings') {
      onSelectField(fieldId);
      closeRadialMenu();
      return;
    }

    if (action === 'moveUp' && onReorderFields && fieldIndex > 0) {
      const reordered = [...fields];
      [reordered[fieldIndex - 1], reordered[fieldIndex]] = [reordered[fieldIndex], reordered[fieldIndex - 1]];
      onReorderFields(reordered);
      closeRadialMenu();
      return;
    }

    if (action === 'moveDown' && onReorderFields && fieldIndex < fields.length - 1) {
      const reordered = [...fields];
      [reordered[fieldIndex], reordered[fieldIndex + 1]] = [reordered[fieldIndex + 1], reordered[fieldIndex]];
      onReorderFields(reordered);
      closeRadialMenu();
      return;
    }

    if (action === 'delete') {
      onDeleteField(fieldId);
      closeRadialMenu();
    }
  }, [closeRadialMenu, fields, onDeleteField, onDuplicateField, onReorderFields, onSelectField, onUpdateField, radialMenuState.fieldId]);

  const handleCreateConnection = useCallback((connection: Omit<FormConnection, 'id'>) => {
    onConnectionsChange?.([
      ...connections,
      {
        ...connection,
        id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      },
    ]);
    closeRadialMenu();
  }, [closeRadialMenu, connections, onConnectionsChange]);

  const sourceField = fields.find((field) => field.id === radialMenuState.fieldId) ?? null;
  const activeDragIndex = activeDragFieldId
    ? fields.findIndex((field) => field.id === activeDragFieldId)
    : -1;
  const dragOverIndex = dragOverFieldId
    ? fields.findIndex((field) => field.id === dragOverFieldId)
    : -1;

  return (
    <section className="canvas-container">
      <div className="canvas-header">
        <div className="canvas-title-group">
          <h3>Form Canvas</h3>
          <div className="canvas-stats">
            <span>{fields.length} fields</span>
            <span>{rules.length} rules</span>
            <span>{connections.length} connections</span>
          </div>
        </div>
        <div className="canvas-layout-tools">
          <div className="canvas-device-switch">
            {deviceDefinitions.map((deviceOption) => {
              const Icon = deviceOption.icon;

              return (
                <button
                  key={deviceOption.id}
                  type="button"
                  className={`canvas-device-btn ${activeDevice === deviceOption.id ? 'active' : ''}`}
                  onClick={() => onDeviceChange?.(deviceOption.id)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {deviceOption.label}
                </button>
              );
            })}
          </div>
          <label className="canvas-layout-label">
            <span>Viewport</span>
            <select
              className="canvas-layout-select"
              value={layout.canvasWidth}
              onChange={(event: any) => onLayoutChange?.({ canvasWidth: Number(event.target.value) })}
            >
              {layout.viewportOptions.map((value) => (
                <option key={value} value={value}>
                  {value}px
                </option>
              ))}
            </select>
          </label>
          <div className="canvas-layout-switch">
            <button
              type="button"
              className={`canvas-layout-btn ${layout.mode === 'flex' ? 'active' : ''}`}
              onClick={() => onLayoutChange?.({ mode: 'flex' })}
            >
              Flexbox
            </button>
            <button
              type="button"
              className={`canvas-layout-btn ${layout.mode === 'grid' ? 'active' : ''}`}
              onClick={() => onLayoutChange?.({ mode: 'grid' })}
            >
              Grid
            </button>
          </div>
          <label className="canvas-layout-label">
            <span>{layout.mode === 'grid' ? 'Columns' : 'Gap'}</span>
            <select
              className="canvas-layout-select"
              value={layout.mode === 'grid' ? layout.columns : layout.gap}
              onChange={(event: any) => {
                const nextValue = Number(event.target.value);
                onLayoutChange?.(layout.mode === 'grid' ? { columns: nextValue } : { gap: nextValue });
              }}
            >
              {(layout.mode === 'grid' ? [2, 4, 6, 12] : [10, 14, 18, 24]).map((value) => (
                <option key={value} value={value}>
                  {layout.mode === 'grid' ? `${value} columns` : `${value}px`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div
        ref={containerRef}
        className={`canvas-body canvas-body-${layout.mode} canvas-device-${layout.device}`}
        style={layout.mode === 'grid'
          ? {
              width: '100%',
              maxWidth: `${layout.canvasWidth}px`,
              margin: '0 auto',
              gap: `${layout.gap}px`,
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
            }
          : {
              width: '100%',
              maxWidth: `${layout.canvasWidth}px`,
              margin: '0 auto',
              gap: `${layout.gap}px`,
            }}
        onMouseLeave={() => setHoveredFieldId(null)}
      >
        <ConnectionLines
          connections={connections}
          fieldPositions={fieldPositions}
          hoveredFieldId={hoveredFieldId}
          containerRef={containerRef}
        />

        <AnimatePresence mode="popLayout">
          {fields.length === 0 ? (
            <motion.div
              key="empty"
              className="canvas-empty"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Layers className="w-12 h-12" strokeWidth={1.5} />
              <p>Build a richer form by adding fields from the palette.</p>
              <span className="canvas-empty-hint">
                <ArrowRight className="w-4 h-4" />
                Drag, resize and connect fields from the canvas.
              </span>
            </motion.div>
          ) : (
            fields.map((field, index) => (
              <SortableFieldItem
                key={field.id}
                field={field}
                index={index}
                device={activeDevice}
                isSelected={selectedFieldId === field.id}
                layoutMode={layout.mode}
                gridColumns={layout.columns}
                activeDragFieldId={activeDragFieldId ?? null}
                dragOverFieldId={dragOverFieldId ?? null}
                dragGapPosition={
                  dragOverFieldId === field.id && activeDragFieldId !== field.id
                    ? activeDragIndex > dragOverIndex
                      ? 'before'
                      : 'after'
                    : null
                }
                duplicateNames={duplicateNames}
                connections={connections}
                onUpdateField={onUpdateField}
                onSelect={() => onSelectField(field.id)}
                onOpenMenu={handleOpenRadialMenu}
                onResize={handleFieldResize}
                onPositionUpdate={handlePositionUpdate}
                onHover={setHoveredFieldId}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <RadialMenu
        isOpen={radialMenuState.isOpen}
        position={radialMenuState.position}
        onClose={closeRadialMenu}
        onAction={handleRadialAction}
      />

      <ConnectionModal
        isOpen={connectionModalOpen}
        sourceField={sourceField}
        fields={fields}
        onClose={() => {
          setConnectionModalOpen(false);
          closeRadialMenu();
        }}
        onCreateConnection={handleCreateConnection}
      />

      {connections.length > 0 ? (
        <motion.div className="connections-panel" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <h4>Connections ({connections.length})</h4>
          <div className="connections-list">
            {connections.map((connection) => {
              const source = fields.find((field) => field.id === connection.sourceId);
              const target = fields.find((field) => field.id === connection.targetId);

              return (
                <motion.div
                  key={connection.id}
                  className={`connection-item connection-${connection.validationType}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onMouseEnter={() => setHoveredFieldId(connection.sourceId)}
                  onMouseLeave={() => setHoveredFieldId(null)}
                >
                  <div className="connection-item-info">
                    <span className="connection-source">{source?.label ?? 'Unknown'}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="connection-target">{target?.label ?? 'Unknown'}</span>
                  </div>
                  <div className="connection-item-meta">
                    <span className={`validation-badge ${connection.validationType}`}>
                      {connection.validationType === 'error' ? <XCircle className="w-3 h-3" /> : null}
                      {connection.validationType === 'warning' ? <AlertTriangle className="w-3 h-3" /> : null}
                      {connection.validationType === 'success' ? <CheckCircle2 className="w-3 h-3" /> : null}
                      {connection.operator}
                    </span>
                    <button
                      type="button"
                      className="connection-delete"
                      onClick={() => onConnectionsChange?.(connections.filter((item) => item.id !== connection.id))}
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : null}
    </section>
  );
};
