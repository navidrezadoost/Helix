import { describe, it, expect, beforeEach } from 'vitest';
import { AsyncActionRegistry } from '../../src/store/AsyncActionRegistry';
import type { AsyncAction } from '../../src/types/async';

describe('AsyncActionRegistry', () => {
  let registry: AsyncActionRegistry;

  beforeEach(() => {
    registry = new AsyncActionRegistry();
  });

  describe('register and getActionsForField', () => {
    it('should register a single action and retrieve it by target field', () => {
      const action: AsyncAction = {
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states?country={{country}}',
        method: 'GET',
        valuePath: '$.data[*].{value:code, label:name}',
        cache: 'session',
        debounce: 300,
      };

      registry.register(action);
      const retrieved = registry.getActionsForField('states');

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0]).toEqual(action);
    });

    it('should register multiple actions for the same target field', () => {
      const action1: AsyncAction = {
        targetField: 'cities',
        dependsOn: ['state'],
        source: '/api/cities?state={{state}}',
        method: 'GET',
        valuePath: '$.data[*].{value:id, label:name}',
        cache: 'request',
        debounce: 300,
      };

      const action2: AsyncAction = {
        targetField: 'cities',
        dependsOn: ['postalCode'],
        source: '/api/cities/by-postal?code={{postalCode}}',
        method: 'GET',
        valuePath: '$.data[*].{value:id, label:name}',
        cache: 'none',
        debounce: 500,
      };

      registry.register(action1);
      registry.register(action2);
      const retrieved = registry.getActionsForField('cities');

      expect(retrieved).toHaveLength(2);
      expect(retrieved).toContainEqual(action1);
      expect(retrieved).toContainEqual(action2);
    });
  });

  describe('getFieldsThatDependOn', () => {
    it('should return all target fields that depend on a given source field', () => {
      registry.register({
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      registry.register({
        targetField: 'cities',
        dependsOn: ['state'],
        source: '/api/cities',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      registry.register({
        targetField: 'postalCodeHint',
        dependsOn: ['country', 'city'],
        source: '/api/postal-hint',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      const dependsOnCountry = registry.getFieldsThatDependOn('country');
      const dependsOnState = registry.getFieldsThatDependOn('state');
      const dependsOnCity = registry.getFieldsThatDependOn('city');

      expect(dependsOnCountry).toEqual(new Set(['states', 'postalCodeHint']));
      expect(dependsOnState).toEqual(new Set(['cities']));
      expect(dependsOnCity).toEqual(new Set(['postalCodeHint']));
    });

    it('should return empty set for field with no dependents', () => {
      registry.register({
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      const dependsOnZip = registry.getFieldsThatDependOn('zipCode');
      expect(dependsOnZip).toEqual(new Set());
    });
  });

  describe('hasAsyncAction', () => {
    it('should return true for fields with registered async actions', () => {
      registry.register({
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      expect(registry.hasAsyncAction('states')).toBe(true);
      expect(registry.hasAsyncAction('cities')).toBe(false);
    });
  });

  describe('getAllAsyncFields', () => {
    it('should return all fields that have async actions', () => {
      registry.register({
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      registry.register({
        targetField: 'cities',
        dependsOn: ['state'],
        source: '/api/cities',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      const asyncFields = registry.getAllAsyncFields();
      expect(asyncFields).toEqual(new Set(['states', 'cities']));
    });
  });

  describe('clear', () => {
    it('should remove all registered actions', () => {
      registry.register({
        targetField: 'states',
        dependsOn: ['country'],
        source: '/api/states',
        method: 'GET',
        valuePath: '',
        cache: 'none',
        debounce: 300,
      });

      expect(registry.getAllAsyncFields().size).toBe(1);

      registry.clear();

      expect(registry.getAllAsyncFields().size).toBe(0);
      expect(registry.getActionsForField('states')).toEqual([]);
      expect(registry.getFieldsThatDependOn('country')).toEqual(new Set());
    });
  });
});
