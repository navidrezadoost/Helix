<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('schemas', function (Blueprint $table) {
            if (!Schema::hasColumn('schemas', 'name')) {
                $table->string('name')->nullable()->after('schema_id');
            }

            if (!Schema::hasColumn('schemas', 'description')) {
                $table->text('description')->nullable()->after('name');
            }

            if (!Schema::hasColumn('schemas', 'metadata')) {
                $table->json('metadata')->nullable()->after('compiled_graph');
            }

            if (!Schema::hasColumn('schemas', 'data_sources')) {
                $table->json('data_sources')->nullable()->after('metadata');
            }

            if (!Schema::hasColumn('schemas', 'global_rules')) {
                $table->json('global_rules')->nullable()->after('data_sources');
            }

            if (!Schema::hasColumn('schemas', 'created_by')) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
            }

            if (!Schema::hasColumn('schemas', 'updated_by')) {
                $table->unsignedBigInteger('updated_by')->nullable()->after('created_by');
            }

            $table->index('name');
            $table->index('status');
            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::table('schemas', function (Blueprint $table) {
            $table->dropIndex(['name']);
            $table->dropIndex(['status']);
            $table->dropIndex(['created_by']);
            $table->dropColumn([
                'name',
                'description',
                'metadata',
                'data_sources',
                'global_rules',
                'created_by',
                'updated_by',
            ]);
        });
    }
};
