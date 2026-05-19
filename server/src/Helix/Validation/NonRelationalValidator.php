<?php
namespace Helix\Validation;

class NonRelationalValidator
{
    public function validate(string $fieldName, mixed $value, array $fieldConfig, bool $isRequired = false): ValidationResult
    {
        // 1. Required check
        $isEmpty = $value === null || $value === '' || $value === [];
        if ($isRequired && $isEmpty && $value !== 0 && $value !== '0' && $value !== false) {
            return new ValidationResult(false, "Field '{$fieldName}' is required.");
        }

        if ($isEmpty) {
            return new ValidationResult(true);
        }

        // 2. Type check
        if (isset($fieldConfig['type'])) {
            $type = $fieldConfig['type'];
            if ($type === 'number' && !is_numeric($value)) {
                return new ValidationResult(false, "Field '{$fieldName}' must be a number.");
            }
            if ($type === 'boolean' && !is_bool($value) && $value !== 1 && $value !== 0 && $value !== '1' && $value !== '0') {
                return new ValidationResult(false, "Field '{$fieldName}' must be a boolean.");
            }
            if ($type === 'string' && !is_string($value) && !is_numeric($value)) {
                return new ValidationResult(false, "Field '{$fieldName}' must be a string.");
            }
        }

        // 3. Min/Max check
        if (isset($fieldConfig['min'])) {
            if (is_numeric($value) && $value < $fieldConfig['min']) {
                return new ValidationResult(false, "Field '{$fieldName}' must be >= {$fieldConfig['min']}.");
            }
            if (is_string($value) && strlen($value) < $fieldConfig['min']) {
                return new ValidationResult(false, "Field '{$fieldName}' must be at least {$fieldConfig['min']} characters.");
            }
        }

        if (isset($fieldConfig['max'])) {
            if (is_numeric($value) && $value > $fieldConfig['max']) {
                return new ValidationResult(false, "Field '{$fieldName}' must be <= {$fieldConfig['max']}.");
            }
            if (is_string($value) && strlen($value) > $fieldConfig['max']) {
                return new ValidationResult(false, "Field '{$fieldName}' must be at most {$fieldConfig['max']} characters.");
            }
        }

        // 4. Pattern check
        if (isset($fieldConfig['pattern']) && is_string($value)) {
            if (preg_match($fieldConfig['pattern'], $value) === 0) {
                return new ValidationResult(false, "Field '{$fieldName}' format is invalid.");
            }
        }

        // 5. Enum check
        if (isset($fieldConfig['enum']) && is_array($fieldConfig['enum'])) {
            if (!in_array($value, $fieldConfig['enum'], true)) {
                return new ValidationResult(false, "Field '{$fieldName}' must be one of the allowed values.");
            }
        }

        return new ValidationResult(true);
    }
}
