/**
 * @helix/react-sdk
 * ---------------
 * React bindings for Helix declarative reactive forms
 */

// Core hook
export { useHelixForm } from './hooks/useHelixForm';
export type {
  UseHelixFormConfig,
  UseHelixFormReturn,
  FieldFieldState,
  FieldInputProps,
} from './hooks/useHelixForm';

// Optional component wrapper
export { HelixForm } from './components/HelixReactForm';

// Protocol types (re-exported for convenience)
export type { SubmissionEnvelope } from './protocol/SubmissionEnvelope';
export type { WorkflowEvent, WorkflowEventType } from './protocol/WorkflowEvent';
export type { ValidationBoundaryContract, ValidationLayer } from './protocol/ValidationBoundary';

// Runtime types
export type { CompiledGraph } from './runtime/SafeExpressionEngine';
export type { FieldEffectState } from './store/ReactiveStore';
