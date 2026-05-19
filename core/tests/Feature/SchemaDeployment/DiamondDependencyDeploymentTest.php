<?php

namespace Tests\Feature\SchemaDeployment;

use Tests\TestCase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Config;
use Helix\Schema\Cache\CompiledGraph;

class DiamondDependencyDeploymentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Ensure cache directory exists for the test
        $this->cacheDir = storage_path('app/helix/schemas');
        if (!File::exists($this->cacheDir)) {
            File::makeDirectory($this->cacheDir, 0755, true);
        }
        Config::set('helix.schema_cache_dir', $this->cacheDir);
    }

    public function test_diamond_dependency_schema_round_trip(): void
    {
        // 1. Generate REAL sodium signing keypair
        $keypair = sodium_crypto_sign_keypair();
        $secretKey = sodium_crypto_sign_secretkey($keypair);
        $publicKey = sodium_crypto_sign_publickey($keypair);

        Config::set('helix.ed25519_public_key', base64_encode($publicKey));

        // 2. Build CompiledGraph payload matching TS IR
        $compiledGraph = [
            'schemaId' => 'diamond-dependency-test',
            'version' => 1,
            'nodes' => [
                'field_a' => [
                    'id' => 'field_a',
                    'dependencies' => [],
                ],
                'field_b' => [
                    'id' => 'field_b',
                    'dependencies' => ['field_a'],
                ],
                'field_c' => [
                    'id' => 'field_c',
                    'dependencies' => ['field_a'],
                ],
                'field_d' => [
                    'id' => 'field_d',
                    'dependencies' => [
                        'field_b',
                        'field_c',
                    ],
                ],
            ],
            'evaluationOrder' => [
                'field_a',
                'field_b',
                'field_c',
                'field_d',
            ],
        ];

        // 3. Canonicalize JSON
        $canonicalJson = $this->canonicalize($compiledGraph);

        // 4. Sign Payload
        $signature = sodium_crypto_sign_detached($canonicalJson, $secretKey);
        $base64Signature = base64_encode($signature);

        // 5. POST /deploy (HTTP abstraction)
        $response = $this->postJson(
            '/api/v1/schemas/deploy',
            [
                'payload' => $compiledGraph,
                'signature' => $base64Signature,
                'metadata' => [
                    'deployedBy' => 'php-test',
                    'nonce' => uniqid('test_', true),
                    'timestamp' => time(),
                ],
            ],
            [
                'Authorization' => 'Bearer test-token',
            ]
        );

        // Assert HTTP Success
        $response->assertStatus(201); // Assuming 201 Created
        $response->assertJsonStructure(['schemaHash']);

        // Assert Identity
        $schemaHash = $response->json('schemaHash');
        $this->assertEquals(hash('sha256', $canonicalJson), $schemaHash);

        // 6. Verify OPcache file exists
        $compiledPath = $this->cacheDir . '/diamond-dependency-test.v1.compiled.php';
        $this->assertFileExists($compiledPath);

        // 7. Validate OPcache Artifact retrieval
        $cached = require $compiledPath;
        
        $this->assertIsArray($cached, 'OPcache file must return an array');

        // 8. Validate DAG evaluation order
        $this->assertEquals(
            [
                'field_a',
                'field_b',
                'field_c',
                'field_d',
            ],
            $cached['evaluationOrder']
        );

        // 9. Validate Structural Integrity of Dependencies
        $this->assertEquals(
            ['field_b', 'field_c'],
            $cached['nodes']['field_d']['dependencies'],
            'Graph dependencies must survive serialization and hydration'
        );

        // 10. VERY IMPORTANT: Re-verify signature on retrieved artifacts
        $reEncoded = json_encode(
            $this->canonicalizeRecursive($cached),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );

        $this->assertTrue(
            sodium_crypto_sign_verify_detached(
                $signature, // original binary signature
                $reEncoded,
                $publicKey  // original binary public key
            ),
            'Byte-level runtime stability failed: Retrieved array does not match signature'
        );

        // 11. DTO Hydration Validation
        $dto = CompiledGraph::fromArray($cached);
        $this->assertInstanceOf(CompiledGraph::class, $dto);
        $this->assertCount(4, $dto->nodes);
    }

    private function canonicalize(array $data): string
    {
        return json_encode(
            $this->canonicalizeRecursive($data),
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }

    private function canonicalizeRecursive($value)
    {
        if (!is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            return array_map(
                fn ($v) => $this->canonicalizeRecursive($v),
                $value
            );
        }

        ksort($value);

        foreach ($value as $k => $v) {
            $value[$k] = $this->canonicalizeRecursive($v);
        }

        return $value;
    }
}