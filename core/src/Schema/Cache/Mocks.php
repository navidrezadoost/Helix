<?php

namespace Helix\Schema\Cache;

class CompiledGraphValidator {
    public function __construct(private string $schemaPath) {}
    
    public function validate(array $payload): void {
        $data = $payload['payload'] ?? $payload;

        // Algorithmic DOS Protection limits
        $maxNodes = 10000;
        $maxDepth = 64;

        if (isset($data['nodes']) && count($data['nodes']) > $maxNodes) {
            throw new \Exception("Schema exceeds maximum allowed nodes ({$maxNodes}).");
        }

        // Just a basic depth check placeholder
        // A complete check would run graph depth analysis, assuming compiler provides the 'depth' attribute
        foreach (($data['nodes'] ?? []) as $node) {
            if (isset($node['depth']) && $node['depth'] > $maxDepth) {
                throw new \Exception("Schema graph depth exceeds maximum allowed ({$maxDepth}).");
            }
        }

        // Justinrainbow / opis payload validation logic goes here
    }
}

class CompiledGraphGenerator {
    public function generate(CompiledGraph $graph, string $cacheDir): string {
         $filePath = "{$cacheDir}/{$graph->schemaId}.v{$graph->version}.compiled.php";
         $tmpPath = $filePath . '.' . uniqid('tmp_', true);
         
         $content = "<?php\n// Auto-generated. DO NOT EDIT.\nreturn " . var_export($graph->toArray(), true) . ";\n";
         
         // 1. Write to temp file first
         file_put_contents($tmpPath, $content);
         
         // 2. Fsync guarantees flush to disk
         $fp = fopen($tmpPath, 'r');
         if ($fp) {
             fflush($fp);
             fsync($fp);
             fclose($fp);
         }
         
         // 3. Atomic rename overrides the previous file safely
         rename($tmpPath, $filePath);
         
         // 4. Invalidate OPcache
         if (function_exists('opcache_invalidate')) {
             opcache_invalidate($filePath, true);
         }
         
         return $filePath;
    }
}

class CompiledGraph {
    public string $schemaId;
    public int $version;
    public string $schemaHash;
    public array $evaluationOrder;
    public array $nodes;

    public static function fromArray(array $data): self {
        $inst = new self();
        $inst->schemaId = $data['schemaId'] ?? 'temp';
        $inst->version = clone $data['version'] ?? 1;
        $inst->schemaHash = $data['schemaHash'] ?? '';
        $inst->evaluationOrder = $data['evaluationOrder'] ?? [];
        return $inst;
    }

    public function toArray(): array {
        return [
           'schemaId' => $this->schemaId,
           'version' => $this->version,
           'schemaHash' => $this->schemaHash,
        ];
    }
}