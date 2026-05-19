export class ExpressionEngine {
  evaluate(
    expression: string,
    context: Record<string, unknown>,
    constants: Record<string, unknown> = {}
  ): unknown {
    const scope = { ...constants, ...context };
    const argNames = Object.keys(scope);
    const argValues = Object.values(scope);

    try {
      const evaluator = new Function(...argNames, `return (${expression});`);
      return evaluator(...argValues);
    } catch (error) {
      console.error('[Helix] Expression evaluation failed:', error);
      return false;
    }
  }
}