// packages/helix-benchmark/src/scenarios.ts

export interface BenchmarkScenario {
  name: string;
  description: string;
  fieldCount: number;
  ruleCount: number;
  asyncFields: number;
  dependencyDepth: number;
  expectedThresholdMs: {
    render: number;
    change: number;
    cascade: number;
    submission: number;
  };
}

export const SCENARIOS: BenchmarkScenario[] = [
  {
    name: 'small-form',
    description: 'Simple contact form, no async dependencies',
    fieldCount: 5,
    ruleCount: 0,
    asyncFields: 0,
    dependencyDepth: 0,
    expectedThresholdMs: { render: 50, change: 5, cascade: 0, submission: 20 },
  },
  {
    name: 'medium-cascade',
    description: 'Country → States → Cities cascade (3-level async)',
    fieldCount: 10,
    ruleCount: 3,
    asyncFields: 2,
    dependencyDepth: 2,
    expectedThresholdMs: { render: 100, change: 10, cascade: 200, submission: 50 },
  },
  {
    name: 'large-deep-dependencies',
    description: 'Complex form with 30 fields, 20 rules, 5-level dependencies',
    fieldCount: 30,
    ruleCount: 20,
    asyncFields: 5,
    dependencyDepth: 5,
    expectedThresholdMs: { render: 200, change: 50, cascade: 400, submission: 100 },
  },
  {
    name: 'xl-enterprise',
    description: 'Enterprise form: 100 fields, 50 rules, 10 async cascades',
    fieldCount: 100,
    ruleCount: 50,
    asyncFields: 10,
    dependencyDepth: 4,
    expectedThresholdMs: { render: 500, change: 100, cascade: 600, submission: 200 },
  },
];
