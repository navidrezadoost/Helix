import { useMemo, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, ChevronDown, ChevronUp, GitBranch, X, Target } from 'lucide-react';
import type { GlobalRule, GlobalRuleAction } from '../../types/schema';
import { CodeSuggestionTextarea } from './CodeSuggestionTextarea';

interface GlobalRulesEditorProps {
  globalRules: GlobalRule[];
  forms: Array<{ id: string; name: string; fields?: Array<{ id: string; label?: string }> }>;
  onChange: (rules: GlobalRule[]) => void;
}

export const GlobalRulesEditor: FC<GlobalRulesEditorProps> = ({
  globalRules,
  forms,
  onChange,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const globalConditionSuggestions = useMemo(() => {
    const tokens = forms.flatMap((form) =>
      (form.fields ?? []).map((field) => `${form.id}.${field.id}`),
    );

    return [
      ...tokens,
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
  }, [forms]);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 30 },
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
  };

  const addRule = () => {
    const newRule: GlobalRule = {
      id: `global_rule_${Date.now()}`,
      dependsOn: [],
      condition: 'true',
      actions: [],
    };
    onChange([...globalRules, newRule]);
    setEditingIndex(globalRules.length);
  };

  const updateRule = (index: number, updates: Partial<GlobalRule>) => {
    const newRules = [...globalRules];
    newRules[index] = { ...newRules[index], ...updates };
    onChange(newRules);
  };

  const deleteRule = (index: number) => {
    if (confirm('Delete this global rule?')) {
      onChange(globalRules.filter((_: GlobalRule, i: number) => i !== index));
      if (editingIndex === index) setEditingIndex(null);
    }
  };

  const addAction = (ruleIndex: number) => {
    const rule = globalRules[ruleIndex];
    const newAction: GlobalRuleAction = {
      type: 'setError',
      targets: [{ formId: '', field: '' }],
      message: 'Validation failed',
    };
    updateRule(ruleIndex, { actions: [...rule.actions, newAction] });
  };

  const updateAction = (ruleIndex: number, actionIndex: number, updates: Partial<GlobalRuleAction>) => {
    const rule = globalRules[ruleIndex];
    const newActions = [...rule.actions];
    newActions[actionIndex] = { ...newActions[actionIndex], ...updates };
    updateRule(ruleIndex, { actions: newActions });
  };

  const deleteAction = (ruleIndex: number, actionIndex: number) => {
    const rule = globalRules[ruleIndex];
    updateRule(ruleIndex, { actions: rule.actions.filter((_: GlobalRuleAction, i: number) => i !== actionIndex) });
  };

  return (
    <div className="fb-panel fb-global-rules">
      <div className="fb-global-rules-header">
        <h3>Global Cross-Form Rules</h3>
        <motion.button
          className="fb-btn fb-btn-primary"
          onClick={addRule}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Plus className="w-4 h-4" />
          Add Global Rule
        </motion.button>
      </div>

      <p className="fb-global-rules-hint">
        Rules that span multiple forms on the same page. Use <code>formId.field</code> in
        conditions.
      </p>

      <AnimatePresence>
        {globalRules.length === 0 && (
          <motion.div
            className="fb-empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GitBranch className="w-16 h-16 mb-4" strokeWidth={1} style={{ color: '#d4d4d4' }} />
            <p>No global rules defined. Click &quot;Add Global Rule&quot; to start.</p>
          </motion.div>
        )}

        {globalRules.map((rule: GlobalRule, idx: number) => (
          <motion.div
            key={rule.id}
            className="fb-global-rule-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
          >
            <div className="fb-global-rule-header">
              <input
                type="text"
                className="fb-input"
                value={rule.id}
                onChange={(e) => updateRule(idx, { id: e.target.value })}
                placeholder="Rule ID"
              />
              <motion.button
                className="fb-btn fb-btn-ghost fb-btn-icon"
                onClick={() => setEditingIndex(editingIndex === idx ? null : idx)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {editingIndex === idx ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </motion.button>
              <motion.button
                className="fb-btn fb-btn-danger fb-btn-icon"
                onClick={() => deleteRule(idx)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>

            <AnimatePresence>
              {(editingIndex === idx || rule.condition !== 'true') && (
                <motion.div
                  className="fb-global-rule-body"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
              <div className="field-group">
                <label>Depends On (sources):</label>
                <div className="fb-depends-list">
                  {rule.dependsOn.map((dep: { formId: string; field: string }, depIdx: number) => (
                    <motion.div
                      key={depIdx}
                      className="fb-depends-item"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <select
                        className="fb-select"
                        value={dep.formId}
                        onChange={(e) => {
                          const newDepends = [...rule.dependsOn];
                          newDepends[depIdx] = { ...dep, formId: e.target.value };
                          updateRule(idx, { dependsOn: newDepends });
                        }}
                      >
                        <option value="">Select form</option>
                        {forms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <select
                        className="fb-select"
                        value={dep.field}
                        onChange={(e) => {
                          const newDepends = [...rule.dependsOn];
                          newDepends[depIdx] = { ...dep, field: e.target.value };
                          updateRule(idx, { dependsOn: newDepends });
                        }}
                      >
                        <option value="">Select field</option>
                        {(forms.find((form) => form.id === dep.formId)?.fields ?? []).map((field) => (
                          <option key={field.id} value={field.id}>{field.label || field.id}</option>
                        ))}
                      </select>
                      <motion.button
                        className="fb-btn fb-btn-ghost fb-btn-icon"
                        onClick={() => {
                        const newDepends = rule.dependsOn.filter((_: { formId: string; field: string }, i: number) => i !== depIdx);
                        updateRule(idx, { dependsOn: newDepends });
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    </motion.div>
                  ))}
                  <motion.button
                    className="fb-btn fb-btn-secondary"
                    onClick={() => {
                    updateRule(idx, { dependsOn: [...rule.dependsOn, { formId: '', field: '' }] });
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Plus className="w-4 h-4" />
                    Add dependency
                  </motion.button>
                </div>
              </div>

              <div className="fb-property-group">
                <label>Condition (JavaScript expression):</label>
                <CodeSuggestionTextarea
                  value={rule.condition}
                  onChange={(nextValue) => updateRule(idx, { condition: nextValue })}
                  rows={3}
                  suggestions={globalConditionSuggestions}
                  placeholder="orderForm.total > 100 && accountForm.role === 'admin'"
                />
                <p className="fb-hint">
                  Use field names directly (e.g., <code>orderForm.total {'>'} 100</code>)
                </p>
              </div>

              <div className="fb-property-group">
                <label>Actions:</label>
                {rule.actions.map((action: GlobalRuleAction, actIdx: number) => (
                  <motion.div
                    key={actIdx}
                    className="fb-action-item"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: '12px' }}
                  >
                    <div className="fb-action-header">
                      <Target className="w-4 h-4" style={{ color: '#737373' }} />
                    <select
                      className="fb-select"
                      value={action.type}
                      onChange={(e) =>
                        updateAction(idx, actIdx, { type: e.target.value as GlobalRuleAction['type'] })
                      }
                      style={{ flex: 1 }}
                    >
                      <option value="setError">Set Error</option>
                      <option value="show">Show</option>
                      <option value="hide">Hide</option>
                      <option value="setRequired">Set Required</option>
                      <option value="setValue">Set Value</option>
                    </select>
                      <motion.button
                        className="fb-btn fb-btn-ghost fb-btn-icon"
                        onClick={() => deleteAction(idx, actIdx)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </motion.button>
                    </div>

                    <div className="fb-action-targets">
                      {action.targets.map((target, tIdx: number) => (
                        <div key={tIdx} className="fb-action-target">
                          <select
                            className="fb-select"
                            value={target.formId}
                            onChange={(e) => {
                              const newTargets = [...action.targets];
                              newTargets[tIdx] = { ...target, formId: e.target.value };
                              updateAction(idx, actIdx, { targets: newTargets });
                            }}
                          >
                            <option value="">Target form</option>
                            {forms.map((f) => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <select
                            className="fb-select"
                            value={target.field}
                            onChange={(e) => {
                              const newTargets = [...action.targets];
                              newTargets[tIdx] = { ...target, field: e.target.value };
                              updateAction(idx, actIdx, { targets: newTargets });
                            }}
                          >
                            <option value="">Target field</option>
                            {(forms.find((form) => form.id === target.formId)?.fields ?? []).map((field) => (
                              <option key={field.id} value={field.id}>{field.label || field.id}</option>
                            ))}
                          </select>
                          <motion.button
                            className="fb-btn fb-btn-ghost fb-btn-icon"
                            onClick={() => {
                            const newTargets = action.targets.filter((_: { formId: string; field: string }, i: number) => i !== tIdx);
                            updateAction(idx, actIdx, { targets: newTargets });
                            }}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <X className="w-4 h-4" />
                          </motion.button>
                        </div>
                      ))}
                      <motion.button
                        className="fb-btn fb-btn-secondary"
                        onClick={() => {
                        updateAction(idx, actIdx, { targets: [...action.targets, { formId: '', field: '' }] });
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{ width: 'fit-content' }}
                      >
                        <Plus className="w-4 h-4" />
                        Add target
                      </motion.button>
                    </div>

                    {action.type === 'setError' && (
                      <input
                        type="text"
                        className="fb-input"
                        placeholder="Error message"
                        value={action.message || ''}
                        onChange={(e) => updateAction(idx, actIdx, { message: e.target.value })}
                        style={{ marginTop: '10px' }}
                      />
                    )}

                    {action.type === 'setRequired' && (
                      <label className="fb-checkbox-label" style={{ marginTop: '10px' }}>
                        <input
                          type="checkbox"
                          checked={action.required || false}
                          onChange={(e) =>
                            updateAction(idx, actIdx, { required: e.target.checked })
                          }
                        />
                        Required
                      </label>
                    )}

                    {action.type === 'setValue' && (
                      <input
                        type="text"
                        className="fb-input"
                        placeholder="Value"
                        value={action.value || ''}
                        onChange={(e) => updateAction(idx, actIdx, { value: e.target.value })}
                        style={{ marginTop: '10px' }}
                      />
                    )}

                  </motion.div>
                ))}
                <motion.button
                  className="fb-btn fb-btn-secondary"
                  onClick={() => addAction(idx)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus className="w-4 h-4" />
                  Add Action
                </motion.button>
              </div>

              <div className="fb-property-group">
                <label>
                  Priority:
                  <select
                    className="fb-select"
                    value={rule.priority || 'override'}
                    onChange={(e) => updateRule(idx, { priority: e.target.value as 'override' | 'merge' })}
                  >
                    <option value="override">Override (rule wins)</option>
                    <option value="merge">Merge (both required)</option>
                  </select>
                </label>
              </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
