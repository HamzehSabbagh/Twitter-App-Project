<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserBlocks
{
    public static function allRelatedUserIds(?int $userId): array
    {
        if (! $userId) {
            return [];
        }

        return DB::table('user_blocks')
            ->where('blocker_id', $userId)
            ->orWhere('blocked_id', $userId)
            ->get(['blocker_id', 'blocked_id'])
            ->flatMap(fn ($row) => [$row->blocker_id, $row->blocked_id])
            ->filter(fn ($id) => $id !== $userId)
            ->unique()
            ->values()
            ->all();
    }

    public static function blockedByViewer(?User $viewer, User $user): bool
    {
        if (! $viewer || $viewer->id === $user->id) {
            return false;
        }

        return DB::table('user_blocks')
            ->where('blocker_id', $viewer->id)
            ->where('blocked_id', $user->id)
            ->exists();
    }

    public static function blocksViewer(?User $viewer, User $user): bool
    {
        if (! $viewer || $viewer->id === $user->id) {
            return false;
        }

        return DB::table('user_blocks')
            ->where('blocker_id', $user->id)
            ->where('blocked_id', $viewer->id)
            ->exists();
    }

    public static function areUsersBlocked(?int $firstUserId, ?int $secondUserId): bool
    {
        if (! $firstUserId || ! $secondUserId || $firstUserId === $secondUserId) {
            return false;
        }

        return DB::table('user_blocks')
            ->where(function ($query) use ($firstUserId, $secondUserId) {
                $query
                    ->where('blocker_id', $firstUserId)
                    ->where('blocked_id', $secondUserId);
            })
            ->orWhere(function ($query) use ($firstUserId, $secondUserId) {
                $query
                    ->where('blocker_id', $secondUserId)
                    ->where('blocked_id', $firstUserId);
            })
            ->exists();
    }
}
