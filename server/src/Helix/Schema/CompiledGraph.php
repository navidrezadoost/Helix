<?php
namespace Helix\Schema;

class CompiledGraph
{
    public function __construct(
        public readonly string $schemaId,
        public readonly int $version,
        public readonly string $dagHash,
        public readonly array $dagEvaluationOrder,
        public readonly array $compiledGraph,
        public readonly array $fields,
        public readonly array $rules,
        public readonly array $constants,
    ) {}
}
