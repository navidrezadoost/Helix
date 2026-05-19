<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Schema;
use App\Models\Tenant;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class AdminSchemaController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->header('X-Tenant-ID') ?? Tenant::first()->id ?? null;
        
        if (!$tenantId) {
            return response()->json(['error' => 'Tenant ID required'], 400);
        }

        $schemas = Schema::where('tenant_id', $tenantId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($schemas);
    }

    public function show($schemaId, $version)
    {
        $schema = Schema::where('schema_id', $schemaId)
            ->where('version', $version)
            ->firstOrFail();

        return response()->json($schema);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'tenant_id' => 'required|uuid',
            'schema_id' => 'required|string|max:255',
            'dag_hash' => 'required|string|max:64',
            'dag_evaluation_order' => 'required|array',
            'compiled_graph' => 'required|array',
        ]);

        return DB::transaction(function () use ($validated) {
            // Auto-increment version logic based on existing drafts/published
            $latestVersion = Schema::where('schema_id', $validated['schema_id'])
                ->where('tenant_id', $validated['tenant_id'])
                ->max('version') ?? 0;
                
            $newVersion = $latestVersion + 1;

            $schema = Schema::create([
                'id' => Str::uuid(),
                'tenant_id' => $validated['tenant_id'],
                'schema_id' => $validated['schema_id'],
                'version' => $newVersion,
                'dag_hash' => $validated['dag_hash'],
                'dag_evaluation_order' => $validated['dag_evaluation_order'],
                'compiled_graph' => $validated['compiled_graph'],
                'status' => 'draft',
            ]);

            return response()->json($schema, 201);
        });
    }

    public function publish(Request $request, $schemaId, $version)
    {
        $schema = Schema::where('schema_id', $schemaId)
            ->where('version', $version)
            ->where('status', 'draft')
            ->firstOrFail();

        // Phase 6 signature generation:
        // We sign the dag_hash. In a real environment, we use actual Ed25519 signing from a secure KMS component.
        // As native PHP doesn't have a secure store internally, we sign with sodium leveraging a local env var for demonstration.
        $privateKeyBase64 = env('HELIX_PRIVATE_KEY');
        
        $signature = null;
        if ($privateKeyBase64) {
            $binaryKey = sodium_base642bin($privateKeyBase64, SODIUM_BASE64_VARIANT_ORIGINAL);
            $signatureBin = sodium_crypto_sign_detached($schema->dag_hash, $binaryKey);
            $signature = bin2hex($signatureBin);
        } else {
            // Mock signature fallback for local development if keys are unprovided. 
            // Warning emitted dynamically in logs to alert the team.
            \Log::warning("USING MOCK KEY FOR SCHEMA PUBLISHING. DO NOT USE IN PRODUCTION.");
            $signature = hash_hmac('sha256', $schema->dag_hash, 'mock_mock'); 
        }

        $schema->update([
            'status' => 'published',
            'published_at' => now(),
            'signature' => $signature
        ]);

        return response()->json([
            'success' => true,
            'schema' => $schema
        ]);
    }
}
