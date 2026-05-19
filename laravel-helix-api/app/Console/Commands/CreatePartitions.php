<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CreatePartitions extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'helix:create-partitions {--months=6 : Number of future months to partition}';

    /**
     * The console command description.
     */
    protected $description = 'Create monthly partitions for submissions table';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $months = (int) $this->option('months');
        
        for ($i = 0; $i < $months; $i++) {
            $date = now()->addMonths($i);
            $partition = "submissions_y{$date->format('Y')}m{$date->format('m')}";
            $start = $date->copy()->startOfMonth()->toDateTimeString();
            $end = $date->copy()->endOfMonth()->addSecond()->toDateTimeString();
            
            $this->info("Creating partition: {$partition} FOR VALUES FROM ('{$start}') TO ('{$end}')");
            
            DB::statement("CREATE TABLE IF NOT EXISTS {$partition} PARTITION OF submissions 
                           FOR VALUES FROM ('{$start}') TO ('{$end}')");
        }
        
        $this->info("Successfully ensured partitions for the next {$months} months.");
    }
}
