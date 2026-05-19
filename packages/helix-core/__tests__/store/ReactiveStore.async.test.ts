import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ReactiveStore } from '../../src/store/ReactiveStore';
import { ExpressionEngine } from '../../src/expression/ExpressionEngine';
import type { CompiledGraph } from '../../src/types';

describe('ReactiveStore - Async Dispatcher', () => {
  let store: ReactiveStore;
  let mockFetch: ReturnType<typeof vi.fn>;

  const createTestGraph = (): CompiledGraph => ({
    schema_id: 'test-form',
    version: 1,
    dag_hash: 'sha256:test',
    dag_evaluation_order: ['country', 'states', 'cities', 'zipHint'],
    fields: {
      country: {
        type: 'select',
        label: 'Country',
        required: true,
        options: [
          { value: 'US', label: 'United States' },
          { value: 'CA', label: 'Canada' },
          { value: 'MX', label: 'Mexico' },
        ],
      },
      states: {
        type: 'select',
        label: 'State/Province',
        required: true,
        options: [],
      },
      cities: {
        type: 'select',
        label: 'City',
        required: true,
        options: [],
      },
      zipHint: {
        type: 'text',
        label: 'Postal Code Hint',
        required: false,
      },
    },
    rules: [
      {
        depends_on: ['country'],
        condition: 'country !== null && country !== ""',
        actions: [
          {
            type: 'populateSelect',
            field: 'states',
            source: '/api/states?country={{country}}',
            method: 'GET',
            valuePath: '$.data[*].{value:code, label:name}',
            cache: 'session',
            debounce: 100,
          },
        ],
      },
      {
        depends_on: ['states'],
        condition: 'states !== null && states !== ""',
        actions: [
          {
            type: 'populateSelect',
            field: 'cities',
            source: '/api/cities?state={{states}}',
            method: 'GET',
            valuePath: '$.data[*].{value:id, label:name}',
            cache: 'request',
            debounce: 100,
          },
        ],
      },
      {
        depends_on: ['country', 'cities'],
        condition: 'country === "US" && cities !== null',
        actions: [
          {
            type: 'populateSelect',
            field: 'zipHint',
            source: '/api/zip-hint?city={{cities}}',
            method: 'GET',
            valuePath: '$.data[*].{value:zip, label:hint}',
            cache: 'none',
            debounce: 200,
          },
        ],
      },
    ],
    constants: {},
  });

  beforeEach(() => {
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch;
    
    const expressionEngine = new ExpressionEngine();
    store = new ReactiveStore(expressionEngine);
    
    const graph = createTestGraph();
    const dependencyMap = new Map();
    store.initGraph(graph, dependencyMap);
  });

  afterEach(() => {
    store.destroy();
    vi.clearAllMocks();
  });

  describe('country → states cascade', () => {
    it('should fetch states when country is selected', async () => {
      const mockStatesResponse = {
        data: [
          { code: 'CA', name: 'California' },
          { code: 'NY', name: 'New York' },
          { code: 'TX', name: 'Texas' },
        ],
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatesResponse,
      });

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });

      // Wait for debounce + async execution
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/states?country=US',
        expect.objectContaining({ method: 'GET', signal: expect.any(AbortSignal) })
      );

      const stateField = store.getFieldState('states');
      expect(stateField?.options).toEqual([
        { value: 'CA', label: 'California' },
        { value: 'NY', label: 'New York' },
        { value: 'TX', label: 'Texas' },
      ]);
      expect(stateField?.asyncState?.isLoading).toBe(false);
      expect(stateField?.asyncState?.lastError).toBeNull();
    });

    it('should show loading state during fetch', async () => {
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      
      mockFetch.mockReturnValue(fetchPromise);

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = store.getFieldState('states');
      expect(stateField?.asyncState?.isLoading).toBe(true);

      resolveFetch!({
        ok: true,
        json: async () => ({ data: [] }),
      });

      await fetchPromise;
      await new Promise(resolve => setTimeout(resolve, 0));

      const updatedField = store.getFieldState('states');
      expect(updatedField?.asyncState?.isLoading).toBe(false);
    });
  });

  describe('states → cities cascade', () => {
    it('should fetch cities after states are populated and selected', async () => {
      // Mock states response first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { code: 'CA', name: 'California' },
            { code: 'NY', name: 'New York' },
          ],
        }),
      });

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));

      // Mock cities response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'LA', name: 'Los Angeles' },
            { id: 'SF', name: 'San Francisco' },
          ],
        }),
      });

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'states', value: 'CA' });
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/cities?state=CA',
        expect.any(Object)
      );

      const citiesField = store.getFieldState('cities');
      expect(citiesField?.options).toEqual([
        { value: 'LA', label: 'Los Angeles' },
        { value: 'SF', label: 'San Francisco' },
      ]);
    });
  });

  describe('race condition prevention (AbortController)', () => {
    it('should cancel pending request when country changes rapidly', async () => {
      const abortSpy = vi.fn();
      
      // Create a promise that captures the AbortSignal
      let capturedSignal: AbortSignal | null = null;
      mockFetch.mockImplementation((url: string, options?: RequestInit) => {
        capturedSignal = options?.signal as AbortSignal;
        capturedSignal?.addEventListener('abort', abortSpy);
        return new Promise(() => {}); // Never resolves
      });

      // First selection: USA
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const firstSignal: AbortSignal | null = capturedSignal;
      
      // Second selection: Canada (rapid change)
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(abortSpy).toHaveBeenCalled();
      expect((firstSignal as AbortSignal | null)?.aborted).toBe(true);
    });

    it('should ignore stale responses when newer request supersedes', async () => {
      let resolveUS: (value: any) => void;
      let resolveCA: (value: any) => void;
      
      const promiseUS = new Promise((resolve) => { resolveUS = resolve; });
      const promiseCA = new Promise((resolve) => { resolveCA = resolve; });
      
      mockFetch
        .mockReturnValueOnce(promiseUS)  // US request
        .mockReturnValueOnce(promiseCA); // CA request

      // Dispatch US
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Dispatch CA before US completes
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // US response arrives late
      resolveUS!({
        ok: true,
        json: async () => ({ data: [{ code: 'wrong', name: 'Should be ignored' }] }),
      });
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // CA response arrives
      resolveCA!({
        ok: true,
        json: async () => ({ data: [{ code: 'BC', name: 'British Columbia' }] }),
      });
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = store.getFieldState('states');
      expect(stateField?.options).toEqual([
        { value: 'BC', label: 'British Columbia' },
      ]);
    });
  });

  describe('cache behavior', () => {
    it('should return cached session data on subsequent requests', async () => {
      const mockResponse = {
        data: [
          { code: 'CA', name: 'California' },
          { code: 'NY', name: 'New York' },
        ],
      };
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      // First request
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Change to another country and back to US
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      mockFetch.mockClear();
      
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should NOT fetch again (cache hit)
      expect(mockFetch).not.toHaveBeenCalled();
      
      const stateField = store.getFieldState('states');
      expect(stateField?.options).toEqual([
        { value: 'CA', label: 'California' },
        { value: 'NY', label: 'New York' },
      ]);
    });

    it('should deduplicate concurrent identical requests', async () => {
      let resolveRequest: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveRequest = resolve;
      });
      
      mockFetch.mockReturnValue(pendingPromise);

      // Trigger two identical requests rapidly
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should only have been called once (deduplication)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      resolveRequest!({
        ok: true,
        json: async () => ({ data: [{ code: 'CA', name: 'California' }] }),
      });
      await pendingPromise;
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const stateField = store.getFieldState('states');
      expect(stateField?.options).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('should capture network errors and set error state', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = store.getFieldState('states');
      expect(stateField?.asyncState?.isLoading).toBe(false);
      expect(stateField?.asyncState?.lastError).toBe('Network failure');
    });

    it('should capture HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = store.getFieldState('states');
      expect(stateField?.asyncState?.lastError).toContain('HTTP 500');
    });

    it('should allow retry after error by dispatching same field change', async () => {
      // First request fails
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));
      
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const firstState = store.getFieldState('states');
      expect(firstState?.asyncState?.lastError).toBe('Timeout');
      
      // Retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ code: 'CA', name: 'California' }] }),
      });
      
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const retryState = store.getFieldState('states');
      expect(retryState?.asyncState?.lastError).toBeNull();
      expect(retryState?.options).toHaveLength(1);
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid changes to the same field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ code: 'CA', name: 'California' }] }),
      });

      // Rapid changes to country
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'MX' });
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not have fetched yet (debounce window)
      expect(mockFetch).not.toHaveBeenCalled();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should fetch only once with the final value
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/states?country=MX', expect.any(Object));
    });
  });

  describe('valuePath extraction', () => {
    it('should extract options using JSONPath pattern', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { code: 'BC', name: 'British Columbia' },
            { code: 'ON', name: 'Ontario' },
            { code: 'QC', name: 'Quebec' },
          ],
        }),
      });

      store.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'CA' });
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = store.getFieldState('states');
      expect(stateField?.options).toEqual([
        { value: 'BC', label: 'British Columbia' },
        { value: 'ON', label: 'Ontario' },
        { value: 'QC', label: 'Quebec' },
      ]);
    });

    it('should handle direct array response', async () => {
      // Override graph for this test
      const directArrayGraph: CompiledGraph = {
        ...createTestGraph(),
        rules: [{
          depends_on: ['country'],
          condition: 'country !== null',
          actions: [{
            type: 'populateSelect',
            field: 'states',
            source: '/api/states?country={{country}}',
            method: 'GET',
            valuePath: '$.data', // Direct array path
            cache: 'none',
            debounce: 100,
          }],
        }],
      };
      
      const expressionEngine = new ExpressionEngine();
      const testStore = new ReactiveStore(expressionEngine);
      testStore.initGraph(directArrayGraph, new Map());
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ['CA', 'NY', 'TX'],
      });

      testStore.dispatch({ type: 'FIELD_CHANGE', nodeId: 'country', value: 'US' });
      await new Promise(resolve => setTimeout(resolve, 150));

      const stateField = testStore.getFieldState('states');
      expect(stateField?.options).toEqual([
        { value: 'CA', label: 'CA' },
        { value: 'NY', label: 'NY' },
        { value: 'TX', label: 'TX' },
      ]);
      
      testStore.destroy();
    });
  });
});
