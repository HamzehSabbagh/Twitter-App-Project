<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    protected $fillable = [
        'content',
        'user_id',
        'parent_id',
    ];

    public function user(){
        return $this->belongsTo(User::class);
    }

    public function reposts(){
        return $this->hasMany(Repost::class);
    }

    public function likes(){
        return $this->hasMany(Like::class);
    }

    public function comments(){
        return $this->hasMany(Comment::class);
    }

    public function hashtags(){
        return $this->belongsToMany(Hashtag::class);
    }

    public function media(){
        return $this->hasMany(PostMedia::class);
    }

    public function mentions()
    {
        return $this->hasMany(Mention::class);
    }
}
