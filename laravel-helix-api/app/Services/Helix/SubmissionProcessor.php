<?php

namespace App\Services\Helix;

use App\Models\Submission;
use App\Models\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SubmissionProcessor
{
    public function store(Schema $schema, string $submissionId, array $data, array $meta, string $integrityHash): Submission
    {
        return DB::transaction(function () use ($schema, $submissionId, $data, $meta, $integrityHash) {
            $submission = Submission::create([
                'id' => Str::uuid(),
                'tenant_id' => $schema->tenant_id,
                'schema_id' => $schema->schema_id,
                'schema_version' => $schema->version,
                'submission_id' => $submissionId,
                'data' => $data,
                'meta' => $meta,
                'integrity_hash' => $integrityHash,
                'submission_status' => 'pending',
                'created_at' => now(),
            ]);
            
            Log::info('Helix submission stored', [
                'submission_id' => $submissionId,
                'schema_id' => $schema->schema_id,
                'tenant_id' => $schema->tenant_id,
            ]);
            
            return $submission;
        });
    }
    
    public function dispatchWebhooks(Submission $submission): void
    {
        dispatch(new \App\Jobs\ProcessSubmissionWebhooks($submission));
    }
}