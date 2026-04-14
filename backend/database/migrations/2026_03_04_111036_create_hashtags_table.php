<?php

use App\Models\Comment;
use App\Models\Hashtag;
use App\Models\Post;
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
        Schema::create('hashtags', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('hashtag_post', function (Blueprint $table){
            $table->id();
            $table->foreignIdFor(Post::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Hashtag::class)->constrained()->cascadeOnDelete();
            $table->unique(['post_id', 'hashtag_id']);
            $table->timestamps();
        });

        Schema::create('hashtag_comment', function (Blueprint $table){
            $table->id();
            $table->foreignIdFor(Hashtag::class)->constrained()->cascadeOnDelete();
            $table->foreignIdFor(Comment::class)->constrained()->cascadeOnDelete();
            $table->unique(['hashtag_id', 'comment_id']);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('hashtag_comment');
        Schema::dropIfExists('hashtag_post');
        Schema::dropIfExists('hashtags');
    }
};
