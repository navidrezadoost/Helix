<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class VerifyInternalApiKey
{
    public function handle(Request $request, Closure $next)
    {
        $apiKey = $request->header('X-Internal-API-Key');
        $expectedKey = config('services.helix.internal_api_key');
        
        if (!$apiKey || !$expectedKey || !hash_equals($expectedKey, $apiKey)) {
            return response()->json([
                'error' => 'Unauthorized',
                'code' => 'INVALID_API_KEY'
            ], 401);
        }
        
        return $next($request);
    }
}