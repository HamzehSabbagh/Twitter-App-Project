<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\DirectMessage;
use App\Models\User;
use App\Support\InAppActivityNotifier;
use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MessageController extends Controller
{
    private function absoluteUrl(string $path): string
    {
        if (Str::startsWith($path, ['http://', 'https://'])) {
            $parsed = parse_url($path);
            $path = ($parsed['path'] ?? '/')
                .(isset($parsed['query']) ? '?'.$parsed['query'] : '');
        }

        $request = request();
        $baseUrl = $request ? $request->getSchemeAndHttpHost() : config('app.url');

        return rtrim((string) $baseUrl, '/').'/'.ltrim($path, '/');
    }

    public function index(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $blockedUserIds = UserBlocks::allRelatedUserIds($viewer->id);

        $conversations = $viewer->conversations()
            ->with([
                'participants' => fn ($query) => $query
                    ->select(['users.id', 'first_name', 'last_name', 'username'])
                    ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                'latestMessage.user' => fn ($query) => $query
                    ->select(['users.id', 'first_name', 'last_name', 'username'])
                    ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
            ])
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->get()
            ->map(function (Conversation $conversation) use ($viewer) {
                $partner = $conversation->participants->firstWhere('id', '!=', $viewer->id);
                $latestMessage = $conversation->latestMessage;
                $lastReadAt = $conversation->pivot?->last_read_at;

                return [
                    'id' => $conversation->id,
                    'participant' => $partner ? [
                        'id' => $partner->id,
                        'first_name' => $partner->first_name,
                        'last_name' => $partner->last_name,
                        'username' => $partner->username,
                        'picture_url' => $partner->has_picture
                            ? $this->absoluteUrl(route('profile.image', ['user' => $partner->username, 'type' => 'picture'], false))
                            : null,
                    ] : null,
                    'latest_message' => $latestMessage ? [
                        'id' => $latestMessage->id,
                        'content' => $latestMessage->content,
                        'created_at' => $latestMessage->created_at?->toDateTimeString(),
                        'is_from_me' => $latestMessage->user_id === $viewer->id,
                    ] : null,
                    'unread_count' => $conversation->messages()
                        ->where('user_id', '!=', $viewer->id)
                        ->when(
                            $lastReadAt,
                            fn ($query) => $query->where('created_at', '>', $lastReadAt)
                        )
                        ->count(),
                ];
            })
            ->filter(fn (array $conversation) => ! is_null($conversation['participant']))
            ->when(
                $blockedUserIds !== [],
                fn ($collection) => $collection->reject(
                    fn (array $conversation) => in_array((int) ($conversation['participant']['id'] ?? 0), $blockedUserIds, true)
                )
            )
            ->values();

        return response()->json([
            'conversations' => $conversations,
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot message yourself.');
        abort_unless($this->canUsersDirectMessage($viewer, $user), 403, 'You can only message users who follow you or are followed by you.');

        $conversation = $this->findConversationBetween($viewer, $user);

        if ($conversation) {
            $viewer->conversations()->updateExistingPivot($conversation->id, [
                'last_read_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json([
            'participant' => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'username' => $user->username,
                'picture_url' => $user->hasProfilePicture()
                    ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'picture'], false))
                    : null,
            ],
            'can_message' => true,
            'messages' => $conversation
                ? $conversation->messages()
                    ->with([
                        'user' => fn ($query) => $query
                            ->select(['users.id', 'first_name', 'last_name', 'username'])
                            ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                    ])
                    ->oldest()
                    ->get()
                    ->map(fn (DirectMessage $message) => $this->transformMessage($message))
                    ->values()
                : [],
        ]);
    }

    public function store(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot message yourself.');
        abort_unless($this->canUsersDirectMessage($viewer, $user), 403, 'You can only message users who follow you or are followed by you.');

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:4000'],
        ]);

        $conversation = $this->findConversationBetween($viewer, $user) ?? $this->createConversation($viewer, $user);

        $message = $conversation->messages()->create([
            'user_id' => $viewer->id,
            'content' => $validated['content'],
        ]);

        $conversation->update([
            'last_message_at' => $message->created_at,
        ]);

        $viewer->conversations()->updateExistingPivot($conversation->id, [
            'last_read_at' => now(),
            'updated_at' => now(),
        ]);

        InAppActivityNotifier::send($user, 'direct_message', $viewer, [
            'message' => 'sent you a direct message',
            'profile' => [
                'id' => $viewer->id,
                'username' => $viewer->username,
            ],
        ]);

        $message->load([
            'user' => fn ($query) => $query
                ->select(['users.id', 'first_name', 'last_name', 'username'])
                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
        ]);

        return response()->json([
            'message' => $this->transformMessage($message),
        ], 201);
    }

    private function createConversation(User $viewer, User $user): Conversation
    {
        $conversation = Conversation::create([
            'last_message_at' => now(),
        ]);

        $conversation->participants()->attach([
            $viewer->id => [
                'last_read_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            $user->id => [
                'last_read_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        return $conversation;
    }

    private function findConversationBetween(User $viewer, User $user): ?Conversation
    {
        return $viewer->conversations()
            ->whereHas('participants', fn ($query) => $query->where('users.id', $user->id))
            ->first();
    }

    private function canUsersDirectMessage(User $viewer, User $user): bool
    {
        if (UserBlocks::areUsersBlocked($viewer->id, $user->id)) {
            return false;
        }

        return DB::table('user_follows')
            ->whereNotNull('accepted_at')
            ->where(function ($query) use ($viewer, $user) {
                $query
                    ->where(function ($innerQuery) use ($viewer, $user) {
                        $innerQuery
                            ->where('follower_id', $viewer->id)
                            ->where('following_id', $user->id);
                    })
                    ->orWhere(function ($innerQuery) use ($viewer, $user) {
                        $innerQuery
                            ->where('follower_id', $user->id)
                            ->where('following_id', $viewer->id);
                    });
            })
            ->exists();
    }

    private function transformMessage(DirectMessage $message): array
    {
        return [
            'id' => $message->id,
            'content' => $message->content,
            'created_at' => $message->created_at?->toDateTimeString(),
            'user' => [
                'id' => $message->user?->id,
                'first_name' => $message->user?->first_name,
                'last_name' => $message->user?->last_name,
                'username' => $message->user?->username,
                'picture_url' => $message->user?->has_picture
                    ? $this->absoluteUrl(route('profile.image', ['user' => $message->user->username, 'type' => 'picture'], false))
                    : null,
            ],
        ];
    }
}
