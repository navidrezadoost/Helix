<?php

namespace App\Services\Helix;

class RelationalRuleEngine
{
    /**
     * Evaluates the schema graph in DAG topological order to resolve visibility and required states.
     * Maps to the TypeScript reactive engine's state computation.
     */
    public function evaluate(array $compiledGraph, array $data): array
    {
        $fieldStates = [];
        $evaluationOrder = $compiledGraph['dag_evaluation_order'] ?? [];
        $edges = $compiledGraph['edges'] ?? [];
        
        // Initialize default states based on config
        foreach ($compiledGraph['fields'] ?? [] as $fieldName => $config) {
            $fieldStates[$fieldName] = [
                'visible' => true,
                'required' => $config['required'] ?? false,
                'value' => $data[$fieldName] ?? null,
            ];
        }

        // Evaluate in precise topological order
        foreach ($evaluationOrder as $nodeName) {
            $nodeConfig = $compiledGraph['fields'][$nodeName] ?? null;
            if (!$nodeConfig) continue;

            // Optional: evaluate conditions natively avoiding eval via ExpressionEngine
            // Here we assume standard condition rules parsed in $nodeConfig['conditions']
            if (isset($nodeConfig['conditions'])) {
                $visibility = $this->evaluateCondition($nodeConfig['conditions']['visible'] ?? null, $data, $fieldStates);
                $required = $this->evaluateCondition($nodeConfig['conditions']['required'] ?? null, $data, $fieldStates);
                
                if ($visibility !== null) {
                    $fieldStates[$nodeName]['visible'] = $visibility;
                }
                
                if ($required !== null) {
                    $fieldStates[$nodeName]['required'] = $required;
                }
            }
        }

        return $fieldStates;
    }

    private function evaluateCondition(?array $condition, array $data, array $currentStates): ?bool
    {
        if (!$condition) return null;
        
        // Simplified condition evaluator bridging AST syntax 
        // e.g. ['field' => 'has_discount', 'operator' => '===', 'value' => true]
        if (isset($condition['field']) && isset($condition['operator'])) {
            $targetVal = $data[$condition['field']] ?? null;
            
            return match($condition['operator']) {
                '===' => $targetVal === $condition['value'],
                '!==' => $targetVal !== $condition['value'],
                '>' => is_numeric($targetVal) && $targetVal > $condition['value'],
                '<' => is_numeric($targetVal) && $targetVal < $condition['value'],
                default => false,
            };
        }
        
        return null;
    }
}