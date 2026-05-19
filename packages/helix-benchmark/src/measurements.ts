// packages/helix-benchmark/src/measurements.ts

export interface BenchmarkResult {
  scenario: string;
  platform: 'react' | 'webcomponent';
  metric: string;
  valueMs: number;
  baselineMs?: number;
  improvementPercent?: number;
  memoryKB?: number;
  iterations: number;
  timestamp: number;
}

export class MetricsCollector {
  private results: BenchmarkResult[] = [];

  add(result: BenchmarkResult): void {
    this.results.push(result);
    console.log(`[Benchmark] ${result.scenario} | ${result.platform} | ${result.metric}: ${result.valueMs}ms`);
  }

  addComparison(
    scenario: string,
    platform: 'react' | 'webcomponent',
    metric: string,
    valueMs: number,
    baselineMs: number
  ): void {
    const improvementPercent = ((baselineMs - valueMs) / baselineMs) * 100;
    this.add({
      scenario,
      platform,
      metric,
      valueMs,
      baselineMs,
      improvementPercent,
      iterations: 10,
      timestamp: Date.now(),
    });
  }

  generateReport(): string {
    const grouped = new Map<string, BenchmarkResult[]>();
    
    for (const result of this.results) {
      const key = `${result.scenario}-${result.metric}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(result);
    }

    let report = '# Helix Performance Benchmark Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += '## Results Summary\n\n';
    report += '| Scenario | Metric | React (ms) | Web Component (ms) | Improvement |\n';
    report += '|----------|--------|------------|-------------------|-------------|\n';

    for (const [key, results] of grouped) {
      const reactResult = results.find(r => r.platform === 'react');
      const wcResult = results.find(r => r.platform === 'webcomponent');
      
      if (reactResult && wcResult) {
        const improvement = ((reactResult.valueMs - wcResult.valueMs) / reactResult.valueMs) * 100;
        report += `| ${reactResult.scenario} | ${reactResult.metric} | ${reactResult.valueMs.toFixed(2)} | ${wcResult.valueMs.toFixed(2)} | ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}% |\n`;
      }
    }

    report += '\n## Prefetching Impact\n\n';
    
    const prefetchResults = this.results.filter(r => r.metric === 'cascade-with-prefetch');
    if (prefetchResults.length > 0) {
      report += '| Scenario | Without Prefetch (ms) | With Prefetch (ms) | Reduction |\n';
      report += '|----------|---------------------|-------------------|-----------|\n';
      for (const result of prefetchResults) {
        if (result.baselineMs) {
          const reduction = ((result.baselineMs - result.valueMs) / result.baselineMs) * 100;
          report += `| ${result.scenario} | ${result.baselineMs.toFixed(2)} | ${result.valueMs.toFixed(2)} | ${reduction.toFixed(1)}% |\n`;
        }
      }
    }

    return report;
  }

  exportToJSON(): string {
    return JSON.stringify(this.results, null, 2);
  }
}
