<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'password',
        'picture',
        'picture_path',
        'picture_mime',
        'cover',
        'cover_path',
        'cover_mime',
        'birth_date',
        'location',
        'bio',
        'role_id',
        'username',
        'is_profile_public',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'picture',
        'picture_path',
        'picture_mime',
        'cover',
        'cover_path',
        'cover_mime',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'birth_date' => 'date',
            'is_profile_public' => 'boolean',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function following()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
            ->withPivot('accepted_at')
            ->wherePivotNotNull('accepted_at');
    }

    public function followers()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id')
            ->withPivot('accepted_at')
            ->wherePivotNotNull('accepted_at');
    }

    public function sentFollowRequests()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'follower_id', 'following_id')
            ->withPivot('accepted_at')
            ->wherePivotNull('accepted_at');
    }

    public function receivedFollowRequests()
    {
        return $this->belongsToMany(User::class, 'user_follows', 'following_id', 'follower_id')
            ->withPivot('accepted_at')
            ->wherePivotNull('accepted_at');
    }

    public function blockedUsers()
    {
        return $this->belongsToMany(User::class, 'user_blocks', 'blocker_id', 'blocked_id')
            ->withTimestamps();
    }

    public function blockers()
    {
        return $this->belongsToMany(User::class, 'user_blocks', 'blocked_id', 'blocker_id')
            ->withTimestamps();
    }

    public function role()
    {
        return $this->belongsTo(Role::class);
    }

    public function posts()
    {
        return $this->hasMany(Post::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function likes()
    {
        return $this->hasMany(Like::class);
    }

    public function commentLikes()
    {
        return $this->hasMany(CommentLike::class);
    }

    public function reposts()
    {
        return $this->hasMany(Repost::class);
    }

    public function mentionsReceived()
    {
        return $this->hasMany(Mention::class, 'mentioned_user_id');
    }

    public function mentionsMade()
    {
        return $this->hasMany(Mention::class, 'mentioner_id');
    }

    public function pushTokens()
    {
        return $this->hasMany(PushToken::class);
    }

    public function conversations()
    {
        return $this->belongsToMany(Conversation::class, 'conversation_user')
            ->withPivot('last_read_at')
            ->withTimestamps();
    }

    public function directMessages()
    {
        return $this->hasMany(DirectMessage::class);
    }

    public function hasProfilePicture(): bool
    {
        return filled($this->picture_path) || ! is_null($this->picture);
    }

    public function hasCoverImage(): bool
    {
        return filled($this->cover_path) || ! is_null($this->cover);
    }
}
