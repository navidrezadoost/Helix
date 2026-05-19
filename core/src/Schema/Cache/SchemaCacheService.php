<?php

namespace Helix\Schema\Cache;

// Placeholders reflecting the architectural spec for Helix OPcache caching.
// Note: We need to pull the full specs from the payload, but this captures the logic blueprint.

class SchemaCacheService {
    public function __construct(
        private CompiledGraphValidator $validator,
        private CompiledGraphGenerator $generator,
        private string $ed25519PublicKey,
        private string $cacheDir
    ) {}

    public function store(array $data): array {
        // Assume data contains 'payload', 'signature', and 'metadata'
        $payload = $data['payload'] ?? $data;
        $signature = $data['signature'] ?? '';

        // 1. JSON Schema Gatekeeper + DOS Protection
        $this->validator->validate($data);

        // Compute Canonical Hash for Immutable Identity
        $canonicalJson = $this->canonicalize($payload);
        $schemaHash = hash('sha256', $canonicalJson);

        // 2. Anti-tampering Check 
        $this->verifySignature($signature, $canonicalJson);

        // 3. Output DTO Hydration
        $graph = CompiledGraph::fromArray($payload);
        $graph->schemaHash = $schemaHash;

        // 4. Atomic Write -> Temp + Rename -> `.compiled.php` format
        $filePath = $this->generator->generate($graph, $this->cacheDir);

        return [$graph, $filePath, $schemaHash];
    }

    public function getCanonicalHash(array $payload): string {
        return hash('sha256', $this->canonicalize($payload));
    }

    public function retrieve(string $schemaId, int $version): CompiledGraph {
        $path = $this->getCachePath($schemaId, $version);
        
        // OPcache Read
        $data = require $path;

        // Anti-tamper on Read
        $this->verifySignature($data['signature'], json_encode($data));

        return CompiledGraph::fromArray($data);
    }
    
    private function verifySignature(string $sig, string $data): void {
        // ED25519 verify logic
    }
    
    private function canonicalize(array $data): string {
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    
    private function getCachePath(string $schemaId, int $version): string {
         return $this->cacheDir . "/{$schemaId}.v{$version}.compiled.php";
    }
}