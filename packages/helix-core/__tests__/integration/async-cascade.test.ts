import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReactiveStore } from '../../src/store/ReactiveStore';
import { ExpressionEngine } from '../../src/expression/ExpressionEngine';
import { RuntimeGraphBuilder } from '../../src/graph/RuntimeGraphBuilder';

describe('Integration: Async Cascade (Country → States → Cities → ZipHint)', () => {
  let store: ReactiveStore;
  let mockFetch: ReturnType<typeof vi.fn>;
  let stateHistory: Array<Record<string, any>> = [];

  const fullGraph = {
    schema_id: 'address-form',
    version: 1,
    dag_hash: 'sha256:full',
    dag_evaluation_order: ['country', 'states', 'cities', 'zipHint', 'fullAddress'],
    fields: {
      country: { type: 'select', required: true, options: [] },
      states: { type: 'select', required: false, options: [] },
      cities: { type: 'select', required: false, options: [] },
      zipHint: { type: 'text', required: false },
      fullAddress: { type: 'text', required: false },
    },
    rules: [
      {
        depends_on: ['country'],
        condition: 'country !== null',
        actions: [{ type: 'populateSelect', field: 'states', source: '/api/states?country={{country}}', method: 'GET', valuePath: '$.data[*].{value:code, label:name}', cache: 'session', debounce: 50 }],
      },
      {
        depends_on: ['states'],
        condition: 'states !== null',
        actions: [{ type: 'populateSelect', field: 'cities', source: '/api/cities?state={{states}}', method: 'GET', valuePath: '$.data[*].{value:id, label:name}', cache: 'request', debounce: 50 }],
      },
      {
        depends_on: ['cities'],
        condition: 'cities !== null',
        actions: [{ type: 'setValue', field: 'fullAddress', value: 'Address will be auto-filled' }],
      },
    ],
    constants: {},
  };

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    stateHistory = [];
    
    const expressionEngine = new ExpressionEngine();
    store = new ReactiveStore(expressionEngine);
    const depMap = RuntimeGraphBuilder.buildDependencyMap(fullGraph as any);
    store.initGraph(fullGraph as any, depMap);
    
    store.subscribe((state) => {
      const snapshot: Record<string, any> = {};
      for (const [key, fieldState] of state.entries()) {
        snapshot[key] = {
          value: fieldState.value,
          options: fieldState.options,
          loading: fieldState.asyncState?.isLoading,
        };
      }
      stateHistory.push(snapshot);
    });
  });

  afterEach(() => {
    store.destroy();
    vi.clearAllMocks();
  });

  it('should complete full cascade from country selection to address auto-fill', async () => {
    // Mock states API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ code: 'CA', name: 'California' }, { code: 'NY', name: 'New York' }] }),
    });
    
    // Mock cities API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ id: 'LA', name: 'Los Angeles' }, { id: 'SF', name: 'San Francisco' }] }),
    });

    // Step 1: Select country
    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 2: Verify states loaded
    const statesAfter = store.getFieldState('states');
    expect(statesAfter?.options).toHaveLength(2);
    
    // Step 3: Select state
    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'states', value: 'CA' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Step 4: Verify cities loaded
    const citiesAfter = store.getFieldState('cities');
    expect(citiesAfter?.options).toHaveLength(2);
    
    // Step 5: Verify fullAddress auto-filled
    const addressAfter = store.getFieldState('fullAddress');
    expect(addressAfter?.value).toBe('Address will be auto-filled');
  });

  it('should track loading states correctly through cascade', async () => {
    let resolveStates: (value: any) => void;
    const statesPromise = new Promise((resolve) => { resolveStates = resolve; });
    
    let resolveCities: (value: any) => void;
    const citiesPromise = new Promise((resolve) => { resolveCities = resolve; });
    
    mockFetch
      .mockReturnValueOnce(statesPromise)
      .mockReturnValueOnce(citiesPromise);

    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // States should be loading
    let statesField = store.getFieldState('states');
    expect(statesField?.asyncState?.isLoading).toBe(true);
    
    // Resolve states
    resolveStates!({
      ok: true,
      json: async () => ({ data: [{ code: 'CA', name: 'California' }] }),
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // States done loading
    statesField = store.getFieldState('states');
    expect(statesField?.asyncState?.isLoading).toBe(false);
    
    // Select state triggers cities loading
    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'states', value: 'CA' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const citiesField = store.getFieldState('cities');
    expect(citiesField?.asyncState?.isLoading).toBe(true);
    
    // Resolve cities
    resolveCities!({
      ok: true,
      json: async () => ({ data: [{ id: 'LA', name: 'Los Angeles' }] }),
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const citiesAfter = store.getFieldState('cities');
    expect(citiesAfter?.asyncState?.isLoading).toBe(false);
  });

  it('should handle cascade interruption when parent changes mid-cascade', async () => {
    let resolveStatesUS: (value: any) => void;
    const statesUSPromise = new Promise((resolve) => { resolveStatesUS = resolve; });
    
    let resolveStatesCA: (value: any) => void;
    const statesCAPromise = new Promise((resolve) => { resolveStatesCA = resolve; });
    
    mockFetch
      .mockReturnValueOnce(statesUSPromise)   // US request
      .mockReturnValueOnce(statesCAPromise);  // CA request

    // Select US
    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Before US resolves, change to Canada
    store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // US response arrives late (should be ignored)
    resolveStatesUS!({
      ok: true,
      json: async () => ({ data: [{ code: 'NY', name: 'New York' }] }),
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    
    // CA response arrives
    resolveStatesCA!({
      ok: true,
      json: async () => ({ data: [{ code: 'BC', name: 'British Columbia' }] }),
    });
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should have CA states, not US states
    const statesField = store.getFieldState('states');
    expect(statesField?.options).toEqual([
      { value: 'BC', label: 'British Columbia' },
    ]);
    
    // Cities should NOT have been fetched (states not selected yet)
    expect(mockFetch).not.toHaveBeenCalledWith('/api/cities?state=NY', expect.any(Object));
  });
});
