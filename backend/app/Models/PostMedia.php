<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostMedia extends Model
{
    protected $fillable = [
        'type',
        'path',
        'mime_type',
        'duration_seconds',
        'size_bytes',
        'post_id',
    ];

    public function post(){
        return $this->belongsTo(Post::class);
    }

}
