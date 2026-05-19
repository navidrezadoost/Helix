<?php

namespace App\Services\Helix;

class RuleEngine
{
    public function validate(array $compiledGraph, array $data): array
    {
        $errors = [];
        
        foreach ($compiledGraph['fields'] ?? [] as $fieldName => $config) {
            $value = $data[$fieldName] ?? null;
            
            if ($config['required'] ?? false) {
                if ($value === null || $value === '' || $value === []) {
                    $errors[$fieldName][] = "{$fieldName} is required";
                    continue;
                }
            }
            
            if ($value === null) continue;
            
            if (isset($config['type'])) {
                if (!$this->validateType($value, $config['type'])) {
                    $errors[$fieldName][] = "{$fieldName} must be of type {$config['type']}";
                    continue;
                }
            }
            
            if (isset($config['min']) && is_numeric($value) && $value < $config['min']) {
                $errors[$fieldName][] = "{$fieldName} must be at least {$config['min']}";
            }
            
            if (isset($config['max']) && is_numeric($value) && $value > $config['max']) {
                $errors[$fieldName][] = "{$fieldName} must be at most {$config['max']}";
            }
            
            if (isset($config['pattern']) && is_string($value)) {
                if (!preg_match($config['pattern'], $value)) {
                    $errors[$fieldName][] = "{$fieldName} format is invalid";
                }
            }
        }
        
        return [
            'valid' => empty($errors),
            'errors' => $errors,
        ];
    }
    
    private function validateType($value, string $type): bool
    {
        return match($type) {
            'string' => is_string($value),
            'number' => is_numeric($value),
            'boolean' => is_bool($value),
            'array' => is_array($value),
            'object' => is_object($value) || is_array($value),
            default => true,
        };
    }
}