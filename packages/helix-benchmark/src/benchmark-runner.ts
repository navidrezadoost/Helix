// packages/helix-benchmark/src/benchmark-runner.ts

import { MetricsCollector, BenchmarkResult } from './measurements';
import { SCENARIOS, BenchmarkScenario } from './scenarios';

// Mock implementations for testing (replace with actual Helix imports)
interface BenchmarkContext {
  render: () => Promise<number>;
  changeField: (fieldId: string, value: any) => Promise<number>;
  waitForAsync: () => Promise<number>;
  submit: () => Promise<number>;
  measureMemory: () => number;
  destroy: () => void;
}

class ReactBenchmarkRunner {
  async setup(scenario: BenchmarkScenario): Promise<BenchmarkContext> {
    // Dynamically import React and Helix React SDK
    const { HelixForm } = await import('@helix/react');
    const { createRoot } = await import('react-dom/client');
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Create form with scenario configuration
    const form = HelixForm({
      schemaId: `benchmark-${scenario.name}`,
      version: 1,
      endpoint: 'http://localhost:3000/api',
      shopifyAuth: false,
    });
    
    const root = createRoot(container);
    let resolveRender: (value: number) => void;
    let renderStart: number;
    
    return {
      render: async () => {
        renderStart = performance.now();
        return new Promise((resolve) => {
          resolveRender = resolve;
          root.render(form);
          // Wait for render completion
          setTimeout(() => {
            resolveRender(performance.now() - renderStart);
          }, 0);
        });
      },
      changeField: async (fieldId: string, value: any) => {
        const start = performance.now();
        // Simulate field change
        const input = document.querySelector(`[data-field-id="${fieldId}"]`) as HTMLElement;
        if (input) {
          input.dispatchEvent(new CustomEvent('change', { detail: { value } }));
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        return performance.now() - start;
      },
      waitForAsync: async () => {
        const start = performance.now();
        // Wait for all async actions to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        return performance.now() - start;
      },
      submit: async () => {
        const start = performance.now();
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLElement;
        if (submitBtn) {
          submitBtn.click();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return performance.now() - start;
      },
      measureMemory: () => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize / 1024;
        }
        return 0;
      },
      destroy: () => {
        root.unmount();
        container.remove();
      },
    };
  }
}

class WebComponentBenchmarkRunner {
  async setup(scenario: BenchmarkScenario): Promise<BenchmarkContext> {
    // Import web components
    await import('@helix/webcomponents');
    
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    const form = document.createElement('helix-form');
    form.setAttribute('schema-id', `benchmark-${scenario.name}`);
    form.setAttribute('schema-version', '1');
    form.setAttribute('endpoint', 'http://localhost:3000/api');
    form.setAttribute('platform', 'benchmark');
    
    container.appendChild(form);
    
    // Wait for form to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      render: async () => {
        const start = performance.now();
        // Force a re-render
        form.setAttribute('schema-version', '1');
        await new Promise(resolve => setTimeout(resolve, 0));
        return performance.now() - start;
      },
      changeField: async (fieldId: string, value: any) => {
        const start = performance.now();
        const field = form.shadowRoot?.querySelector(`helix-field[field-id="${fieldId}"]`);
        if (field) {
          const input = field.shadowRoot?.querySelector('input, select');
          if (input) {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            (input as HTMLInputElement).value = value;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
        return performance.now() - start;
      },
      waitForAsync: async () => {
        const start = performance.now();
        await new Promise(resolve => setTimeout(resolve, 500));
        return performance.now() - start;
      },
      submit: async () => {
        const start = performance.now();
        const submitBtn = form.shadowRoot?.querySelector('.helix-submit') as HTMLElement;
        if (submitBtn) {
          submitBtn.click();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        return performance.now() - start;
      },
      measureMemory: () => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize / 1024;
        }
        return 0;
      },
      destroy: () => {
        container.remove();
      },
    };
  }
}

export class BenchmarkRunner {
  private collector = new MetricsCollector();
  private iterations = 10;

