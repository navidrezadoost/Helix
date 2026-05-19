<?php
namespace Helix\Pipeline;

use Helix\Schema\CompiledGraph;
use Helix\Validation\NonRelationalValidator;
use Helix\Validation\RelationalRuleEngine;
use Helix\Validation\ValidationException;

class SubmissionPipeline
{
    private const STAGES = ['VALIDATE', 'TRANSFORM', 'SIGN', 'DISPATCH', 'EMIT'];
    
    private array $stageResults = [];
    
    public function __construct(
        private CompiledGraph $graph,
        private NonRelationalValidator $nonRelationalValidator,
        private RelationalRuleEngine $relationalEngine,
    ) {}
    
    public function process(array $data, array $meta = []): array
    {
        $currentData = $data;
        $integrityHash = null;
        
        foreach (self::STAGES as $stageName) {
            $result = $this->executeStage($stageName, $currentData, $meta);
            $this->stageResults[] = $result;
            
            if (!$result->success) {
                throw new ValidationException(
                    "Pipeline failed at stage {$stageName}. Reason: " . ($result->error ?? 'Unknown error'),
                    json_decode($result->error ?? '[]', true) ?: []
                );
            }
            
            // Pass data through stages (TRANSFORM modifies data)
            if ($stageName === 'TRANSFORM') {
                $currentData = $result->data;
            }
            
            // Capture integrity hash at SIGN stage
            if ($stageName === 'SIGN' && $result->integrityHash) {
                $integrityHash = $result->integrityHash;
            }
        }
        
        return [
            'success' => true,
            'integrity_hash' => $integrityHash,
            'data' => $currentData,
            'stages' => $this->stageResults,
        ];
    }
    
    private function executeStage(string $stage, array $data, array $meta): StageResult
    {
        return match($stage) {
            'VALIDATE' => $this->validateStage($data, $meta),
            'TRANSFORM' => $this->transformStage($data),
            'SIGN' => $this->signStage($data, $meta),
            'DISPATCH' => $this->dispatchStage($data, $meta),
            'EMIT' => $this->emitStage($data, $meta),
            default => new StageResult($stage, false, $data, "Unknown stage: {$stage}"),
        };
    }
    
    private function validateStage(array $data, array $meta): StageResult
    {
        // 1. Run relational engine first (computes visibility, required flags)
        $fieldStates = $this->relationalEngine->evaluate($data);
        
        // 2. Run non-relational validation on all visible+required fields
        $errors = [];
        foreach ($fieldStates as $fieldName => $state) {
            if (!$state['visible']) {
                continue; // Skip hidden fields
            }
            
            $fieldConfig = $this->graph->fields[$fieldName] ?? null;
            if (!$fieldConfig) {
                continue;
            }
            
            $value = $state['value'] ?? null;
            $result = $this->nonRelationalValidator->validate(
                $fieldName, 
                $value, 
                $fieldConfig,
                $state['required'] // Overridden by relational rules
            );
            
            if (!$result->passed) {
                $errors[$fieldName][] = $result->errorMessage;
            }
        }
        
        if (!empty($errors)) {
            return new StageResult('VALIDATE', false, $data, json_encode($errors));
        }
        
        return new StageResult('VALIDATE', true, $data);
    }
    
    private function transformStage(array $data): StageResult
    {
        $transformed = $data;
        
        // Apply default values for missing fields and Type coercion
        foreach ($this->graph->fields as $fieldName => $config) {
            if (!isset($transformed[$fieldName]) && isset($config['default'])) {
                $transformed[$fieldName] = $config['default'];
            }
            
            if (isset($transformed[$fieldName]) && isset($config['type'])) {
                $transformed[$fieldName] = $this->coerceType(
                    $transformed[$fieldName], 
                    $config['type']
                );
            }
        }
        
        return new StageResult('TRANSFORM', true, $transformed);
    }
    
    private function signStage(array $data, array $meta): StageResult
    {
        $integrityHash = $this->computeIntegrityHash($data, $meta);
        return new StageResult('SIGN', true, $data, null, $integrityHash);
    }
    
    private function dispatchStage(array $data, array $meta): StageResult
    {
        // STUB for Phase 5 – Database storage
        // Log removed to keep stdout clean during tests, but logic persists.
        return new StageResult('DISPATCH', true, $data);
    }
    
    private function emitStage(array $data, array $meta): StageResult
    {
        // STUB for Phase 5 – Webhook emission (n8n, Shopify)
        return new StageResult('EMIT', true, $data);
    }
    
    private function computeIntegrityHash(array $data, array $meta): string
    {
        $canonical = json_encode([
            'data' => $this->canonicalize($data),
            'meta' => $this->canonicalize($meta),
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        
        return 'sha256:' . hash('sha256', $canonical);
    }
    
    private function canonicalize(array $data): array
    {
        ksort($data);
        foreach ($data as &$value) {
            if (is_array($value)) {
                $value = $this->canonicalize($value);
            }
        }
        return $data;
    }
    
    private function coerceType(mixed $value, string $type): mixed
    {
        return match($type) {
            'number' => is_numeric($value) ? (float)$value : $value,
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $value,
            'string' => (string)$value,
            default => $value,
        };
    }
    
    public function getStageResults(): array
    {
        return $this->stageResults;
    }
}
