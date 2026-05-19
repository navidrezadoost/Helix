<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Schema;
use App\Services\Helix\SchemaSigner;
use App\Services\Helix\SchemaValidator;
use GuzzleHttp\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SchemaController extends Controller
{
    public function __construct(
        private readonly SchemaValidator $validator,
        private readonly SchemaSigner $signer,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Schema::query()
            ->when($request->tenant_id, fn ($builder) => $builder->where('tenant_id', $request->tenant_id))
            ->when($request->status, fn ($builder) => $builder->where('status', $request->status))
            ->when($request->search, function ($builder) use ($request) {
                $search = '%' . $request->search . '%';

                $builder->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', $search)
                        ->orWhere('schema_id', 'like', $search);
                });
            })
            ->orderByDesc('updated_at');

        return response()->json($query->paginate(20));
    }

    public function show(string $schemaId, Request $request): JsonResponse
    {
        $query = Schema::query()->where('schema_id', $schemaId);

        if (!$request->is('api/admin/*')) {
            $query->published();
        }

        if ($request->filled('version')) {
            $query->where('version', (int) $request->get('version'));
        } else {
            $query->orderByDesc('version');
        }

        $schema = $query->first();

        if (!$schema) {
            return response()->json(['error' => 'Schema not found'], 404);
        }

        return response()->json($schema);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'schema_id' => 'required|string|max:255|unique:schemas,schema_id',
            'tenant_id' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'fields' => 'required|array|min:1',
            'rules' => 'nullable|array',
            'metadata' => 'nullable|array',
            'data_sources' => 'nullable|array',
            'global_rules' => 'nullable|array',
        ]);

        $rawSchema = [
            'schema_id' => $validated['schema_id'],
            'version' => 1,
            'fields' => $validated['fields'],
            'rules' => $validated['rules'] ?? [],
            'constants' => [
                'tenant_id' => $validated['tenant_id'],
            ],
        ];

        $compiled = $this->validator->validate($rawSchema);

        $schema = Schema::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $validated['tenant_id'],
            'schema_id' => $validated['schema_id'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'version' => 1,
            'dag_hash' => $compiled->dagHash,
            'dag_evaluation_order' => $compiled->dagEvaluationOrder,
            'compiled_graph' => [
                'fields' => $compiled->fields,
                'rules' => $compiled->rules,
                'constants' => $compiled->constants,
                'dag_evaluation_order' => $compiled->dagEvaluationOrder,
            ],
            'metadata' => $validated['metadata'] ?? [],
            'data_sources' => $validated['data_sources'] ?? [],
            'global_rules' => $validated['global_rules'] ?? [],
            'status' => 'draft',
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return response()->json($schema, 201);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        $schema = Schema::query()->where('id', $id)->where('status', 'draft')->first();

        if (!$schema) {
            return response()->json(['error' => 'Schema not found or not in draft status'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'fields' => 'sometimes|array|min:1',
            'rules' => 'nullable|array',
            'metadata' => 'nullable|array',
            'data_sources' => 'nullable|array',
            'global_rules' => 'nullable|array',
        ]);

        $compiledGraph = $schema->compiled_graph ?? [];
        $rawSchema = [
            'schema_id' => $schema->schema_id,
            'version' => $schema->version,
            'fields' => $validated['fields'] ?? array_values($compiledGraph['fields'] ?? []),
            'rules' => $validated['rules'] ?? ($compiledGraph['rules'] ?? []),
            'constants' => $compiledGraph['constants'] ?? ['tenant_id' => $schema->tenant_id],
        ];

        $compiled = $this->validator->validate($rawSchema);

        $schema->update([
            'name' => $validated['name'] ?? $schema->name,
            'description' => array_key_exists('description', $validated) ? $validated['description'] : $schema->description,
            'dag_hash' => $compiled->dagHash,
            'dag_evaluation_order' => $compiled->dagEvaluationOrder,
            'compiled_graph' => [
                'fields' => $compiled->fields,
                'rules' => $compiled->rules,
                'constants' => $compiled->constants,
                'dag_evaluation_order' => $compiled->dagEvaluationOrder,
            ],
            'metadata' => $validated['metadata'] ?? $schema->metadata,
            'data_sources' => $validated['data_sources'] ?? $schema->data_sources,
            'global_rules' => $validated['global_rules'] ?? $schema->global_rules,
            'updated_by' => auth()->id(),
        ]);

        $schema->refresh();

        return response()->json($schema);
    }

    public function publish(string $id): JsonResponse
    {
        $schema = Schema::query()->where('id', $id)->where('status', 'draft')->first();

        if (!$schema) {
            return response()->json(['error' => 'Schema not found or not in draft status'], 404);
        }

        $publishedSchema = DB::transaction(function () use ($schema) {
            $signature = $this->signer->sign($schema->dag_hash);

            Schema::query()
                ->where('schema_id', $schema->schema_id)
                ->where('status', 'published')
                ->update(['status' => 'archived']);

            return Schema::create([
                'id' => (string) Str::uuid(),
                'tenant_id' => $schema->tenant_id,
                'schema_id' => $schema->schema_id,
                'name' => $schema->name,
                'description' => $schema->description,
                'version' => $schema->version,
                'dag_hash' => $schema->dag_hash,
                'dag_evaluation_order' => $schema->dag_evaluation_order,
                'compiled_graph' => $schema->compiled_graph,
                'metadata' => $schema->metadata,
                'data_sources' => $schema->data_sources,
                'global_rules' => $schema->global_rules,
                'status' => 'published',
                'signature' => $signature,
                'published_at' => now(),
                'created_by' => auth()->id(),
                'updated_by' => auth()->id(),
            ]);
        });

        return response()->json($publishedSchema);
    }

    public function createVersion(string $schemaId): JsonResponse
    {
        $published = Schema::query()
            ->where('schema_id', $schemaId)
            ->where('status', 'published')
            ->orderByDesc('version')
            ->first();

        if (!$published) {
            return response()->json(['error' => 'Published schema not found'], 404);
        }

        $draft = Schema::create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $published->tenant_id,
            'schema_id' => $published->schema_id,
            'name' => $published->name,
            'description' => $published->description,
            'version' => $published->version + 1,
            'dag_hash' => $published->dag_hash,
            'dag_evaluation_order' => $published->dag_evaluation_order,
            'compiled_graph' => $published->compiled_graph,
            'metadata' => $published->metadata,
            'data_sources' => $published->data_sources,
            'global_rules' => $published->global_rules,
            'status' => 'draft',
            'created_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return response()->json($draft);
    }

    public function destroy(string $id): JsonResponse
    {
        $schema = Schema::query()->where('id', $id)->where('status', 'draft')->first();

        if (!$schema) {
            return response()->json(['error' => 'Draft schema not found'], 404);
        }

        $schema->delete();

        return response()->json(['message' => 'Schema deleted']);
    }

    public function testDataSource(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => 'required|url',
            'method' => 'nullable|in:GET,POST',
            'headers' => 'nullable|array',
            'body' => 'nullable|array',
        ]);

        try {
            $client = new Client(['timeout' => 10]);
            $response = $client->request(
                $validated['method'] ?? 'GET',
                $validated['url'],
                [
                    'headers' => $validated['headers'] ?? [],
                    'json' => $validated['body'] ?? null,
                ],
            );

            return response()->json([
                'success' => true,
                'status' => $response->getStatusCode(),
                'data' => json_decode((string) $response->getBody(), true),
            ]);
        } catch (\Throwable $exception) {
            return response()->json([
                'success' => false,
                'error' => $exception->getMessage(),
            ], 400);
        }
    }
}
