<?php

namespace App\Http\Controllers;

use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $blockedUserIds = UserBlocks::allRelatedUserIds($user->id);

        $notifications = $user->notifications()
            ->latest()
            ->limit(50)
            ->get()
            ->reject(function ($notification) use ($blockedUserIds) {
                if ($blockedUserIds === []) {
                    return false;
                }

                $actorId = (int) ($notification->data['actor']['id'] ?? 0);

                return $actorId > 0 && in_array($actorId, $blockedUserIds, true);
            })
            ->map(fn ($notification) => [
                'id' => $notification->id,
                'type' => $notification->data['type'] ?? $notification->type,
                'message' => $notification->data['message'] ?? '',
                'actor' => $notification->data['actor'] ?? null,
                'post' => $notification->data['post'] ?? null,
                'comment' => $notification->data['comment'] ?? null,
                'profile' => $notification->data['profile'] ?? null,
                'read_at' => $notification->read_at?->toDateTimeString(),
                'created_at' => $notification->created_at?->toDateTimeString(),
            ])
            ->values();

        $unreadCount = $notifications
            ->filter(fn (array $notification) => empty($notification['read_at']))
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update([
            'read_at' => now(),
        ]);

        return response()->json([
            'message' => 'Notifications marked as read.',
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $updated = $request->user()
            ->notifications()
            ->where('id', $notification)
            ->update([
                'read_at' => now(),
            ]);

        abort_unless($updated > 0, 404, 'Notification not found.');

        return response()->json([
            'message' => 'Notification marked as read.',
        ]);
    }
}
