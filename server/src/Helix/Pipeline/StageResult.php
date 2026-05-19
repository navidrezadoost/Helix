<?php
namespace Helix\Pipeline;

class StageResult
{
    public function __construct(
        public readonly string $stageName,
        public readonly bool $success,
        public readonly array $data,
        public readonly ?string $error = null,
        public readonly ?string $integrityHash = null,
    ) {}
}
