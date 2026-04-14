<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mention extends Model
{
    protected $fillable = [
        'mentioned_user_id',
        'mentioner_id',
        'post_id',
        'comment_id',
    ];

    public function mentionedUser()
    {
        return $this->belongsTo(User::class, 'mentioned_user_id');
    }

    public function mentioner()
    {
        return $this->belongsTo(User::class, 'mentioner_id');
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function comment()
    {
        return $this->belongsTo(Comment::class);
    }
}
