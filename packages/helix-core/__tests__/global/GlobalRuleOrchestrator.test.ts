// __tests__/global/GlobalRuleOrchestrator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GlobalRuleOrchestrator } from '../../src/global/GlobalRuleOrchestrator';
import { ReactiveStore } from '../../src/store/ReactiveStore';
import { ExpressionEngine } from '../../src/expression/ExpressionEngine';

describe('GlobalRuleOrchestrator', () => {
  it('should apply cross-form error when condition met', () => {
    const engine = new ExpressionEngine();
    const orchestrator = new GlobalRuleOrchestrator(engine);
    
    const store1 = new ReactiveStore(engine);
    const store2 = new ReactiveStore(engine);
    const form1 = document.createElement('div');
    const form2 = document.createElement('div');
    
    orchestrator.registerForm('form1', store1, form1);
    orchestrator.registerForm('form2', store2, form2);
    
    orchestrator.setRules([
      {
        id: 'test',
        dependsOn: [{ formId: 'form1', field: 'a' }],
        condition: 'form1.a === true',
        actions: [
          {
            type: 'setError',
            targets: [{ formId: 'form2', field: 'b' }],
            message: 'Error!'
          }
        ]
      }
    ]);
    
    // Simulate field change in form1 (assuming store initializes fields on FIELD_CHANGE for test)
    store1.dispatch({ type: 'FIELD_CHANGE', nodeId: 'a', value: true });
    
    // Check that form2 field b has error
    const fieldB = store2.getFieldState('b');
    expect(fieldB?.errors).toContain('Error!');
  });
});
