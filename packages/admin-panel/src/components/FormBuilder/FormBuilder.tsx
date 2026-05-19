import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as DndCore from '@dnd-kit/core';
import * as SortableKit from '@dnd-kit/sortable';
import {
  ArrowLeft,
  Trash2,
  Save,
  Rocket,
  Copy,
  Eye,
  Globe2,
  Layers,
  Link2,
  Loader2,
  Maximize2,
  Minimize2,
  SquarePen,
} from 'lucide-react';
import { AdminThemeToggle } from '../AdminThemeToggle';
import { FormCanvas } from './FormCanvas';
import { FieldPalette } from './FieldPalette';
import { FormPreview } from './FormPreview';
import { PropertyEditor } from './PropertyEditor';
import { DataSourceEditor } from './DataSourceEditor';
import { GlobalRulesEditor } from './GlobalRulesEditor';
import { SchemaList } from './SchemaList';
import { useSchemaManager } from '../../hooks/useSchemaManager';
import { useHelixAdmin } from '../../context/HelixAdminProvider';
import { createFieldId, DEFAULT_DATE_FORMAT, normalizeFieldName } from '../../lib/formBuilder';
import type { Schema } from '../../api/schemas';
import type { DataSourceConfig, FieldConfig, FormConnection, GlobalRule, ResponsiveDevice, Rule } from '../../types/schema';
import './FormBuilder.css';

const DndContext = (DndCore as any).DndContext as any;
const closestCenter = (DndCore as any).closestCenter as any;
const closestCorners = (DndCore as any).closestCorners as any;
const PointerSensor = (DndCore as any).PointerSensor as any;
const pointerWithin = (DndCore as any).pointerWithin as any;
const rectIntersection = (DndCore as any).rectIntersection as any;
const useSensor = (DndCore as any).useSensor as (sensor: any, options?: any) => any;
const useSensors = (DndCore as any).useSensors as (...sensors: any[]) => any;
const SortableContext = (SortableKit as any).SortableContext as any;
const rectSortingStrategy = (SortableKit as any).rectSortingStrategy as any;

const DEVICE_VIEWPORTS: Record<ResponsiveDevice, number[]> = {
  desktop: [1280, 1440, 1600],
  tablet: [768, 820, 912],
  mobile: [375, 390, 430],
};

const DEVICE_DEFAULT_WIDTH: Record<ResponsiveDevice, number> = {
  desktop: 1280,
  tablet: 820,
  mobile: 390,
};

const FIELD_TYPE_LABELS: Record<FieldConfig['type'], string> = {
  text: 'Text Input',
  number: 'Number Input',
  select: 'Select Input',
  checkbox: 'Checkbox Input',
  radio: 'Radio Group',
  date: 'Date Input',
  textarea: 'Textarea Input',
  file: 'File Upload',
};

interface FormBuilderProps {
  initialSchemaId?: string;
  defaultTenantId?: string;
  onSchemaPublished?: (schemaId: string, version: number) => void;
  className?: string;
}

type TabId = 'fields' | 'data-sources' | 'global-rules';

const tabs: Array<{ id: TabId; label: string; icon: JSX.Element }> = [
  { id: 'fields', label: 'Fields & Rules', icon: <Layers className="w-4 h-4" /> },
  { id: 'data-sources', label: 'Data Sources', icon: <Globe2 className="w-4 h-4" /> },
  { id: 'global-rules', label: 'Global Rules', icon: <Link2 className="w-4 h-4" /> },
];

