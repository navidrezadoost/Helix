<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Submission;
use App\Models\Schema;
use App\Services\Helix\RuleEngine;
use App\Services\Helix\SubmissionProcessor;
use Illuminate\Http\Request;

class SubmissionController extends Controller
{
    public function __construct(
        private RuleEngine $ruleEngine,
        private SubmissionProcessor $processor
    ) {}
    
    public function store(Request $request)
    {
        $validated = $request->validate([
            'schema_id' => 'required|string',
            'schema_hash' => 'required|string',
            'schema_version' => 'required|integer',
            'submission_id' => 'required|string|unique:submissions,submission_id',
            'timestamp' => 'required|integer',
            'data' => 'required|array',
            'meta' => 'required|array',
            'validation' => 'required|array',
            'integrity' => 'required|array',
        ]);
        
        $schema = Schema::where('schema_id', $validated['schema_id'])
            ->where('version', $validated['schema_version'])
            ->where('status', 'published')
            ->first();
        
        if (!$schema) {
            return response()->json([
                'error' => 'Schema not found',
                'code' => 'SCHEMA_NOT_FOUND'
            ], 404);
        }
        
        if ($schema->dag_hash !== $validated['schema_hash']) {
            return response()->json([
                'error' => 'Schema hash mismatch',
                'code' => 'SCHEMA_HASH_MISMATCH'
            ], 400);
        }
        
        $validationResult = $this->ruleEngine->validate(
            $schema->compiled_graph,
            $validated['data']
        );
        
        if (!$validationResult['valid']) {
            return response()->json([
                'error' => 'Server-side validation failed',
                'code' => 'VALIDATION_FAILED',
                'errors' => $validationResult['errors']
            ], 422);
        }
        
        $submission = $this->processor->store(
            $schema,
            $validated['submission_id'],
            $validated['data'],
            $validated['meta'],
            $validated['integrity']['value']
        );
        
        $this->processor->dispatchWebhooks($submission);
        
        return response()->json([
            'success' => true,
            'submission_id' => $submission->submission_id,
            'processed_at' => now()->toIso8601String(),
        ], 201);
    }
}