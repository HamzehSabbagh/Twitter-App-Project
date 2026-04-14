<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExpoPushSender
{
    public static function sendToUser(User $recipient, array $notificationData): void
    {
        $tokens = $recipient->pushTokens()
            ->pluck('token')
            ->filter()
            ->unique()
            ->values();

        if ($tokens->isEmpty()) {
            return;
        }

        $message = self::buildMessage($notificationData);

        $messages = $tokens
            ->map(fn (string $token) => [
                'to' => $token,
                'sound' => 'default',
                'title' => $message['title'],
                'body' => $message['body'],
                'data' => $message['data'],
                'channelId' => 'default',
                'priority' => 'high',
            ])
            ->chunk(100);

        foreach ($messages as $chunk) {
            try {
                $request = Http::timeout(10)->acceptJson();

                if (app()->environment('local')) {
                    $request = $request->withoutVerifying();
                }

                $request->post('https://exp.host/--/api/v2/push/send', $chunk->values()->all());
            } catch (\Throwable $exception) {
                Log::warning('Could not send Expo push notification.', [
                    'recipient_id' => $recipient->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }
    }

    private static function buildMessage(array $notificationData): array
    {
        $type = $notificationData['type'] ?? 'activity';
        $actor = $notificationData['actor'] ?? [];
        $actorName = trim(
            implode(' ', array_filter([
                $actor['first_name'] ?? null,
                $actor['last_name'] ?? null,
            ]))
        );
        $actorName = $actorName !== '' ? $actorName : ($actor['username'] ?? 'Someone');

        $title = match ($type) {
            'follow' => 'New follower',
            'post_like' => 'Post liked',
            'comment_like' => 'Comment liked',
            'comment' => 'New comment',
            'reply' => 'New reply',
            'repost' => 'Post reposted',
            'mention' => 'You were mentioned',
            default => 'New activity',
        };

        $body = $actorName.' '.($notificationData['message'] ?? 'interacted with you');

        $data = [
            'type' => $type,
            'username' => data_get($notificationData, 'profile.username')
                ?? data_get($notificationData, 'actor.username'),
        ];

        $postId = data_get($notificationData, 'post.id');
        if ($postId) {
            $data['post_id'] = $postId;
        }

        $commentId = data_get($notificationData, 'comment.id');
        if ($commentId) {
            $data['comment_id'] = $commentId;
        }

        return [
            'title' => $title,
            'body' => $body,
            'data' => $data,
        ];
    }
}
