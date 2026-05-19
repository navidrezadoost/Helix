<?php

namespace Helix\Core;

use Helix\Core\Application\Validation\ValidationEngine;
use Helix\Core\Domain\Contracts\SchemaRegistryInterface;
use Helix\Core\Application\Validation\ValidationResult;

final class HelixCore
{
    private static ?self $instance = null;
    private ValidationEngine $validationEngine;

    public static function getInstance(SchemaRegistryInterface $registry): self
    {
        if (self::$instance === null) {
            self::$instance = new self($registry);
        }
        return self::$instance;
    }

    private function __construct(SchemaRegistryInterface $registry)
    {
        // ValidationEngine instantiation will be updated once the class is created
        // $this->validationEngine = new ValidationEngine($registry);
    }

    // public function validate(string $schemaId, string $version, array $formData): ValidationResult
    // {
    //     return $this->validationEngine->validate($schemaId, $version, $formData);
    // }
}