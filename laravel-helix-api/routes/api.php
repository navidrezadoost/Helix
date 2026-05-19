<?php

use App\Http\Controllers\Admin\SchemaController;
use App\Http\Controllers\Internal\SubmissionController;
use App\Http\Controllers\Internal\AdminSchemaController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/internal')
    ->middleware(['helix.internal'])
    ->group(function () {
        Route::post('/submissions', [SubmissionController::class, 'store']);
        
        // Admin Schema API
        Route::get('/schemas', [AdminSchemaController::class, 'index']);
        Route::post('/schemas', [AdminSchemaController::class, 'store']);
        Route::get('/schemas/{schemaId}/versions/{version}', [AdminSchemaController::class, 'show']);
        Route::post('/schemas/{schemaId}/versions/{version}/publish', [AdminSchemaController::class, 'publish']);
    });

Route::middleware(['auth:sanctum', 'admin'])
    ->prefix('admin')
    ->group(function () {
        Route::get('/schemas', [SchemaController::class, 'index']);
        Route::get('/schemas/{schemaId}', [SchemaController::class, 'show']);
        Route::post('/schemas', [SchemaController::class, 'store']);
        Route::put('/schemas/{id}', [SchemaController::class, 'update']);
        Route::delete('/schemas/{id}', [SchemaController::class, 'destroy']);
        Route::post('/schemas/{id}/publish', [SchemaController::class, 'publish']);
        Route::post('/schemas/{schemaId}/version', [SchemaController::class, 'createVersion']);
        Route::post('/test-data-source', [SchemaController::class, 'testDataSource']);
    });

Route::get('/v1/schemas/{schemaId}', [SchemaController::class, 'show']);
