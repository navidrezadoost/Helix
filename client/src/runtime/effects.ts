// client/src/runtime/effects.ts

export type EffectType = 'visibility' | 'required' | 'error' | 'meta' | 'value';

export interface BaseEffect {
    type: EffectType;
    field: string;
}

export interface VisibilityEffect extends BaseEffect {
    type: 'visibility';
    visible: boolean;
}

export interface RequiredEffect extends BaseEffect {
    type: 'required';
    required: boolean;
}

export interface ErrorEffect extends BaseEffect {
    type: 'error';
    errors: string[];
}

export interface ValueEffect extends BaseEffect {
    type: 'value';
    value: any;
}

export interface MetaEffect extends BaseEffect {
    type: 'meta';
    key: string;
    value: any;
}

export type RuntimeEffect = 
    | VisibilityEffect 
    | RequiredEffect 
    | ErrorEffect 
    | MetaEffect
    | ValueEffect;
