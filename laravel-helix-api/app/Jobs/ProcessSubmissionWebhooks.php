<?php

namespace App\Jobs;

use App\Models\Submission;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class ProcessSubmissionWebhooks implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, SerializesModels;
    
    public function __construct(private Submission $submission) {}
    
    public function handle(): void
    {
        $webhookUrl = config('services.helix.n8n_webhook_url');
        
        if ($webhookUrl) {
            Http::post($webhookUrl, [
                'event' => 'submission.created',
                'submission_id' => $this->submission->submission_id,
                'schema_id' => $this->submission->schema_id,
                'data' => $this->submission->data,
                'meta' => $this->submission->meta,
            ]);
        }
    }
}