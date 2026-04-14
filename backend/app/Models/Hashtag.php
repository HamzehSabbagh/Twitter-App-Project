<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Hashtag extends Model
{
    protected $fillable = [
        'name',
    ];

    public function posts()
    {
        return $this->belongsToMany(Post::class, 'hashtag_post');
    }

    public function comments()
    {
        return $this->belongsToMany(Comment::class, 'hashtag_comment');
    }
}
