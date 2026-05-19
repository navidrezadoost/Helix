<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Schema extends Model
{
    protected $table = 'schemas';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'tenant_id',
        'schema_id',
        'name',
        'description',
        'version',
        'dag_hash',
        'dag_evaluation_order',
        'compiled_graph',
        'metadata',
        'data_sources',
        'global_rules',
        'status',
        'signature',
        'created_by',
        'updated_by',
        'published_at',
    ];

    protected $casts = [
        'dag_evaluation_order' => 'array',
        'compiled_graph' => 'array',
        'metadata' => 'array',
        'data_sources' => 'array',
        'global_rules' => 'array',
        'published_at' => 'datetime',
    ];

    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }

    public function scopeLatestVersion(Builder $query, string $schemaId): Builder
    {
        return $query->where('schema_id', $schemaId)
            ->orderByDesc('version');
    }
}
