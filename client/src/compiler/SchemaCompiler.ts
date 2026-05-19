// client/src/compiler/SchemaCompiler.ts
import { RawSchema, CompiledGraph, CompiledFieldNode } from './types';
import { DependencyExtractor } from './DependencyExtractor';

export class SchemaCompiler {
    private extractor: DependencyExtractor;

    constructor() {
        this.extractor = new DependencyExtractor();
    }

    /**
     * Compiles raw JSON schema into a Runtime Graph
     */
    public compile(raw: RawSchema): CompiledGraph {
        this.validate(raw);

        const nodes = new Map<string, CompiledFieldNode>();

        for (const field of raw.fields) {
            const deps = this.extractFieldDependencies(field);
            
            nodes.set(field.name, {
                id: field.name,
                dependencies: deps,
                relationalConfig: field.relational || {}
            });
        }

        return {
            schemaId: raw.schema_id,
            version: raw.version,
            nodes,
            formLevelRules: raw.form_level_rules || []
        };
    }

    private extractFieldDependencies(field: any): string[] {
        if (!field.relational) return [];
        
        const allDeps = new Set<string>();

        if (field.relational.visibility) {
            this.extractor.extractFromAst(field.relational.visibility).forEach(d => allDeps.add(d));
        }

        if (field.relational.required) {
            this.extractor.extractFromAst(field.relational.required).forEach(d => allDeps.add(d));
        }

        if (field.relational.rules) {
            for (const rule of field.relational.rules) {
                if (rule.condition) {
                    this.extractor.extractFromAst(rule.condition).forEach(d => allDeps.add(d));
                }
            }
        }

        return Array.from(allDeps);
    }

    private validate(raw: RawSchema): void {
        if (!raw.schema_id) throw new Error('[SchemaCompiler] Missing schema_id');
        if (!raw.fields || !Array.isArray(raw.fields)) throw new Error('[SchemaCompiler] Missing fields array');
    }
}
