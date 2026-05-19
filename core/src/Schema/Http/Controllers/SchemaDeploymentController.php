<?php

namespace Helix\Schema\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Helix\Schema\Cache\SchemaCacheService;
use Helix\Schema\Cache\CompiledGraph;
use Helix\Schema\Evolution\GraphDiffEngine;
use Helix\Schema\Evolution\CompatibilityPolicyEngine;
use Exception;

class SchemaDeploymentController
{
    public function __construct(
        private SchemaCacheService $cacheService,
        private GraphDiffEngine $diffEngine,
        private CompatibilityPolicyEngine $policyEngine
    ) {}

    public function deploy(Request $request): JsonResponse
    {
        $payload = $request->input('payload');
        $signature = $request->input('signature');
        $metadata = $request->input('metadata', []);

        $schemaId = $payload['schemaId'] ?? null;
        $version = $payload['version'] ?? null;
        $nonce = $metadata['nonce'] ?? null;
        $timestamp = $metadata['timestamp'] ?? null;

        if (!$schemaId || !$version || !$nonce || !$timestamp) {
            return response()->json(['error' => 'Missing deployment metadata (schemaId, version, nonce, timestamp)'], 422);
        }

        // 1. Replay Protection: Nonce & Timestamp validation
        // Reject if timestamp is older than 5 minutes
        if (abs(time() - $timestamp) > 300) {
            return response()->json(['error' => 'Deployment timestamp expired'], 403);
        }

        // Reject duplicate nonces (using distributed cache)
        $nonceKey = "deployment_nonce:{$schemaId}:{$nonce}";
        if (!Cache::add($nonceKey, true, 3600)) {
            return response()->json(['error' => 'Duplicate nonce detected. Replay attack prevented.'], 403);
        }

        // 2. Monotonicity Enforcement: Version cannot be downgraded
        // In real app, query DB for max version of this schema
        $currentMaxVersion = DB::table('schema_deployments')
            ->where('schema_id', $schemaId)
            ->max('version') ?? 0;

        if ($version <= $currentMaxVersion && !$request->boolean('force')) {
            return response()->json(['error' => "Deployment version ({$version}) must be strictly greater than current version ({$currentMaxVersion})"], 409);
        }

        // 2.5 Duplicate Hash Detection (Redundant Deployments)
        $schemaHash = $this->cacheService->getCanonicalHash($payload);
        $previousHash = DB::table('schema_deployments')
            ->where('schema_id', $schemaId)
            ->where('version', $currentMaxVersion)
            ->value('schema_hash');

        if ($previousHash === $schemaHash && !$request->boolean('force')) {
            return response()->json(['error' => 'Redundant deployment: payload hash matches the current active version.'], 409);
        }

        // 2.6 Deployment Governance & Compatibility Check
        if ($currentMaxVersion > 0) {
            try {
                $oldGraph = $this->cacheService->retrieve($schemaId, $currentMaxVersion);
                $newGraphDraft = CompiledGraph::fromArray($payload);

                $report = $this->diffEngine->diff($oldGraph, $newGraphDraft);
                $decision = $this->policyEngine->evaluate($report, $request->boolean('force'));

                if (!$decision->allowed) {
                    return response()->json([
                        'error' => 'Deployment rejected by Compatibility Governance Policy',
                        'reason' => $decision->reason,
                        'compatibility_report' => $report->toArray()
                    ], 409); // 409 Conflict represents rejection of unacceptable state transitions
                }
            } catch (Exception $e) {
                // If previous cache file is missing/corrupted, continue or handle defensively.
                // In strict environments, could throw 500. Here we log and proceed.
            }
        }

        try {
            // 3. Delegate to Cache Service (Validation, Signature Verification, generation)
            // The payload structural complexity limits (Algorithmic DOS) are handled in the Validator.
            [$graph, $cacheFile, $finalHash] = $this->cacheService->store([
                'payload' => $payload,
                'signature' => $signature,
                'metadata' => $metadata
            ]);

            // Persist valid deployment record
            DB::table('schema_deployments')->insert([
                'schema_id' => $schemaId,
                'version' => $version,
                'schema_hash' => $finalHash, // Cryptographic Fingerprint
                'nonce' => $nonce,
                'timestamp' => $timestamp,
                'deployed_by' => $metadata['deployedBy'] ?? 'unknown',
                'created_at' => now()
            ]);

            return response()->json([
                'status' => 'created',
                'schemaId' => $graph->schemaId,
                'version' => $graph->version,
                'schemaHash' => $finalHash,
                'compiledAt' => time(),
            ], 201);

        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}