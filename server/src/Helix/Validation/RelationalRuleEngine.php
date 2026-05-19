<?php
namespace Helix\Validation;

use Helix\Expression\ExpressionEngine;
use Helix\Schema\CompiledGraph;

class RelationalRuleEngine
{
    private ExpressionEngine $expressionEngine;
    private array $fieldStates = [];
    private CompiledGraph $graph;
    
    public function __construct(CompiledGraph $graph, ExpressionEngine $engine)
    {
        $this->graph = $graph;
        $this->expressionEngine = $engine;
    }
    
    public function evaluate(array $inputData): array
    {
        // 1. Initialize field states
        foreach ($this->graph->fields as $fieldName => $config) {
            $this->fieldStates[$fieldName] = [
                'value' => $inputData[$fieldName] ?? null,
                'visible' => true,
                'required' => $config['required'] ?? false,
                'disabled' => false,
                'errors' => [],
            ];
        }

        // 2. Evaluate in topological order
        foreach ($this->graph->dagEvaluationOrder as $node) {
            $rulesTargetingNode = this->getRulesTargeting($node);

            foreach ($rulesTargetingNode as $rule) {
                // Build context for expression engine
                $context = [];
                foreach ($this->fieldStates as $k => $state) {
                    $context[$k] = $state['value'];
                }
                
                try {
                    $conditionMet = $this->expressionEngine->evaluate($rule['condition'], $context);
                    if ($conditionMet) {
                        foreach ($rule['actions'] as $action) {
                            if (isset($action['field']) && $action['field'] === $node) {
                                $this->applyAction($action, $node);
                            }
                        }
                    }
                } catch (\Exception $e) {
                    // Log or handle evaluation error implicitly failing condition
                }
            }
        }
        
        return $this->fieldStates;
    }

    private function getRulesTargeting(string $node): array
    {
        $targeting = [];
        foreach ($this->graph->rules as $rule) {
            foreach ($rule['actions'] as $action) {
                if (isset($action['field']) && $action['field'] === $node) {
                    $targeting[] = $rule;
                    break;
                }
            }
        }
        return $targeting;
    }
    
    private function applyAction(array $action, string $targetField): void
    {
        switch ($action['type']) {
            case 'show':
                $this->fieldStates[$targetField]['visible'] = true;
                break;
            case 'hide':
                $this->fieldStates[$targetField]['visible'] = false;
                break;
            case 'setRequired':
                $this->fieldStates[$targetField]['required'] = (bool)($action['required'] ?? true);
                break;
            case 'setValue':
                $this->fieldStates[$targetField]['value'] = $action['value'] ?? null;
                break;
            case 'setError':
                $this->fieldStates[$targetField]['errors'][] = $action['message'] ?? 'Validation failed';
                break;
        }
    }
}
