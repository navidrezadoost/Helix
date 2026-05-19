<?php

namespace App\Services\Helix;

use Illuminate\Validation\ValidationException;

class SchemaValidator
{
    public function validate(array $schema): CompiledSchema
    {
        $fields = $this->normalizeFields($schema['fields'] ?? []);
        $rules = $this->normalizeRules($schema['rules'] ?? []);
        $constants = $schema['constants'] ?? [];
        $dagEvaluationOrder = $this->buildDagEvaluationOrder($fields, $rules);

        $dagHash = hash('sha256', json_encode([
            'schema_id' => $schema['schema_id'] ?? null,
            'version' => $schema['version'] ?? null,
            'fields' => $fields,
            'rules' => $rules,
            'constants' => $constants,
            'dag_evaluation_order' => $dagEvaluationOrder,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

        return new CompiledSchema(
            dagHash: $dagHash,
            dagEvaluationOrder: $dagEvaluationOrder,
            fields: $fields,
            rules: $rules,
            constants: $constants,
        );
    }

    private function normalizeFields(array $fields): array
    {
        $normalized = [];

        foreach ($fields as $key => $field) {
            if (!is_array($field)) {
                throw ValidationException::withMessages([
                    'fields' => 'Each field must be an object/array.',
                ]);
            }

            $fieldId = $field['id'] ?? (is_string($key) ? $key : null);
            if (!$fieldId) {
                throw ValidationException::withMessages([
                    'fields' => 'Each field requires an id.',
                ]);
            }

            $validation = $field['validation'] ?? [];

            $normalized[$fieldId] = array_filter([
                'id' => $fieldId,
                'type' => $field['type'] ?? 'text',
                'label' => $field['label'] ?? $fieldId,
                'required' => (bool) ($field['required'] ?? false),
                'placeholder' => $field['placeholder'] ?? null,
                'default' => $field['defaultValue'] ?? ($field['default'] ?? null),
                'options' => $field['options'] ?? [],
                'dataSource' => $field['dataSource'] ?? null,
                'min' => $validation['min'] ?? ($field['min'] ?? null),
                'max' => $validation['max'] ?? ($field['max'] ?? null),
                'pattern' => $validation['pattern'] ?? ($field['pattern'] ?? null),
                'errorMessage' => $validation['errorMessage'] ?? null,
            ], static fn ($value) => $value !== null);
        }

        return $normalized;
    }

    private function normalizeRules(array $rules): array
    {
        return array_map(function (array $rule, int $index): array {
            return [
                'id' => $rule['id'] ?? 'rule_' . $index,
                'dependsOn' => array_values($rule['dependsOn'] ?? $rule['depends_on'] ?? []),
                'condition' => $rule['condition'] ?? 'true',
                'actions' => array_values($rule['actions'] ?? []),
                'priority' => $rule['priority'] ?? 'override',
            ];
        }, $rules, array_keys($rules));
    }

    private function buildDagEvaluationOrder(array $fields, array $rules): array
    {
        $nodes = array_fill_keys(array_keys($fields), 0);
        $edges = [];

        foreach ($rules as $rule) {
            $dependsOn = $rule['dependsOn'] ?? [];
            $targets = [];

            foreach ($rule['actions'] ?? [] as $action) {
                $target = $action['field'] ?? null;
                if (is_string($target) && $target !== '') {
                    $targets[] = $target;
                    $nodes[$target] = $nodes[$target] ?? 0;
                }
            }

            foreach ($dependsOn as $dependency) {
                if (!is_string($dependency) || $dependency === '') {
                    continue;
                }

                $nodes[$dependency] = $nodes[$dependency] ?? 0;

                foreach ($targets as $target) {
                    if ($dependency === $target) {
                        continue;
                    }

                    $edges[$dependency] ??= [];
                    if (!in_array($target, $edges[$dependency], true)) {
                        $edges[$dependency][] = $target;
                        $nodes[$target]++;
                    }
                }
            }
        }

        $queue = [];
        foreach ($nodes as $node => $degree) {
            if ($degree === 0) {
                $queue[] = $node;
            }
        }

        $order = [];
        while ($queue !== []) {
            $node = array_shift($queue);
            $order[] = $node;

            foreach ($edges[$node] ?? [] as $neighbor) {
                $nodes[$neighbor]--;
                if ($nodes[$neighbor] === 0) {
                    $queue[] = $neighbor;
                }
            }
        }

        if (count($order) !== count($nodes)) {
            throw ValidationException::withMessages([
                'rules' => 'Cycle detected in rule dependencies.',
            ]);
        }

        return $order;
    }
}
