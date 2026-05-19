// client/src/compiler/DependencyExtractor.ts

export class DependencyExtractor {
    /**
     * Traverses a JsonLogic AST and extracts all field dependencies implicitly.
     * Looks for {"var": "field_name"} patterns.
     */
    public extractFromAst(ast: any): string[] {
        if (!ast || typeof ast !== 'object') {
            return [];
        }

        const deps = new Set<string>();
        this.traverse(ast, deps);
        return Array.from(deps);
    }

    private traverse(node: any, deps: Set<string>): void {
        if (!node || typeof node !== 'object') return;

        if (Array.isArray(node)) {
            for (const child of node) {
                this.traverse(child, deps);
            }
            return;
        }

        const keys = Object.keys(node);
        if (keys.length === 1 && keys[0] === 'var') {
            const varName = node['var'];
            if (typeof varName === 'string' && varName !== '') {
                deps.add(varName);
            }
        } else {
            for (const key of keys) {
                this.traverse(node[key], deps);
            }
        }
    }
}