export const FormBuilder: FC<FormBuilderProps> = ({
  initialSchemaId,
  defaultTenantId,
  onSchemaPublished,
  className,
}) => {
  const [selectedSchemaId, setSelectedSchemaId] = useState<string | undefined>(initialSchemaId);
  const [activeTab, setActiveTab] = useState<TabId>('fields');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showPalettePanel, setShowPalettePanel] = useState(false);
  const [showInspectorPanel, setShowInspectorPanel] = useState(false);
  const [activeDragFieldId, setActiveDragFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [activeDevice, setActiveDevice] = useState<ResponsiveDevice>('desktop');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
  );

  const collisionDetection = useCallback((args: any) => {
    const pointerCollisions = pointerWithin?.(args) ?? [];
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    const rectCollisions = rectIntersection?.(args) ?? [];
    if (rectCollisions.length > 0) {
      return rectCollisions;
    }

    return closestCorners?.(args) ?? closestCenter(args);
  }, []);

  const {
    schema,
    setSchema,
    loading,
    error,
    saving,
    publishing,
    initializeDraft,
    saveSchema,
    publishSchema,
    createVersion,
    deleteSchema,
    testDataSource,
  } = useSchemaManager({
    schemaId: selectedSchemaId,
    autoLoad: !!selectedSchemaId,
    defaultTenantId,
  });
  const { t, locale } = useHelixAdmin();

  const patchSchema = useCallback((updater: (current: Schema) => Schema) => {
    if (!schema) {
      return;
    }

    setSchema(updater(schema));
  }, [schema, setSchema]);

  const selectedField = useMemo(
    () => schema?.fields.find((field) => field.id === selectedFieldId) ?? null,
    [schema, selectedFieldId],
  );

  const canvasConnections = useMemo(
    () => ((((schema as any)?.metadata?.connections ?? []) as FormConnection[]).filter((connection) => (
      schema?.fields.some((field) => field.id === connection.sourceId)
      && schema?.fields.some((field) => field.id === connection.targetId)
    ))),
    [schema, (schema as any)?.metadata?.connections],
  );

  const updateCanvasConnections = useCallback((connections: FormConnection[]) => {
    patchSchema((current) => ({
      ...current,
      metadata: {
        ...(current.metadata ?? {}),
        connections,
      },
    }));
  }, [patchSchema]);

  const handleSave = useCallback(async () => {
    await saveSchema();
  }, [saveSchema]);

  const handlePublish = useCallback(async () => {
    const published = await publishSchema();
    if (published && onSchemaPublished) {
      onSchemaPublished(published.schema_id, published.version);
    }
  }, [onSchemaPublished, publishSchema]);

  const addField = useCallback((fieldType: FieldConfig['type']) => {
    const fieldCount = (schema?.fields.length ?? 0) + 1;
    const label = `${FIELD_TYPE_LABELS[fieldType] ?? `New ${fieldType} field`} ${fieldCount}`;
    const name = normalizeFieldName(label, fieldType);
    const newField: FieldConfig = {
      id: createFieldId(name, fieldType),
      name,
      type: fieldType,
      label,
      required: false,
      placeholder: '',
      selectionMode: fieldType === 'select' ? 'single' : undefined,
      dateConfig: fieldType === 'date'
        ? {
            format: DEFAULT_DATE_FORMAT,
            locale,
            useCustomCalendar: true,
          }
        : undefined,
      htmlAttributes: fieldType === 'textarea'
        ? {
            rows: 4,
            resize: 'vertical',
            spellCheck: true,
          }
        : fieldType === 'file'
          ? {
              multiple: false,
            }
          : fieldType === 'select'
            ? {
                size: 1,
              }
            : undefined,
      options: fieldType === 'select' || fieldType === 'radio'
        ? [
            { label: 'Option 1', value: 'option_1' },
            { label: 'Option 2', value: 'option_2' },
          ]
        : undefined,
      ui: {
        width: 100,
        height: 92,
        gridSpan: 12,
        hidden: false,
        locked: false,
      },
    };

    patchSchema((current) => ({
      ...current,
      fields: [...current.fields, newField],
    }));
    setSelectedFieldId(newField.id);
  }, [locale, patchSchema, schema?.fields.length]);

  const updateField = useCallback((fieldId: string, updates: Partial<FieldConfig>) => {
    patchSchema((current) => ({
      ...current,
      fields: current.fields.map((field) => field.id === fieldId ? { ...field, ...updates } : field),
    }));
  }, [patchSchema]);

  const deleteField = useCallback((fieldId: string) => {
    patchSchema((current) => ({
      ...current,
      fields: current.fields.filter((field) => field.id !== fieldId),
      rules: current.rules.filter((rule) => !rule.dependsOn.includes(fieldId)),
      metadata: {
        ...(current.metadata ?? {}),
        connections: (((current as any).metadata?.connections ?? []) as FormConnection[])
          .filter((connection) => connection.sourceId !== fieldId && connection.targetId !== fieldId),
      },
      data_sources: Object.fromEntries(
        Object.entries(current.data_sources ?? {}).filter(([, source]) => !(source.dependsOn ?? []).includes(fieldId)),
      ),
    }));

    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }, [patchSchema, selectedFieldId]);

  const duplicateField = useCallback((fieldId: string) => {
    let duplicatedFieldId: string | null = null;

    patchSchema((current) => {
      const index = current.fields.findIndex((field) => field.id === fieldId);
      if (index < 0) {
        return current;
      }

      const source = current.fields[index];
      const duplicatedName = normalizeFieldName(`${source.name ?? source.label}_copy`, source.type);
      const duplicated: FieldConfig = {
        ...source,
        id: createFieldId(duplicatedName, source.type),
        name: duplicatedName,
        label: `${source.label} copy`,
        ui: {
          width: source.ui?.width ?? 100,
          height: source.ui?.height ?? 92,
          gridSpan: source.ui?.gridSpan ?? 12,
          hidden: false,
          locked: false,
        },
      };

      duplicatedFieldId = duplicated.id;

      const fields = [...current.fields];
      fields.splice(index + 1, 0, duplicated);
      return { ...current, fields };
    });

    if (duplicatedFieldId) {
      setSelectedFieldId(duplicatedFieldId);
    }
  }, [patchSchema]);

  const updateRule = useCallback((ruleIndex: number, rule: Rule) => {
    patchSchema((current) => {
      const rules = [...current.rules];
      rules[ruleIndex] = rule;
      return { ...current, rules };
    });
  }, [patchSchema]);

  const addRule = useCallback(() => {
    const newRule: Rule = {
      id: `rule_${Date.now()}`,
      dependsOn: [],
      condition: 'true',
      actions: [],
    };

    patchSchema((current) => ({
      ...current,
      rules: [...current.rules, newRule],
    }));
  }, [patchSchema]);

  const deleteRule = useCallback((ruleIndex: number) => {
    patchSchema((current) => ({
      ...current,
      rules: current.rules.filter((_, index) => index !== ruleIndex),
    }));
  }, [patchSchema]);

  const updateGlobalRules = useCallback((globalRules: GlobalRule[]) => {
    patchSchema((current) => ({
      ...current,
      global_rules: globalRules,
    }));
  }, [patchSchema]);

  const updateDataSources = useCallback((dataSources: Record<string, DataSourceConfig>) => {
    patchSchema((current) => ({
      ...current,
      data_sources: dataSources,
    }));
  }, [patchSchema]);

  const handleDragStart = useCallback((event: any) => {
    setActiveDragFieldId(String(event.active.id));
  }, []);

  const handleDragOver = useCallback((event: any) => {
    setDragOverFieldId(event.over ? String(event.over.id) : null);
  }, []);

  const handleDragEnd = useCallback((event: any) => {
    if (!schema) {
      setActiveDragFieldId(null);
      setDragOverFieldId(null);
      return;
    }

    const { active, over } = event;
    if (!over || active.id === over.id) {
      setActiveDragFieldId(null);
      setDragOverFieldId(null);
      return;
    }

    const oldIndex = schema.fields.findIndex((field) => field.id === active.id);
    const newIndex = schema.fields.findIndex((field) => field.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const reordered = [...schema.fields];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    setSchema({
      ...schema,
      fields: reordered,
    });
    setActiveDragFieldId(null);
    setDragOverFieldId(null);
  }, [schema, setSchema]);

  const handleDragCancel = useCallback(() => {
    setActiveDragFieldId(null);
    setDragOverFieldId(null);
  }, []);

  const availableForms = useMemo(() => {
    if (!schema) {
      return [];
    }

    return [{
      id: schema.schema_id,
      name: schema.name,
      fields: schema.fields.map((field) => ({ id: field.id, label: field.label })),
    }];
  }, [schema]);

  const canvasLayout = useMemo(() => {
    const baseLayout = (((schema as any)?.metadata?.layout ?? {}) as any);
    const deviceLayout = ((baseLayout?.responsive?.[activeDevice] ?? {}) as any);

    return {
      device: activeDevice,
      mode: ((activeDevice === 'desktop' ? baseLayout?.mode : undefined) ?? deviceLayout?.mode ?? baseLayout?.mode ?? 'flex') as 'flex' | 'grid',
      columns: Number((activeDevice === 'desktop' ? baseLayout?.columns : undefined) ?? deviceLayout?.columns ?? baseLayout?.columns ?? 12),
      gap: Number((activeDevice === 'desktop' ? baseLayout?.gap : undefined) ?? deviceLayout?.gap ?? baseLayout?.gap ?? 14),
      canvasWidth: Number((activeDevice === 'desktop' ? baseLayout?.canvasWidth : undefined) ?? deviceLayout?.canvasWidth ?? DEVICE_DEFAULT_WIDTH[activeDevice]),
      viewportOptions: DEVICE_VIEWPORTS[activeDevice],
    };
  }, [
    activeDevice,
    (schema as any)?.metadata?.layout?.canvasWidth,
    (schema as any)?.metadata?.layout?.columns,
    (schema as any)?.metadata?.layout?.gap,
    (schema as any)?.metadata?.layout?.mode,
    (schema as any)?.metadata?.layout?.responsive,
  ]);

  const updateCanvasLayout = useCallback((updates: Partial<NonNullable<Schema['metadata']>['layout']>) => {
    patchSchema((current) => {
      const existingLayout = (((current as any).metadata?.layout ?? {}) as any);
      const existingResponsive = ((existingLayout?.responsive ?? {}) as Record<string, any>);

      if (activeDevice === 'desktop') {
        return {
          ...current,
          metadata: {
            ...(current.metadata ?? {}),
            layout: {
              mode: (existingLayout?.mode ?? 'flex') as 'flex' | 'grid',
              columns: Number(existingLayout?.columns ?? 12),
              gap: Number(existingLayout?.gap ?? 14),
              canvasWidth: Number(existingLayout?.canvasWidth ?? DEVICE_DEFAULT_WIDTH.desktop),
              responsive: existingResponsive,
              ...updates,
            },
          },
        };
      }

      return {
        ...current,
        metadata: {
          ...(current.metadata ?? {}),
          layout: {
            mode: (existingLayout?.mode ?? 'flex') as 'flex' | 'grid',
            columns: Number(existingLayout?.columns ?? 12),
            gap: Number(existingLayout?.gap ?? 14),
            canvasWidth: Number(existingLayout?.canvasWidth ?? DEVICE_DEFAULT_WIDTH.desktop),
            responsive: {
              ...existingResponsive,
              [activeDevice]: {
                ...(existingResponsive?.[activeDevice] ?? {}),
                ...updates,
              },
            },
          },
        },
      };
    });
  }, [activeDevice, patchSchema]);

  useEffect(() => {
    if (activeTab !== 'fields' && isPreviewMode) {
      setIsPreviewMode(false);
    }
  }, [activeTab, isPreviewMode]);

  useEffect(() => {
    if (!isFocusMode) {
      setShowPalettePanel(false);
      setShowInspectorPanel(false);
    }
  }, [isFocusMode]);

  useEffect(() => {
    if (isFocusMode && selectedFieldId) {
      setShowInspectorPanel(true);
    }
  }, [isFocusMode, selectedFieldId]);

  if (loading) {
    return (
      <div className="fb-container fb-loading">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-6 h-6" />
        </motion.div>
        <span style={{ marginLeft: '12px' }}>{t('loadingSchema')}</span>
      </div>
    );
  }

  if (!schema && !selectedSchemaId) {
    return (
      <SchemaList
        onSelectSchema={(id: string) => {
          setSelectedSchemaId(id);
          setSelectedFieldId(null);
        }}
        onCreateNew={() => {
          setSelectedSchemaId(undefined);
          setSelectedFieldId(null);
          initializeDraft({
            tenant_id: defaultTenantId,
            name: t('untitledForm'),
            description: '',
            fields: [],
            rules: [],
            data_sources: {},
            global_rules: [],
          });
        }}
      />
    );
  }

  if (!schema) {
    return <div className="fb-container fb-error">{t('schemaNotFound')}</div>;
  }

  return (
    <div className={`fb-container ${className ?? ''}`.trim()}>
      <motion.header
        className="fb-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="fb-header-title">
          <h1>{schema.name}</h1>
          <span className={`fb-status fb-status-${schema.status}`}>{schema.status}</span>
          <span className="fb-version">v{schema.version}</span>
        </div>

        <div className="fb-header-actions">
          {error ? <div className="fb-error-banner">{error}</div> : null}
          <AdminThemeToggle compact />
          {activeTab === 'fields' && !isPreviewMode ? (
            <motion.button
              className="fb-btn fb-btn-secondary"
              onClick={() => setIsFocusMode((currentValue) => !currentValue)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {isFocusMode ? 'Exit Focus' : 'Focus Layout'}
            </motion.button>
          ) : null}
          {activeTab === 'fields' ? (
            <motion.button
              className="fb-btn fb-btn-secondary"
              onClick={() => setIsPreviewMode((currentValue) => !currentValue)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isPreviewMode ? <SquarePen className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {isPreviewMode ? 'Exit Preview' : 'Preview Form'}
            </motion.button>
          ) : null}
          <motion.button className="fb-btn fb-btn-secondary" onClick={() => {
            setSchema(null);
            setSelectedSchemaId(undefined);
            setSelectedFieldId(null);
          }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <ArrowLeft className="w-4 h-4" /> {t('back')}
          </motion.button>

          <motion.button className="fb-btn fb-btn-danger" onClick={() => void deleteSchema()} disabled={schema.status !== 'draft'} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Trash2 className="w-4 h-4" /> {t('delete')}
          </motion.button>

          {schema.status === 'published' ? (
            <motion.button className="fb-btn fb-btn-secondary" onClick={() => void createVersion()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Copy className="w-4 h-4" /> {t('createNewVersion')}
            </motion.button>
          ) : null}

          <motion.button className="fb-btn fb-btn-primary" onClick={() => void handleSave()} disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? t('saving') : t('saveDraft')}
          </motion.button>

          {schema.status === 'draft' ? (
            <motion.button className="fb-btn fb-btn-success" onClick={() => void handlePublish()} disabled={publishing || !schema.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {publishing ? t('publishing') : t('publish')}
            </motion.button>
          ) : null}
        </div>
      </motion.header>

      <motion.div
        className="fb-tabs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            className={`fb-tab ${activeTab === tab.id ? 'fb-tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {tab.icon}
            {tab.id === 'fields' && t('fieldsAndRules')}
            {tab.id === 'data-sources' && t('dataSources')}
            {tab.id === 'global-rules' && t('globalRules')}
          </motion.button>
        ))}
      </motion.div>

      <div className="fb-content">
        <AnimatePresence mode="wait">
          {activeTab === 'fields' && (
            <motion.div
              key="fields"
              className={isPreviewMode ? 'fb-preview-mode' : `fb-builder-layout ${isFocusMode ? 'fb-builder-layout-focus' : ''}`.trim()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {isPreviewMode ? (
                <FormPreview
                  fields={schema.fields}
                  rules={schema.rules}
                  connections={canvasConnections}
                  activeDevice={activeDevice}
                  layout={canvasLayout}
                />
              ) : (
                <>
                  {!isFocusMode ? <FieldPalette onAddField={addField} /> : null}
                  <div className={`fb-canvas-workspace ${isFocusMode ? 'fb-canvas-workspace-focus' : ''}`.trim()}>
                    {isFocusMode ? (
                      <div className="fb-focus-toolbar">
                        <motion.button
                          type="button"
                          className={`fb-btn ${showPalettePanel ? 'fb-btn-primary' : 'fb-btn-secondary'}`}
                          onClick={() => setShowPalettePanel((currentValue) => !currentValue)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Layers className="w-4 h-4" />
                          Fields Menu
                        </motion.button>
                        <motion.button
                          type="button"
                          className={`fb-btn ${showInspectorPanel ? 'fb-btn-primary' : 'fb-btn-secondary'}`}
                          onClick={() => setShowInspectorPanel((currentValue) => !currentValue)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <SquarePen className="w-4 h-4" />
                          Inspector Panel
                        </motion.button>
                      </div>
                    ) : null}

                    <DndContext
                      sensors={sensors}
                      collisionDetection={collisionDetection}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragEnd={handleDragEnd}
                      onDragCancel={handleDragCancel}
                    >
                      <SortableContext items={schema.fields.map((field) => field.id)} strategy={rectSortingStrategy}>
                        <FormCanvas
                          fields={schema.fields}
                          rules={schema.rules}
                          connections={canvasConnections}
                          layout={canvasLayout}
                          activeDevice={activeDevice}
                          selectedFieldId={selectedFieldId}
                          activeDragFieldId={activeDragFieldId}
                          dragOverFieldId={dragOverFieldId}
                          onDeviceChange={setActiveDevice}
                          onSelectField={setSelectedFieldId}
                          onDeleteField={deleteField}
                          onConnectionsChange={updateCanvasConnections}
                          onLayoutChange={updateCanvasLayout}
                          onUpdateField={updateField}
                          onDuplicateField={duplicateField}
                          onReorderFields={(fields: FieldConfig[]) => {
                            patchSchema((current) => ({
                              ...current,
                              fields,
                            }));
                          }}
                        />
                      </SortableContext>
                    </DndContext>

                    {isFocusMode ? (
                      <>
                        <AnimatePresence>
                          {showPalettePanel ? (
                            <motion.div
                              className="fb-focus-panel fb-focus-panel-left"
                              initial={{ opacity: 0, x: -24 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -24 }}
                              transition={{ duration: 0.2 }}
                            >
                              <FieldPalette onAddField={addField} />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>

                        <AnimatePresence>
                          {showInspectorPanel ? (
                            <motion.div
                              className="fb-focus-panel fb-focus-panel-right"
                              initial={{ opacity: 0, x: 24 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 24 }}
                              transition={{ duration: 0.2 }}
                            >
                              <PropertyEditor
                                field={selectedField}
                                rules={schema.rules}
                                fields={schema.fields}
                                activeDevice={activeDevice}
                                layoutMode={canvasLayout.mode}
                                gridColumns={canvasLayout.columns}
                                defaultLocale={locale}
                                onUpdateField={(updates: Partial<FieldConfig>) => {
                                  if (selectedField) {
                                    updateField(selectedField.id, updates);
                                  }
                                }}
                                onUpdateRule={updateRule}
                                onAddRule={addRule}
                                onDeleteRule={deleteRule}
                              />
                            </motion.div>
                          ) : null}
                        </AnimatePresence>
                      </>
                    ) : null}
                  </div>
                  {!isFocusMode ? (
                    <PropertyEditor
                      field={selectedField}
                      rules={schema.rules}
                      fields={schema.fields}
                      activeDevice={activeDevice}
                      layoutMode={canvasLayout.mode}
                      gridColumns={canvasLayout.columns}
                      defaultLocale={locale}
                      onUpdateField={(updates: Partial<FieldConfig>) => {
                        if (selectedField) {
                          updateField(selectedField.id, updates);
                        }
                      }}
                      onUpdateRule={updateRule}
                      onAddRule={addRule}
                      onDeleteRule={deleteRule}
                    />
                  ) : null}
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'data-sources' && (
            <motion.div
              key="data-sources"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DataSourceEditor
                dataSources={schema.data_sources ?? {}}
                fields={schema.fields}
                onChange={updateDataSources}
                onTest={testDataSource}
              />
            </motion.div>
          )}

          {activeTab === 'global-rules' && (
            <motion.div
              key="global-rules"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <GlobalRulesEditor
                globalRules={schema.global_rules ?? []}
                forms={availableForms}
                onChange={updateGlobalRules}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
