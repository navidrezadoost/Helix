// packages/helix-benchmark/src/index.ts

import { BenchmarkRunner } from './benchmark-runner';

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ██╗  ██╗███████╗██╗     ██╗██╗  ██╗                      ║
║   ██║  ██║██╔════╝██║     ██║╚██╗██╔╝                      ║
║   ███████║█████╗  ██║     ██║ ╚███╔╝                       ║
║   ██╔══██║██╔══╝  ██║     ██║ ██╔██╗                       ║
║   ██║  ██║███████╗███████╗██║██╔╝ ██╗                      ║
║   ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝                      ║
║                                                              ║
║         PERFORMANCE BENCHMARK SUITE v1.0                    ║
║         Measuring I/O Neutrality & Prefetch Gains           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);

  const runner = new BenchmarkRunner();
  
  try {
    await runner.runAll();
    console.log('\n✨ Benchmark suite completed successfully!');
  } catch (error) {
    console.error('\n❌ Benchmark suite failed:', error);
    process.exit(1);
  }
}

main();
