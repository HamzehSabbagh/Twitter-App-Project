<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_follows', function (Blueprint $table) {
            $table->timestamp('accepted_at')->nullable()->after('created_at');
        });

        DB::table('user_follows')
            ->whereNull('accepted_at')
            ->update([
                'accepted_at' => DB::raw('COALESCE(created_at, NOW())'),
            ]);
    }

    public function down(): void
    {
        Schema::table('user_follows', function (Blueprint $table) {
            $table->dropColumn('accepted_at');
        });
    }
};
