<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Submission extends Model
{
    protected $table = 'submissions';
    protected $primaryKey = 'id';
    public $incrementing = false;
    protected $keyType = 'string';
    
    protected $fillable = [
        'id', 'tenant_id', 'schema_id', 'schema_version', 
        'submission_id', 'data', 'meta', 'integrity_hash', 
        'submission_status', 'created_at'
    ];
    
    protected $casts = [
        'data' => 'array',
        'meta' => 'array',
        'created_at' => 'datetime',
    ];
    
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
    
    public function schema(): BelongsTo
    {
        return $this->belongsTo(Schema::class, 'schema_id', 'schema_id');
    }
}