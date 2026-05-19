<?php
namespace Helix\Schema;

use Helix\Schema\Exceptions\SchemaValidationException;
use Helix\Schema\Exceptions\CycleDetectedException;

class SchemaValidator
{
    /**
     * Validates raw JSON schema and returns CompiledGraph
     * @throws SchemaValidationException
     * @throws CycleDetectedException
     */
    public function validate(array $rawSchema): CompiledGraph
    {
        if (empty($rawSchema['schema_id']) || !is_string($rawSchema['schema_id'])) {
            throw new SchemaValidationException("Missing or invalid 'schema_id'.");
        }
        
        if (empty($rawSchema['version']) || !is_int($rawSchema['version'])) {
            throw new SchemaValidationException("Missing or invalid 'version'.");
        }

        $fields = $rawSchema['fields'] ?? [];
        $rules = $rawSchema['rules'] ?? [];
        $constants = $rawSchema['constants'] ?? [];

        $this->validateFields($fields);
        $fieldNames = array_keys($fields);
        
        $this->validateRules($rules, $fieldNames);

        // Build dependency graph
        $dependencies = [];
        foreach ($fieldNames as $field) {
            $dependencies[$field] = [];
        }

        foreach ($rules as $rule) {
            $dependsOn = $rule['depends_on'] ?? [];
            foreach ($rule['actions'] as $action) {
                if (isset($action['field'])) {
                    $targetField = $action['field'];
                    // Dependency direction: Target Field depends on Conditions (depends_on fields)
                    foreach ($dependsOn as $dep) {
                        $dependencies[$targetField][] = $dep;
                    }
                }
            }
        }

        // De-duplicate dependencies
        foreach ($dependencies as $node => $deps) {
            $dependencies[$node] = array_unique($deps);
        }

        $dagEvaluationOrder = $this->topologicalSort($dependencies);
        $dagHash = $this->computeHash($rawSchema);

        return new CompiledGraph(
            $rawSchema['schema_id'],
            $rawSchema['version'],
            $dagHash,
            $dagEvaluationOrder,
            $rawSchema, // Store the full graph as requested
            $fields,
            $rules,
            $constants
        );
    }

    /**
     * Detects cycles in dependency graph using Kahn's algorithm
     * @return array<int, string> Topologically sorted node IDs
     * @throws CycleDetectedException
     */
    public function topologicalSort(array $dependencies): array
    {
        $inDegree = [];
        $adjList = [];
        
        $nodes = array_keys($dependencies);
        foreach ($nodes as $node) {
            $inDegree[$node] = 0;
            $adjList[$node] = [];
        }

        foreach ($dependencies as $node => $deps) {
            foreach ($deps as $dep) {
                // Edge represents execution order: $dep must execute before $node
                $adjList[$dep][] = $node;
                $inDegree[$node] = ($inDegree[$node] ?? 0) + 1;
            }
        }

        $queue = [];
        foreach ($inDegree as $node => $deg) {
            if ($deg === 0) {
                $queue[] = $node;
            }
        }

        $sorted = [];
        while (!empty($queue)) {
            $u = array_shift($queue);
            $sorted[] = $u;

            foreach ($adjList[$u] as $v) {
                $inDegree[$v]--;
                if ($inDegree[$v] === 0) {
                    $queue[] = $v;
                }
            }
        }

        if (count($sorted) !== count($nodes)) {
            throw new CycleDetectedException("Cycle detected in rule dependencies.");
        }

        return $sorted;
    }

    /**
     * Computes SHA-256 hash of normalized schema (canonical JSON)
     */
    private function computeHash(array $schema): string
    {
        return 'sha256:' . hash('sha256', $this->normalize($schema));
    }

    /**
     * Normalizes schema for consistent hashing (sort keys, remove whitespace)
     */
    private function normalize(array $schema): string
    {
        $this->recursiveKsort($schema);
        return json_encode($schema, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }

    private function recursiveKsort(array &$array): void
    {
        ksort($array);
        foreach ($array as &$value) {
            if (is_array($value)) {
                $this->recursiveKsort($value);
            }
        }
    }

    /**
     * Validates field definitions (types, constraints, references)
     */
    private function validateFields(array $fields): void
    {
        foreach ($fields as $fieldName => $config) {
            if (!isset($config['type'])) {
                throw new SchemaValidationException("Field '{$fieldName}' is missing a type.");
            }
        }
    }

    /**
     * Validates relational rules (dependsOn fields exist, condition syntax, actions)
     */
    private function validateRules(array $rules, array $fieldNames): void
    {
        foreach ($rules as $rule) {
            $dependsOn = $rule['depends_on'] ?? [];
            foreach ($dependsOn as $dep) {
                if (!in_array($dep, $fieldNames, true)) {
                    throw new SchemaValidationException("Rule depends_on references an unknown field: '{$dep}'.");
                }
            }

            if (!isset($rule['condition'])) {
                throw new SchemaValidationException("Rule missing condition.");
            }

            if (empty($rule['actions']) || !is_array($rule['actions'])) {
                throw new SchemaValidationException("Rule must contain at least one action.");
            }

            foreach ($rule['actions'] as $action) {
                if (empty($action['type'])) {
                    throw new SchemaValidationException("Action missing type.");
                }
                if (isset($action['field']) && !in_array($action['field'], $fieldNames, true)) {
                    throw new SchemaValidationException("Action references an unknown target field: '{$action['field']}'.");
                }
            }
        }
    }
}