  async runAll(): Promise<void> {
    console.log('🚀 Starting Helix Performance Benchmark Suite...\n');

    for (const scenario of SCENARIOS) {
      console.log(`\n📊 Running scenario: ${scenario.name} (${scenario.description})`);
      
      // Run React benchmarks
      await this.runPlatformBenchmark(scenario, 'react');
      
      // Run Web Component benchmarks
      await this.runPlatformBenchmark(scenario, 'webcomponent');
      
      // Run prefetch comparison
      await this.runPrefetchComparison(scenario);
    }

    // Generate report
    console.log('\n📈 Generating performance report...');
    console.log(this.collector.generateReport());
    
    // Save to file
    const fs = await import('node:fs');
    fs.writeFileSync('./benchmark-results.json', this.collector.exportToJSON());
    fs.writeFileSync('./benchmark-report.md', this.collector.generateReport());
    
    console.log('\n✅ Benchmark complete! Results saved to benchmark-results.json and benchmark-report.md');
  }

  private async runPlatformBenchmark(
    scenario: BenchmarkScenario,
    platform: 'react' | 'webcomponent'
  ): Promise<void> {
    const runner = platform === 'react' 
      ? new ReactBenchmarkRunner() 
      : new WebComponentBenchmarkRunner();
    
    // Warmup
    const warmupCtx = await runner.setup(scenario);
    await warmupCtx.render();
    await warmupCtx.destroy();
    
    // Actual benchmark
    const ctx = await runner.setup(scenario);
    
    // Measure render time
    let totalRender = 0;
    for (let i = 0; i < this.iterations; i++) {
      totalRender += await ctx.render();
    }
    const avgRender = totalRender / this.iterations;
    this.collector.add({
      scenario: scenario.name,
      platform,
      metric: 'render-time',
      valueMs: avgRender,
      iterations: this.iterations,
      timestamp: Date.now(),
    });
    
    // Measure field change propagation
    let totalChange = 0;
    for (let i = 0; i < this.iterations; i++) {
      totalChange += await ctx.changeField('test_field', `value_${i}`);
    }
    const avgChange = totalChange / this.iterations;
    this.collector.add({
      scenario: scenario.name,
      platform,
      metric: 'change-propagation',
      valueMs: avgChange,
      iterations: this.iterations,
      timestamp: Date.now(),
    });
    
    // Measure async cascade if applicable
    if (scenario.asyncFields > 0) {
      let totalCascade = 0;
      for (let i = 0; i < this.iterations; i++) {
        const start = performance.now();
        await ctx.changeField('country', 'US');
        await ctx.waitForAsync();
        totalCascade += performance.now() - start;
      }
      const avgCascade = totalCascade / this.iterations;
      this.collector.add({
        scenario: scenario.name,
        platform,
        metric: 'cascade-completion',
        valueMs: avgCascade,
        iterations: this.iterations,
        timestamp: Date.now(),
      });
    }
    
    // Measure memory footprint
    const memory = ctx.measureMemory();
    if (memory > 0) {
      this.collector.add({
        scenario: scenario.name,
        platform,
        metric: 'memory-footprint',
        valueMs: memory,
        iterations: 1,
        timestamp: Date.now(),
      });
    }
    
    ctx.destroy();
  }

  private async runPrefetchComparison(scenario: BenchmarkScenario): Promise<void> {
    if (scenario.asyncFields === 0) return;
    
    console.log(`  🔄 Measuring prefetch impact for ${scenario.name}...`);
    
    // Without prefetch
    const runnerNoPrefetch = new WebComponentBenchmarkRunner();
    const ctxNoPrefetch = await runnerNoPrefetch.setup(scenario);
    ctxNoPrefetch.render();
    
    const startNoPrefetch = performance.now();
    await ctxNoPrefetch.changeField('country', 'US');
    await ctxNoPrefetch.waitForAsync();
    const timeNoPrefetch = performance.now() - startNoPrefetch;
    ctxNoPrefetch.destroy();
    
    // With prefetch (enabled by default)
    const runnerWithPrefetch = new WebComponentBenchmarkRunner();
    const ctxWithPrefetch = await runnerWithPrefetch.setup(scenario);
    
    // Trigger prefetch by focusing the field first
    const countryField = document.querySelector('[data-field-id="country"]') as HTMLElement;
    if (countryField) {
      countryField.dispatchEvent(new FocusEvent('focus'));
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for prefetch
    }
    
    const startWithPrefetch = performance.now();
    await ctxWithPrefetch.changeField('country', 'US');
    await ctxWithPrefetch.waitForAsync();
    const timeWithPrefetch = performance.now() - startWithPrefetch;
    ctxWithPrefetch.destroy();
    
    this.collector.addComparison(
      scenario.name,
      'webcomponent',
      'cascade-with-prefetch',
      timeWithPrefetch,
      timeNoPrefetch
    );
  }
}
