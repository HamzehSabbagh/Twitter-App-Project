<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InAppActivityNotifier
{
    private static function absoluteUrl(string $path): string
    {
        $request = request();
        $baseUrl = $request ? $request->getSchemeAndHttpHost() : config('app.url');

        return rtrim((string) $baseUrl, '/').'/'.ltrim($path, '/');
    }

    public static function send(User $recipient, string $type, User $actor, array $payload = []): void
    {
        if ($recipient->id === $actor->id) {
            return;
        }

        if (UserBlocks::areUsersBlocked($recipient->id, $actor->id)) {
            return;
        }

        $notificationData = [
            'type' => $type,
            'actor' => [
                'id' => $actor->id,
                'first_name' => $actor->first_name,
                'last_name' => $actor->last_name,
                'username' => $actor->username,
                'picture_url' => $actor->hasProfilePicture()
                    ? self::absoluteUrl(route('profile.image', ['user' => $actor->username, 'type' => 'picture'], false))
                    : null,
            ],
            ...$payload,
        ];

        DB::table('notifications')->insert([
            'id' => (string) Str::uuid(),
            'type' => $type,
            'notifiable_type' => User::class,
            'notifiable_id' => $recipient->id,
            'data' => json_encode($notificationData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        ExpoPushSender::sendToUser($recipient, $notificationData);
    }
}
