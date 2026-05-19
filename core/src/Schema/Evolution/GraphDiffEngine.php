<?php

namespace Helix\Schema\Evolution;

use Helix\Schema\Cache\CompiledGraph;

class RiskLevel {
    public const SAFE = 'safe';
    public const MODERATE = 'moderate';
    public const HIGH = 'high';
    public const CRITICAL = 'critical';

    public static function severity(string $level): int {
        return match($level) {
            self::SAFE => 1,
            self::MODERATE => 2,
            self::HIGH => 3,
            self::CRITICAL => 4,
            default => 0
        };
    }
}

class ChangeOperation {
    public function __construct(
        public string $type,
        public string $nodeId,
        public string $riskLevel,
        public array $details = []
    ) {}

    public function toArray(): array {
        return [
            'type' => $this->type,
            'nodeId' => $this->nodeId,
            'riskLevel' => $this->riskLevel,
            'details' => $this->details
        ];
    }
}

class CompatibilityReport {
    /** @var ChangeOperation[] */
    public array $changes = [];

    public function addChange(ChangeOperation $change): void {
        $this->changes[] = $change;
    }

    public function getHighestRiskLevel(): string {
        $maxRisk = RiskLevel::SAFE;
        foreach ($this->changes as $change) {
            if (RiskLevel::severity($change->riskLevel) > RiskLevel::severity($maxRisk)) {
                $maxRisk = $change->riskLevel;
            }
        }
        return $maxRisk;
    }

    public function isBackwardCompatible(): bool {
        return RiskLevel::severity($this->getHighestRiskLevel()) <= RiskLevel::severity(RiskLevel::MODERATE);
    }

    public function toArray(): array {
        return [
            'isBackwardCompatible' => $this->isBackwardCompatible(),
            'highestRisk' => $this->getHighestRiskLevel(),
            'changes' => array_map(fn($c) => $c->toArray(), $this->changes)
        ];
    }
}

class GraphDiffEngine {
    
    public function diff(CompiledGraph $oldGraph, CompiledGraph $newGraph): CompatibilityReport {
        $report = new CompatibilityReport();

        $oldNodes = $oldGraph->nodes ?? [];
        $newNodes = $newGraph->nodes ?? [];

        // 1. Detect Removals (Destructive / High Risk)
        foreach (array_keys($oldNodes) as $nodeId) {
            if (!isset($newNodes[$nodeId])) {
                $report->addChange(new ChangeOperation(
                    'remove_node', 
                    $nodeId, 
                    RiskLevel::HIGH, 
                    ['message' => "Node '{$nodeId}' was removed. May orphan persisted state."]
                ));
            }
        }

        // 2. Detect Additions (Additive / Safe Risk)
        foreach (array_keys($newNodes) as $nodeId) {
            if (!isset($oldNodes[$nodeId])) {
                $report->addChange(new ChangeOperation(
                    'add_node', 
                    $nodeId, 
                    RiskLevel::SAFE, 
                    ['message' => "Node '{$nodeId}' was added."]
                ));
            }
        }

        // 3. Detect Modifications (Transformative / Moderate to Critical Risk)
        foreach ($newNodes as $nodeId => $newNode) {
            if (isset($oldNodes[$nodeId])) {
                $oldNode = $oldNodes[$nodeId];

                $this->diffDependencies($nodeId, $oldNode, $newNode, $report);
                $this->diffAST($nodeId, $oldNode, $newNode, $report);
            }
        }

        return $report;
    }

    private function diffDependencies(string $nodeId, array $oldNode, array $newNode, CompatibilityReport $report): void {
        $oldDeps = $oldNode['dependencies'] ?? [];
        $newDeps = $newNode['dependencies'] ?? [];

        $addedDeps = array_diff($newDeps, $oldDeps);
        $removedDeps = array_diff($oldDeps, $newDeps);

        if (!empty($addedDeps)) {
            $report->addChange(new ChangeOperation(
                'add_dependency',
                $nodeId,
                RiskLevel::MODERATE,
                ['added' => array_values($addedDeps)]
            ));
        }

        if (!empty($removedDeps)) {
            $report->addChange(new ChangeOperation(
                'remove_dependency',
                $nodeId,
                RiskLevel::MODERATE, // Depending on context, removing a dependency alters reactive semantics
                ['removed' => array_values($removedDeps)]
            ));
        }
    }

    private function diffAST(string $nodeId, array $oldNode, array $newNode, CompatibilityReport $report): void {
        // Mocking AST diffing. In reality, we compare uiStateExpressions, validations, etc.
        $oldExpr = $oldNode['uiStateExpressions'] ?? [];
        $newExpr = $newNode['uiStateExpressions'] ?? [];

        // Normalize and strict compare expressions
        if (json_encode($oldExpr) !== json_encode($newExpr)) {
            $report->addChange(new ChangeOperation(
                'modify_ast',
                $nodeId,
                RiskLevel::MODERATE,
                [
                    'message' => 'AST/Expressions modified for node',
                    'old' => $oldExpr,
                    'new' => $newExpr
                ]
            ));
        }
    }
}
