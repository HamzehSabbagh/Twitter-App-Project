<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Hashtag;
use App\Models\Like;
use App\Models\Mention;
use App\Models\Post;
use App\Models\PostMedia;
use App\Models\Repost;
use App\Models\User;
use App\Support\InAppActivityNotifier;
use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PostController extends Controller
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
        $userId = $request->user()?->id;
        $blockedUserIds = UserBlocks::allRelatedUserIds($userId);

        $posts = $this->basePostQuery($userId, $blockedUserIds)
            ->latest()
            ->get()
            ->map(fn (Post $post) => $this->transformPost($post));

        $reposts = $this->baseRepostQuery($userId, $blockedUserIds)
            ->latest()
            ->get()
            ->map(fn (Repost $repost) => $this->transformRepost($repost));

        $timeline = $this->paginateTimelineItems(
            $request,
            $posts->concat($reposts)
                ->sortByDesc('created_at')
                ->values(),
            10
        );

        return response()->json([
            'data' => $timeline->items(),
            'current_page' => $timeline->currentPage(),
            'last_page' => $timeline->lastPage(),
            'per_page' => $timeline->perPage(),
            'total' => $timeline->total(),
            'has_more_pages' => $timeline->hasMorePages(),
        ]);
    }

    public function explore(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;
        $blockedUserIds = UserBlocks::allRelatedUserIds($userId);

        $posts = $this->basePostQuery($userId, $blockedUserIds)
            ->orderByDesc(Like::query()->selectRaw('count(*)')->whereColumn('likes.post_id', 'posts.id'))
            ->orderByDesc(Comment::query()->selectRaw('count(*)')->whereColumn('comments.post_id', 'posts.id'))
            ->latest()
            ->paginate(12);

        $trendingHashtags = Hashtag::query()
            ->whereNotNull('name')
            ->where('name', '!=', '')
            ->has('posts')
            ->withCount('posts')
            ->orderByDesc('posts_count')
            ->limit(8)
            ->get();

        $suggestedUsers = User::query()
            ->select(['id', 'first_name', 'last_name', 'username'])
            ->when($userId, fn ($query) => $query->where('id', '!=', $userId))
            ->when(
                $blockedUserIds !== [],
                fn ($query) => $query->whereNotIn('id', $blockedUserIds)
            )
            ->when(
                $userId,
                fn ($query) => $query->whereDoesntHave(
                    'followers',
                    fn ($followerQuery) => $followerQuery->where('follower_id', $userId)
                )
            )
            ->withCount(['followers', 'posts'])
            ->orderByDesc('followers_count')
            ->orderByDesc('posts_count')
            ->limit(6)
            ->get();

        return response()->json([
            'posts' => $posts->getCollection()->map(fn (Post $post) => $this->transformPost($post))->values(),
            'current_page' => $posts->currentPage(),
            'last_page' => $posts->lastPage(),
            'has_more_pages' => $posts->hasMorePages(),
            'trendingHashtags' => $trendingHashtags->map(fn (Hashtag $hashtag) => [
                'id' => $hashtag->id,
                'name' => $hashtag->name,
                'posts_count' => $hashtag->posts_count,
            ])->values(),
            'suggestedUsers' => $suggestedUsers->map(fn (User $user) => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'username' => $user->username,
                'followers_count' => $user->followers_count,
                'posts_count' => $user->posts_count,
            ])->values(),
        ]);
    }

    public function hashtag(string $hashtag): JsonResponse
    {
        $userId = request()->user()?->id;
        $blockedUserIds = UserBlocks::allRelatedUserIds($userId);
        $normalizedHashtag = Str::of($hashtag)->lower()->ltrim('#')->toString();

        $hashtagModel = Hashtag::query()
            ->whereRaw('LOWER(name) = ?', [$normalizedHashtag])
            ->withCount('posts')
            ->firstOrFail();

        $posts = $this->basePostQuery($userId, $blockedUserIds)
            ->whereHas('hashtags', fn ($query) => $query->where('hashtags.id', $hashtagModel->id))
            ->orderByDesc(Like::query()->selectRaw('count(*)')->whereColumn('likes.post_id', 'posts.id'))
            ->orderByDesc(Comment::query()->selectRaw('count(*)')->whereColumn('comments.post_id', 'posts.id'))
            ->orderByDesc(Repost::query()->selectRaw('count(*)')->whereColumn('reposts.post_id', 'posts.id'))
            ->latest()
            ->get();

        return response()->json([
            'hashtag' => [
                'id' => $hashtagModel->id,
                'name' => $hashtagModel->name,
                'posts_count' => $hashtagModel->posts_count,
            ],
            'posts' => $posts->map(fn (Post $post) => $this->transformPost($post))->values(),
        ]);
    }

    public function show(Post $post): JsonResponse
    {
        $viewer = request()->user();
        $userId = $viewer?->id;
        $blockedUserIds = UserBlocks::allRelatedUserIds($userId);

        abort_if(
            $userId && UserBlocks::areUsersBlocked($userId, $post->user_id),
            404,
            'Post not found.'
        );

        $post->load([
            'user' => fn ($query) => $query
                ->select(['id', 'first_name', 'last_name', 'username'])
                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
            'hashtags:id,name',
            'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes',
            'likes' => fn ($query) => $query
                ->when($userId, fn ($likeQuery) => $likeQuery->where('user_id', $userId))
                ->select('id', 'user_id', 'post_id'),
            'comments' => fn ($query) => $query
                ->whereNull('parent_id')
                ->when(
                    $blockedUserIds !== [],
                    fn ($commentQuery) => $commentQuery->whereNotIn('user_id', $blockedUserIds)
                )
                ->with([
                    'user' => fn ($userQuery) => $userQuery
                        ->select(['id', 'first_name', 'last_name', 'username'])
                        ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                    'hashtags:id,name',
                    'likes' => fn ($likeQuery) => $likeQuery
                        ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                        ->select('id', 'user_id', 'comment_id'),
                    'replies' => fn ($replyQuery) => $replyQuery
                        ->when(
                            $blockedUserIds !== [],
                            fn ($innerReplyQuery) => $innerReplyQuery->whereNotIn('user_id', $blockedUserIds)
                        )
                        ->with([
                            'user' => fn ($userQuery) => $userQuery
                                ->select(['id', 'first_name', 'last_name', 'username'])
                                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                            'hashtags:id,name',
                            'likes' => fn ($replyLikeQuery) => $replyLikeQuery
                                ->when($userId, fn ($innerReplyLikeQuery) => $innerReplyLikeQuery->where('user_id', $userId))
                                ->select('id', 'user_id', 'comment_id'),
                        ])
                        ->withCount('likes')
                        ->latest(),
                ])
                ->withCount('likes')
                ->latest(),
        ])->loadCount(['likes', 'comments', 'reposts']);

        return response()->json([
            'post' => $this->transformPost($post, true),
        ]);
    }

    public function showRepost(Repost $repost): JsonResponse
    {
        $viewer = request()->user();
        $userId = $viewer?->id;
        $blockedUserIds = UserBlocks::allRelatedUserIds($userId);

        abort_if(
            ($userId && UserBlocks::areUsersBlocked($userId, $repost->user_id))
                || ($repost->post_id && $repost->post && $userId && UserBlocks::areUsersBlocked($userId, $repost->post->user_id)),
            404,
            'Repost not found.'
        );

        $repost->load([
            'user' => fn ($query) => $query
                ->select(['id', 'first_name', 'last_name', 'username'])
                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
            'post' => fn ($query) => $query
                ->with([
                    'user' => fn ($userQuery) => $userQuery
                        ->select(['id', 'first_name', 'last_name', 'username'])
                        ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                    'hashtags:id,name',
                    'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes',
                    'comments' => fn ($commentQuery) => $commentQuery
                        ->whereNull('parent_id')
                        ->when(
                            $blockedUserIds !== [],
                            fn ($innerCommentQuery) => $innerCommentQuery->whereNotIn('user_id', $blockedUserIds)
                        )
                        ->with([
                            'user' => fn ($userQuery) => $userQuery
                                ->select(['id', 'first_name', 'last_name', 'username'])
                                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                            'likes' => fn ($likeQuery) => $likeQuery
                                ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                                ->select('id', 'user_id', 'comment_id'),
                        ])
                        ->withCount('likes')
                        ->latest(),
                    'likes' => fn ($likeQuery) => $likeQuery
                        ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                        ->select('id', 'user_id', 'post_id'),
                    'reposts' => fn ($repostQuery) => $repostQuery
                        ->when($userId, fn ($innerRepostQuery) => $innerRepostQuery->where('user_id', $userId))
                        ->select('id', 'user_id', 'post_id'),
                ])
                ->withCount(['likes', 'comments', 'reposts']),
        ]);

        return response()->json([
            'repost' => $this->transformRepost($repost),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePostPayload($request);

        $user = $request->user();

        $post = Post::create([
            'user_id' => $user->id,
            'content' => $validated['content'] ?? null,
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        $this->storeMediaFiles($request->file('media', []), $post);
        $post->hashtags()->sync($this->resolveHashtagIds($validated['content'] ?? null));
        $this->syncPostMentions($post, $validated['content'] ?? null, $user->id);
        $post->load(['user:id,first_name,last_name,username', 'hashtags:id,name', 'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes'])
            ->loadCount(['likes', 'comments', 'reposts']);

        return response()->json([
            'message' => 'Post created.',
            'post' => $this->transformPost($post),
        ], 201);
    }

    public function update(Request $request, Post $post): JsonResponse
    {
        abort_unless($request->user()?->id === $post->user_id, 403);

        $validated = $this->validatePostPayload($request, $post);

        $post->update([
            'content' => $validated['content'] ?? null,
            'parent_id' => $validated['parent_id'] ?? null,
        ]);

        $this->removeMediaFiles($validated['remove_media'] ?? [], $post);
        $this->storeMediaFiles($request->file('media', []), $post);
        $post->hashtags()->sync($this->resolveHashtagIds($validated['content'] ?? null));
        $this->syncPostMentions($post, $validated['content'] ?? null, $request->user()->id);
        $post->load(['user:id,first_name,last_name,username', 'hashtags:id,name', 'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes'])
            ->loadCount(['likes', 'comments', 'reposts']);

        return response()->json([
            'message' => 'Post updated.',
            'post' => $this->transformPost($post),
        ]);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        $isAdmin = strtolower((string) $user?->role?->name) === 'admin';

        abort_unless($user?->id === $post->user_id || $isAdmin, 403);

        foreach ($post->media as $media) {
            Storage::disk('public')->delete($media->path);
        }

        $post->delete();

        return response()->json([
            'message' => 'Post deleted.',
        ]);
    }

    public function storeRepost(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        abort_if(UserBlocks::areUsersBlocked($user->id, $post->user_id), 403, 'You cannot repost a blocked user post.');

        $request->validate([
            'comment' => ['nullable', 'string'],
        ]);

        $repost = Repost::firstOrCreate(
            [
                'user_id' => $user->id,
                'post_id' => $post->id,
            ],
            [
                'comment' => $request->string('comment')->toString() ?: null,
            ]
        );

        if ($repost->wasRecentlyCreated === false && $request->filled('comment')) {
            $repost->update([
                'comment' => $request->string('comment')->toString() ?: null,
            ]);
        }

        if ($repost->wasRecentlyCreated) {
            $post->loadMissing('user:id,username');
            InAppActivityNotifier::send($post->user, 'repost', $user, [
                'message' => 'reposted your post',
                'post' => [
                    'id' => $post->id,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Post reposted.',
        ], 201);
    }

    public function destroyRepost(Request $request, Post $post): JsonResponse
    {
        abort_if(UserBlocks::areUsersBlocked($request->user()->id, $post->user_id), 403, 'You cannot interact with a blocked user post.');

        Repost::query()
            ->where('user_id', $request->user()->id)
            ->where('post_id', $post->id)
            ->delete();

        return response()->json([
            'message' => 'Repost removed.',
        ]);
    }

    private function storeMediaFiles(array|UploadedFile|null $files, Post $post): void
    {
        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        foreach ($files ?? [] as $file) {
            $mimeType = $file->getMimeType() ?? 'application/octet-stream';
            $category = explode('/', $mimeType)[0] ?? 'file';
            $type = in_array($category, ['image', 'video', 'audio'], true) ? $category : 'file';
            $path = $file->store("posts/{$post->id}", 'public');

            PostMedia::create([
                'post_id' => $post->id,
                'type' => $type,
                'path' => $path,
                'mime_type' => $mimeType,
                'duration_seconds' => null,
                'size_bytes' => Storage::disk('public')->size($path),
            ]);
        }
    }

    private function removeMediaFiles(array $mediaIds, Post $post): void
    {
        if ($mediaIds === []) {
            return;
        }

        $mediaItems = $post->media()->whereIn('id', $mediaIds)->get();

        foreach ($mediaItems as $media) {
            Storage::disk('public')->delete($media->path);
            $media->delete();
        }
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

    private function syncPostMentions(Post $post, ?string $content, int $mentionerId): void
    {
        $existingMentionedUserIds = $post->mentions()->pluck('mentioned_user_id')->all();
        $post->mentions()->delete();

        $mentionedUserIds = $this->resolveMentionedUserIds($content, $mentionerId);

        foreach ($mentionedUserIds as $mentionedUserId) {
            Mention::create([
                'mentioned_user_id' => $mentionedUserId,
                'mentioner_id' => $mentionerId,
                'post_id' => $post->id,
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
                'message' => 'mentioned you in a post',
                'post' => [
                    'id' => $post->id,
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

    private function validatePostPayload(Request $request, ?Post $post = null): array
    {
        $rules = [
            'content' => ['nullable', 'string'],
            'parent_id' => ['nullable', 'integer', 'exists:posts,id'],
            'media' => ['nullable', 'array', 'max:4'],
            'media.*' => ['file', 'max:51200', 'mimetypes:image/jpeg,image/png,image/webp,video/mp4,video/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/webm'],
            'remove_media' => ['nullable', 'array'],
            'remove_media.*' => ['integer'],
        ];

        $validated = $request->validate(
            $rules,
            [
                'media.max' => 'You can upload up to 4 files per post.',
                'media.*.max' => 'The selected file is too big. Maximum size is 50 MB.',
                'media.*.mimetypes' => 'Only images, videos, and audio files are allowed.',
            ]
        );

        $uploadedMedia = $request->file('media', []);
        $uploadedMediaCount = $uploadedMedia instanceof UploadedFile ? 1 : count($uploadedMedia ?? []);

        if ($post) {
            $remainingMediaCount = $post->media()->count() - count($validated['remove_media'] ?? []) + $uploadedMediaCount;

            if (blank($validated['content'] ?? null) && $remainingMediaCount <= 0) {
                throw ValidationException::withMessages([
                    'content' => 'Write something or keep at least one file attached.',
                ]);
            }
        } elseif (blank($validated['content'] ?? null) && $uploadedMediaCount === 0) {
            throw ValidationException::withMessages([
                'content' => 'Write something or attach at least one file.',
            ]);
        }

        if ($post) {
            $remainingMediaCount = $post->media()->count() - count($validated['remove_media'] ?? []) + $uploadedMediaCount;
            if ($remainingMediaCount > 4) {
                throw ValidationException::withMessages([
                    'media' => 'You can upload up to 4 files per post.',
                ]);
            }
        }

        return $validated;
    }

    private function basePostQuery(?int $userId, array $blockedUserIds = [])
    {
        return Post::query()
            ->when(
                $blockedUserIds !== [],
                fn ($query) => $query->whereNotIn('posts.user_id', $blockedUserIds)
            )
            ->with([
                'user' => fn ($query) => $query
                    ->select(['id', 'first_name', 'last_name', 'username'])
                    ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                'hashtags:id,name',
                'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes',
                'comments' => fn ($query) => $query
                    ->whereNull('parent_id')
                    ->when(
                        $blockedUserIds !== [],
                        fn ($commentQuery) => $commentQuery->whereNotIn('user_id', $blockedUserIds)
                    )
                    ->with([
                        'user' => fn ($userQuery) => $userQuery
                            ->select(['id', 'first_name', 'last_name', 'username'])
                            ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                        'likes' => fn ($likeQuery) => $likeQuery
                            ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                            ->select('id', 'user_id', 'comment_id'),
                    ])
                    ->withCount('likes')
                    ->latest(),
                'likes' => fn ($query) => $query
                    ->when($userId, fn ($likeQuery) => $likeQuery->where('user_id', $userId))
                    ->select('id', 'user_id', 'post_id'),
                'reposts' => fn ($query) => $query
                    ->when($userId, fn ($repostQuery) => $repostQuery->where('user_id', $userId))
                    ->select('id', 'user_id', 'post_id'),
            ])
            ->withCount(['likes', 'comments', 'reposts']);
    }

    private function baseRepostQuery(?int $userId, array $blockedUserIds = [])
    {
        return Repost::query()
            ->when(
                $blockedUserIds !== [],
                fn ($query) => $query
                    ->whereNotIn('reposts.user_id', $blockedUserIds)
                    ->whereHas('post', fn ($postQuery) => $postQuery->whereNotIn('user_id', $blockedUserIds))
            )
            ->with([
                'user' => fn ($query) => $query
                    ->select(['id', 'first_name', 'last_name', 'username'])
                    ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                'post' => fn ($query) => $query
                    ->with([
                        'user' => fn ($userQuery) => $userQuery
                            ->select(['id', 'first_name', 'last_name', 'username'])
                            ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                        'hashtags:id,name',
                        'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes',
                        'comments' => fn ($commentQuery) => $commentQuery
                            ->whereNull('parent_id')
                            ->when(
                                $blockedUserIds !== [],
                                fn ($innerCommentQuery) => $innerCommentQuery->whereNotIn('user_id', $blockedUserIds)
                            )
                            ->with([
                                'user' => fn ($userQuery) => $userQuery
                                    ->select(['id', 'first_name', 'last_name', 'username'])
                                    ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                                'likes' => fn ($likeQuery) => $likeQuery
                                    ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                                    ->select('id', 'user_id', 'comment_id'),
                            ])
                            ->withCount('likes')
                            ->latest(),
                        'likes' => fn ($likeQuery) => $likeQuery
                            ->when($userId, fn ($innerLikeQuery) => $innerLikeQuery->where('user_id', $userId))
                            ->select('id', 'user_id', 'post_id'),
                        'reposts' => fn ($repostQuery) => $repostQuery
                            ->when($userId, fn ($innerRepostQuery) => $innerRepostQuery->where('user_id', $userId))
                            ->select('id', 'user_id', 'post_id'),
                    ])
                    ->withCount(['likes', 'comments', 'reposts']),
            ]);
    }

    private function transformRepost(Repost $repost): array
    {
        $publicDisk = Storage::disk('public');
        $post = $repost->post;

        return [
            'id' => $repost->id,
            'content' => $repost->comment,
            'created_at' => $repost->created_at?->toDateTimeString(),
            'likes_count' => $post?->likes_count ?? 0,
            'comments_count' => $post?->comments_count ?? 0,
            'reposts_count' => $post?->reposts_count ?? 0,
            'liked_by_user' => $post?->likes?->isNotEmpty() ?? false,
            'reposted_by_user' => $post?->reposts?->isNotEmpty() ?? false,
            'is_repost' => true,
            'user' => [
                'first_name' => $repost->user?->first_name,
                'last_name' => $repost->user?->last_name,
                'username' => $repost->user?->username,
                'picture_url' => $repost->user?->has_picture
                    ? $this->absoluteUrl(route('profile.image', ['user' => $repost->user->username, 'type' => 'picture'], false))
                    : null,
            ],
            'original_post' => $post ? [
                'id' => $post->id,
                'content' => $post->content,
                'created_at' => $post->created_at?->toDateTimeString(),
                'user' => [
                    'first_name' => $post->user?->first_name,
                    'last_name' => $post->user?->last_name,
                    'username' => $post->user?->username,
                    'picture_url' => $post->user?->has_picture
                        ? $this->absoluteUrl(route('profile.image', ['user' => $post->user->username, 'type' => 'picture'], false))
                        : null,
                ],
                'hashtags' => $post->hashtags->map(fn ($hashtag) => [
                    'id' => $hashtag->id,
                    'name' => $hashtag->name,
                ])->values(),
                'media' => $post->media->map(fn ($media) => [
                    'id' => $media->id,
                    'type' => $media->type,
                    'path' => $media->path,
                    'url' => $this->absoluteUrl($publicDisk->url($media->path)),
                    'mime_type' => $media->mime_type,
                ])->values(),
            ] : null,
            'comments_preview' => $post
                ? $post->comments->take(2)->map(
                    fn (Comment $comment) => [
                        'id' => $comment->id,
                        'content' => $comment->content,
                        'likes_count' => $comment->likes_count,
                        'liked_by_user' => $comment->likes->isNotEmpty(),
                        'user' => [
                            'first_name' => $comment->user?->first_name,
                            'last_name' => $comment->user?->last_name,
                            'username' => $comment->user?->username,
                        ],
                    ]
                )->values()
                : collect()->values(),
        ];
    }

    private function paginateTimelineItems(Request $request, $items, int $perPage): LengthAwarePaginator
    {
        $page = max(1, (int) $request->query('page', 1));
        $total = $items->count();
        $pageItems = $items->slice(($page - 1) * $perPage, $perPage)->values();

        return new LengthAwarePaginator(
            $pageItems->all(),
            $total,
            $perPage,
            $page,
            ['path' => $request->url(), 'pageName' => 'page']
        );
    }

    private function transformPost(Post $post, bool $withComments = false): array
    {
        $publicDisk = Storage::disk('public');
        $viewer = request()->user();
        $userId = $viewer?->id;
        $isAdmin = strtolower((string) $viewer?->role?->name) === 'admin';

        $payload = [
            'id' => $post->id,
            'title' => Str::limit((string) $post->content, 80, ''),
            'content' => $post->content,
            'parent_id' => $post->parent_id,
            'created_at' => $post->created_at?->toDateTimeString(),
            'likes_count' => $post->likes_count,
            'comments_count' => $post->comments_count,
            'reposts_count' => $post->reposts_count,
            'liked_by_user' => $post->likes->isNotEmpty(),
            'reposted_by_user' => $post->reposts->isNotEmpty(),
            'can_edit' => $post->user_id === $userId,
            'can_delete' => $post->user_id === $userId || $isAdmin,
            'user' => [
                'first_name' => $post->user?->first_name,
                'last_name' => $post->user?->last_name,
                'username' => $post->user?->username,
                'picture_url' => $post->user?->has_picture
                    ? $this->absoluteUrl(route('profile.image', ['user' => $post->user->username, 'type' => 'picture'], false))
                    : null,
            ],
            'hashtags' => $post->hashtags->map(fn ($hashtag) => [
                'id' => $hashtag->id,
                'name' => $hashtag->name,
            ])->values(),
            'media' => $post->media->map(fn ($media) => [
                'id' => $media->id,
                'type' => $media->type,
                'path' => $media->path,
                'url' => $this->absoluteUrl($publicDisk->url($media->path)),
                'mime_type' => $media->mime_type,
            ])->values(),
            'comments_preview' => $post->comments->take(2)->map(
                fn (Comment $comment) => [
                    'id' => $comment->id,
                    'content' => $comment->content,
                    'created_at' => $comment->created_at?->toDateTimeString(),
                    'likes_count' => $comment->likes_count,
                    'liked_by_user' => $comment->likes->isNotEmpty(),
                    'user' => [
                        'first_name' => $comment->user?->first_name,
                        'last_name' => $comment->user?->last_name,
                        'username' => $comment->user?->username,
                        'picture_url' => $comment->user?->has_picture
                            ? $this->absoluteUrl(route('profile.image', ['user' => $comment->user->username, 'type' => 'picture'], false))
                            : null,
                    ],
                ]
            )->values(),
        ];

        if ($withComments) {
            $payload['comments'] = $post->comments->map(
                fn (Comment $comment) => $this->transformComment($comment)
            )->values();
        }

        return $payload;
    }

    private function transformComment(Comment $comment): array
    {
        return [
            'id' => $comment->id,
            'content' => $comment->content,
            'created_at' => $comment->created_at?->toDateTimeString(),
            'likes_count' => $comment->likes_count,
            'liked_by_user' => $comment->likes->isNotEmpty(),
            'user' => [
                'first_name' => $comment->user?->first_name,
                'last_name' => $comment->user?->last_name,
                'username' => $comment->user?->username,
                'picture_url' => $comment->user?->has_picture
                    ? $this->absoluteUrl(route('profile.image', ['user' => $comment->user->username, 'type' => 'picture'], false))
                    : null,
            ],
            'hashtags' => $comment->hashtags->map(fn ($hashtag) => [
                'id' => $hashtag->id,
                'name' => $hashtag->name,
            ])->values(),
            'replies' => $comment->replies->map(
                fn (Comment $reply) => [
                    'id' => $reply->id,
                    'content' => $reply->content,
                    'created_at' => $reply->created_at?->toDateTimeString(),
                    'likes_count' => $reply->likes_count,
                    'liked_by_user' => $reply->likes->isNotEmpty(),
                    'user' => [
                        'first_name' => $reply->user?->first_name,
                        'last_name' => $reply->user?->last_name,
                        'username' => $reply->user?->username,
                        'picture_url' => $reply->user?->has_picture
                            ? $this->absoluteUrl(route('profile.image', ['user' => $reply->user->username, 'type' => 'picture'], false))
                            : null,
                    ],
                    'hashtags' => $reply->hashtags->map(fn ($hashtag) => [
                        'id' => $hashtag->id,
                        'name' => $hashtag->name,
                    ])->values(),
                ]
            )->values(),
        ];
    }
}
