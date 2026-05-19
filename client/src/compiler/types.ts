// client/src/compiler/types.ts

// --- Raw Schema Types (Input) ---
export interface RawFieldSchema {
    name: string;
    type: string;
    label?: string;
    standard_validations?: any[];
    relational?: {
        visibility?: any;
        required?: any;
        rules?: any[];
    };
}

export interface RawSchema {
    schema_id: string;
    version: string;
    settings?: any;
    fields: RawFieldSchema[];
    form_level_rules?: any[];
}

// --- Compiled Runtime Types (Output IR) ---
export interface CompiledFieldNode {
    id: string;
    dependencies: string[]; // Extracted from AST
    relationalConfig: {
        visibility?: any;
        required?: any;
        rules?: any[];
    };
}

export interface CompiledGraph {
    schemaId: string;
    version: string;
    nodes: Map<string, CompiledFieldNode>;
    formLevelRules: any[];
}
