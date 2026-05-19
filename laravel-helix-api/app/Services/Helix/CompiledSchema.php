<?php

namespace App\Services\Helix;

class CompiledSchema
{
    public function __construct(
        public readonly string $dagHash,
        public readonly array $dagEvaluationOrder,
        public readonly array $fields,
        public readonly array $rules,
        public readonly array $constants,
    ) {
    }
}
