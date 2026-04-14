<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    protected $fillable = [
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    public function participants()
    {
        return $this->belongsToMany(User::class, 'conversation_user')
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    public function messages()
    {
        return $this->hasMany(DirectMessage::class);
    }

    public function latestMessage()
    {
        return $this->hasOne(DirectMessage::class)->latestOfMany();
    }
}
