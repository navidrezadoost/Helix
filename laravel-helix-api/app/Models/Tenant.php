<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tenant extends Model
{
    protected $table = 'tenants';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $casts = [
        'config' => 'array',
    ];
}