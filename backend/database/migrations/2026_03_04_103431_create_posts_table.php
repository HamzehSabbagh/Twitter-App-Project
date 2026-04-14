<?php

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->constrained()->cascadeOnDelete();
            $table->text('content')->nullable();
            $table->foreignId('parent_id')->nullable()->constrained('posts')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('post_media', function (Blueprint $table){
            $table->id();
            $table->foreignIdFor(Post::class)->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->string('path');
            $table->string('mime_type');
            $table->unsignedInteger('duration_seconds')->nullable();
            $table->unsignedbigInteger('size_bytes');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('post_media');
        Schema::dropIfExists('posts');
    }
};
