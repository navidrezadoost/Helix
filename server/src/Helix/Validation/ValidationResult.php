<?php
namespace Helix\Validation;

class ValidationResult
{
    public function __construct(
        public readonly bool $passed,
        public readonly ?string $errorMessage = null,
    ) {}
}
