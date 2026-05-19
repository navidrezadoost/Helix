<?php

namespace App\Services\Helix;

class RuleEngine
{
    public function __construct(private RelationalRuleEngine $relationalEngine) {}

    public function validate(array $compiledGraph, array $data): array
    {
        $errors = [];
        
        // 1. First evaluate relational rules to determine required/visibility
        $fieldStates = $this->relationalEngine->evaluate($compiledGraph, $data);
        
        // 2. Then run non-relational validation on visible + required fields
        foreach ($compiledGraph['fields'] ?? [] as $fieldName => $config) {
            $state = $fieldStates[$fieldName] ?? [];
            $isRequired = $state['required'] ?? ($config['required'] ?? false);
            $isVisible = $state['visible'] ?? true;
            
            if (!$isVisible) continue;
            
            $value = $data[$fieldName] ?? null;
            
            if ($isRequired) {
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
            
            if (isset($config['enum']) && is_array($config['enum']) && !in_array($value, $config['enum'], true)) {
                $errors[$fieldName][] = "{$fieldName} must be one of: " . implode(', ', $config['enum']);
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
