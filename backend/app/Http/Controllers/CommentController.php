<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Hashtag;
use App\Models\Mention;
use App\Models\User;
use App\Support\InAppActivityNotifier;
use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'post_id' => ['required', 'exists:posts,id'],
            'content' => ['required', 'string'],
            'parent_id' => ['nullable', 'exists:comments,id'],
        ]);

        $user = $request->user();
        $postOwnerId = (int) \App\Models\Post::query()->whereKey($validated['post_id'])->value('user_id');

        abort_if(
            $postOwnerId > 0 && UserBlocks::areUsersBlocked($user->id, $postOwnerId),
            403,
            'You cannot comment on content from a blocked user.'
        );

        if (! empty($validated['parent_id'])) {
            $parentUserId = (int) Comment::query()->whereKey($validated['parent_id'])->value('user_id');

            abort_if(
                $parentUserId > 0 && UserBlocks::areUsersBlocked($user->id, $parentUserId),
                403,
                'You cannot reply to a blocked user.'
            );
        }

        $comment = Comment::create([
            'user_id' => $user->id,
            'post_id' => $validated['post_id'],
            'content' => $validated['content'],
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        $comment->hashtags()->sync($this->resolveHashtagIds($validated['content']));
        $this->syncCommentMentions($comment, $validated['content'], $user->id);
        $comment->loadMissing('post.user:id,username', 'parent.user:id,username');

        if ($comment->parent && $comment->parent->user) {
            InAppActivityNotifier::send($comment->parent->user, 'reply', $user, [
                'message' => 'replied to your comment',
                'post' => [
                    'id' => $comment->post_id,
                ],
                'comment' => [
                    'id' => $comment->id,
                ],
            ]);
        } elseif ($comment->post?->user) {
            InAppActivityNotifier::send($comment->post->user, 'comment', $user, [
                'message' => 'commented on your post',
                'post' => [
                    'id' => $comment->post_id,
                ],
                'comment' => [
                    'id' => $comment->id,
                ],
            ]);
        }

        $comment->load(['user:id,first_name,last_name,username', 'hashtags:id,name'])->loadCount('likes');

        return response()->json([
            'message' => 'Comment created.',
            'comment' => [
                'id' => $comment->id,
                'content' => $comment->content,
                'created_at' => $comment->created_at?->toDateTimeString(),
                'likes_count' => $comment->likes_count,
                'liked_by_user' => false,
                'user' => [
                    'first_name' => $comment->user?->first_name,
                    'last_name' => $comment->user?->last_name,
                    'username' => $comment->user?->username,
                ],
                'hashtags' => $comment->hashtags->map(fn ($hashtag) => [
                    'id' => $hashtag->id,
                    'name' => $hashtag->name,
                ])->values(),
                'replies' => [],
            ],
        ], 201);
    }

    private function resolveHashtagIds(?string $content): array
    {
        if (! $content) {
            return [];
        }

        preg_match_all('/#([A-Za-z0-9_]+)/', $content, $matches);

        return collect($matches[1] ?? [])
            ->map(fn ($tag) => strtolower($tag))
            ->unique()
            ->values()
            ->map(fn ($tag) => Hashtag::query()->firstOrCreate(['name' => $tag])->id)
            ->all();
    }

    private function syncCommentMentions(Comment $comment, ?string $content, int $mentionerId): void
    {
        $existingMentionedUserIds = $comment->mentions()->pluck('mentioned_user_id')->all();
        $comment->mentions()->delete();

        $mentionedUserIds = $this->resolveMentionedUserIds($content, $mentionerId);

        foreach ($mentionedUserIds as $mentionedUserId) {
            Mention::create([
                'mentioned_user_id' => $mentionedUserId,
                'mentioner_id' => $mentionerId,
                'comment_id' => $comment->id,
                'post_id' => $comment->post_id,
            ]);
        }

        $newMentionedUserIds = array_diff($mentionedUserIds, $existingMentionedUserIds);

        if ($newMentionedUserIds === []) {
            return;
        }

        $mentioner = User::query()->find($mentionerId);
        if (! $mentioner) {
            return;
        }

        User::query()
            ->whereIn('id', $newMentionedUserIds)
            ->get()
            ->each(fn (User $mentionedUser) => InAppActivityNotifier::send($mentionedUser, 'mention', $mentioner, [
                'message' => 'mentioned you in a comment',
                'post' => [
                    'id' => $comment->post_id,
                ],
                'comment' => [
                    'id' => $comment->id,
                ],
            ]));
    }

    private function resolveMentionedUserIds(?string $content, int $mentionerId): array
    {
        if (! $content) {
            return [];
        }

        preg_match_all('/@([A-Za-z0-9_]+)/', $content, $matches);

        $usernames = collect($matches[1] ?? [])
            ->map(fn ($username) => strtolower($username))
            ->unique()
            ->values();

        if ($usernames->isEmpty()) {
            return [];
        }

        $blockedUserIds = UserBlocks::allRelatedUserIds($mentionerId);

        return User::query()
            ->where(function ($query) use ($usernames) {
                foreach ($usernames as $username) {
                    $query->orWhereRaw('LOWER(username) = ?', [$username]);
                }
            })
            ->where('id', '!=', $mentionerId)
            ->when(
                $blockedUserIds !== [],
                fn ($query) => $query->whereNotIn('id', $blockedUserIds)
            )
            ->pluck('id')
            ->all();
    }

}
