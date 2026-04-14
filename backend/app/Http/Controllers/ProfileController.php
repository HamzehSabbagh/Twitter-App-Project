<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\InAppActivityNotifier;
use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    private function mediaUrl($media): string
    {
        return $this->absoluteUrl(route('post.media', ['media' => $media->id], false));
    }

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

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user, 401);

        return response()->json([
            'profile' => $this->transformProfile($user, $user),
        ]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $viewer = $this->resolveViewer($request);
        $isAdmin = strtolower((string) $viewer?->role?->name) === 'admin';
        $isOwner = $viewer?->id === $user->id;
        $blockedByViewer = UserBlocks::blockedByViewer($viewer, $user);
        $blocksViewer = UserBlocks::blocksViewer($viewer, $user);

        if (($blockedByViewer || $blocksViewer) && ! $isOwner) {
            return response()->json([
                'profile' => $this->transformBlockedProfile($user, $viewer, $blockedByViewer, $blocksViewer),
            ]);
        }

        if (! $user->is_profile_public && ! $isOwner && ! $isAdmin) {
            return response()->json([
                'profile' => [
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'username' => $user->username,
                    'is_private' => true,
                    'blocked_by_viewer' => false,
                    'blocks_viewer' => false,
                    'is_following' => $viewer ? $viewer->following()->where('users.id', $user->id)->exists() : false,
                    'follow_request_sent' => $viewer ? $viewer->sentFollowRequests()->where('users.id', $user->id)->exists() : false,
                    'can_message' => $viewer ? $this->canUsersDirectMessage($viewer, $user) : false,
                ],
            ]);
        }

        return response()->json([
            'profile' => $this->transformProfile($user, $viewer),
        ]);
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $isAdmin = strtolower((string) $viewer?->role?->name) === 'admin';
        $query = trim((string) $request->query('query', ''));
        $blockedUserIds = UserBlocks::allRelatedUserIds($viewer?->id);

        if ($query === '') {
            return response()->json([]);
        }

        $users = User::query()
            ->select(['id', 'first_name', 'last_name', 'username', 'is_profile_public'])
            ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture')
            ->when(
                ! $isAdmin,
                fn ($builder) => $builder->where(function ($privacyQuery) use ($viewer) {
                    $privacyQuery
                        ->where('is_profile_public', true)
                        ->when($viewer, fn ($innerQuery) => $innerQuery->orWhere('id', $viewer->id));
                })
            )
            ->when(
                $blockedUserIds !== [],
                fn ($builder) => $builder->whereNotIn('id', $blockedUserIds)
            )
            ->where(function ($builder) use ($query) {
                $builder
                    ->where('username', 'like', "%{$query}%")
                    ->orWhere('first_name', 'like', "%{$query}%")
                    ->orWhere('last_name', 'like', "%{$query}%");
            })
            ->orderByRaw('CASE WHEN username LIKE ? THEN 0 ELSE 1 END', ["{$query}%"])
            ->orderBy('username')
            ->limit(6)
            ->get();

        return response()->json(
            $users->map(fn (User $user) => [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'username' => $user->username,
                'picture_url' => $user->has_picture
                    ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'picture'], false))
                    : null,
            ])->values()
        );
    }

    public function follow(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot follow yourself.');
        abort_if(UserBlocks::areUsersBlocked($viewer->id, $user->id), 403, 'You cannot follow a blocked user.');

        $existingFollow = DB::table('user_follows')
            ->where('follower_id', $viewer->id)
            ->where('following_id', $user->id)
            ->first();

        if ($existingFollow?->accepted_at) {
            return response()->json([
                'message' => 'You are already following this user.',
                'follow_request_sent' => false,
                'is_following' => true,
            ]);
        }

        if ($existingFollow) {
            return response()->json([
                'message' => 'Follow request already sent.',
                'follow_request_sent' => true,
                'is_following' => false,
            ]);
        }

        DB::table('user_follows')->insert([
            'follower_id' => $viewer->id,
            'following_id' => $user->id,
            'created_at' => now(),
            'accepted_at' => null,
        ]);

        InAppActivityNotifier::send($user, 'follow_request', $viewer, [
            'message' => 'sent you a follow request',
            'profile' => [
                'id' => $viewer->id,
                'username' => $viewer->username,
            ],
        ]);

        return response()->json([
            'message' => 'Follow request sent.',
            'follow_request_sent' => true,
            'is_following' => false,
        ]);
    }

    public function unfollow(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot unfollow yourself.');
        abort_if(UserBlocks::areUsersBlocked($viewer->id, $user->id), 403, 'You cannot unfollow a blocked user.');

        DB::table('user_follows')
            ->where('follower_id', $viewer->id)
            ->where('following_id', $user->id)
            ->delete();

        return response()->json([
            'message' => 'Follow removed.',
            'is_following' => false,
            'follow_request_sent' => false,
        ]);
    }

    public function acceptFollowRequest(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();
        abort_if(UserBlocks::areUsersBlocked($viewer->id, $user->id), 403, 'You cannot accept a blocked user.');

        $updated = DB::table('user_follows')
            ->where('follower_id', $user->id)
            ->where('following_id', $viewer->id)
            ->whereNull('accepted_at')
            ->update([
                'accepted_at' => now(),
            ]);

        abort_unless($updated > 0, 404, 'Follow request not found.');

        InAppActivityNotifier::send($user, 'follow_accepted', $viewer, [
            'message' => 'accepted your follow request',
            'profile' => [
                'id' => $viewer->id,
                'username' => $viewer->username,
            ],
        ]);

        return response()->json([
            'message' => 'Follow request accepted.',
        ]);
    }

    public function declineFollowRequest(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();
        abort_if(UserBlocks::areUsersBlocked($viewer->id, $user->id), 403, 'You cannot decline a blocked user.');

        $deleted = DB::table('user_follows')
            ->where('follower_id', $user->id)
            ->where('following_id', $viewer->id)
            ->whereNull('accepted_at')
            ->delete();

        abort_unless($deleted > 0, 404, 'Follow request not found.');

        return response()->json([
            'message' => 'Follow request declined.',
        ]);
    }

    public function block(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot block yourself.');

        DB::table('user_blocks')->updateOrInsert(
            [
                'blocker_id' => $viewer->id,
                'blocked_id' => $user->id,
            ],
            [
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        DB::table('user_follows')
            ->where(function ($query) use ($viewer, $user) {
                $query
                    ->where('follower_id', $viewer->id)
                    ->where('following_id', $user->id);
            })
            ->orWhere(function ($query) use ($viewer, $user) {
                $query
                    ->where('follower_id', $user->id)
                    ->where('following_id', $viewer->id);
            })
            ->delete();

        return response()->json([
            'message' => 'User blocked.',
        ]);
    }

    public function unblock(Request $request, User $user): JsonResponse
    {
        $viewer = $request->user();

        abort_if($viewer->id === $user->id, 422, 'You cannot unblock yourself.');

        DB::table('user_blocks')
            ->where('blocker_id', $viewer->id)
            ->where('blocked_id', $user->id)
            ->delete();

        return response()->json([
            'message' => 'User unblocked.',
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:30', Rule::unique('users', 'username')->ignore($user->id)],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'birth_date' => ['required', 'date', 'before_or_equal:' . now()->subYears(18)->toDateString()],
            'location' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:160'],
            'is_profile_public' => ['required', 'boolean'],
            'picture' => ['nullable', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp'],
            'cover' => ['nullable', 'file', 'max:5120', 'mimetypes:image/jpeg,image/png,image/webp'],
        ]);

        unset($validated['picture'], $validated['cover']);

        if ($request->hasFile('picture')) {
            $validated = [
                ...$validated,
                ...$this->storeProfileImageFile($user, $request->file('picture'), 'picture'),
            ];
        }

        if ($request->hasFile('cover')) {
            $validated = [
                ...$validated,
                ...$this->storeProfileImageFile($user, $request->file('cover'), 'cover'),
            ];
        }

        $user->update($validated);
        $user->refresh();

        return response()->json([
            'message' => 'Profile updated.',
            'profile' => $this->transformProfile($user, $user),
        ]);
    }

    private function transformProfile(User $user, ?User $viewer): array
    {
        $isAdmin = strtolower((string) $viewer?->role?->name) === 'admin';
        $isOwner = $viewer?->id === $user->id;
        $blockedByViewer = UserBlocks::blockedByViewer($viewer, $user);
        $blocksViewer = UserBlocks::blocksViewer($viewer, $user);

        $user->load([
            'role:id,name',
            'posts' => fn ($query) => $query
                ->with(['media:id,post_id,type,path,mime_type,duration_seconds,size_bytes'])
                ->withCount(['likes', 'comments', 'reposts'])
                ->latest(),
            'reposts' => fn ($query) => $query
                ->with([
                    'post' => fn ($postQuery) => $postQuery
                        ->with([
                            'user' => fn ($userQuery) => $userQuery
                                ->select(['id', 'first_name', 'last_name', 'username'])
                                ->selectRaw('CASE WHEN picture IS NULL AND picture_path IS NULL THEN 0 ELSE 1 END as has_picture'),
                            'media:id,post_id,type,path,mime_type,duration_seconds,size_bytes',
                        ])
                        ->withCount(['likes', 'comments', 'reposts']),
                ])
                ->latest(),
        ]);
        $user->loadCount(['followers', 'following']);

        $timelineItems = collect($user->posts)->map(fn ($post) => [
            'id' => $post->id,
            'content' => $post->content,
            'created_at' => $post->created_at?->toDateTimeString(),
            'likes_count' => $post->likes_count,
            'comments_count' => $post->comments_count,
            'reposts_count' => $post->reposts_count,
            'can_delete' => $post->user_id === $viewer?->id || $isAdmin,
            'can_edit' => $post->user_id === $viewer?->id,
            'is_repost' => false,
            'media' => $post->media->map(fn ($media) => [
                'id' => $media->id,
                'type' => $media->type,
                'path' => $media->path,
                'url' => $this->mediaUrl($media),
                'mime_type' => $media->mime_type,
            ])->values(),
        ])->concat(
            collect($user->reposts)
                ->filter(fn ($repost) => $repost->post)
                ->map(fn ($repost) => [
                    'id' => $repost->id,
                    'content' => $repost->comment,
                    'created_at' => $repost->created_at?->toDateTimeString(),
                    'likes_count' => $repost->post->likes_count,
                    'comments_count' => $repost->post->comments_count,
                    'reposts_count' => $repost->post->reposts_count,
                    'can_delete' => false,
                    'can_edit' => false,
                    'is_repost' => true,
                    'original_post' => [
                        'id' => $repost->post->id,
                        'content' => $repost->post->content,
                        'created_at' => $repost->post->created_at?->toDateTimeString(),
                        'user' => [
                            'first_name' => $repost->post->user?->first_name,
                            'last_name' => $repost->post->user?->last_name,
                            'username' => $repost->post->user?->username,
                            'picture_url' => $repost->post->user?->has_picture
                                ? $this->absoluteUrl(route('profile.image', ['user' => $repost->post->user->username, 'type' => 'picture'], false))
                                : null,
                        ],
                        'media' => $repost->post->media->map(fn ($media) => [
                            'id' => $media->id,
                            'type' => $media->type,
                            'path' => $media->path,
                            'url' => $this->mediaUrl($media),
                            'mime_type' => $media->mime_type,
                        ])->values(),
                    ],
                    'media' => collect()->values(),
                ])
        )
            ->sortByDesc('created_at')
            ->values();

        return [
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'email' => $isOwner ? $user->email : null,
            'birth_date' => $isOwner ? $user->birth_date?->toDateString() : null,
            'bio' => $user->bio,
            'location' => $user->location,
            'role_name' => $user->role?->name,
            'picture_url' => $user->hasProfilePicture()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'picture'], false))
                : null,
            'cover_url' => $user->hasCoverImage()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'cover'], false))
                : null,
            'is_owner' => $isOwner,
            'blocked_by_viewer' => $blockedByViewer,
            'blocks_viewer' => $blocksViewer,
            'is_following' => $viewer ? $viewer->following()->where('users.id', $user->id)->exists() : false,
            'follow_request_sent' => $viewer ? $viewer->sentFollowRequests()->where('users.id', $user->id)->exists() : false,
            'is_profile_public' => (bool) $user->is_profile_public,
            'can_message' => $viewer ? $this->canUsersDirectMessage($viewer, $user) : false,
            'followers_count' => $user->followers_count,
            'following_count' => $user->following_count,
            'pending_follow_requests_count' => $isOwner ? $user->receivedFollowRequests()->count() : 0,
            'posts' => $timelineItems,
        ];
    }

    private function canUsersDirectMessage(User $viewer, User $user): bool
    {
        if ($viewer->id === $user->id) {
            return false;
        }

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

    private function resolveViewer(Request $request): ?User
    {
        $viewer = $request->user();

        if ($viewer instanceof User) {
            return $viewer;
        }

        $guardViewer = Auth::guard('sanctum')->user();

        return $guardViewer instanceof User ? $guardViewer : null;
    }

    private function transformBlockedProfile(User $user, ?User $viewer, bool $blockedByViewer, bool $blocksViewer): array
    {
        return [
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'picture_url' => $user->hasProfilePicture()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'picture'], false))
                : null,
            'cover_url' => $user->hasCoverImage()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'cover'], false))
                : null,
            'bio' => null,
            'location' => null,
            'role_name' => null,
            'email' => null,
            'birth_date' => null,
            'is_owner' => false,
            'is_private' => false,
            'is_profile_public' => false,
            'is_following' => false,
            'follow_request_sent' => false,
            'can_message' => false,
            'blocked_by_viewer' => $blockedByViewer,
            'blocks_viewer' => $blocksViewer,
            'followers_count' => 0,
            'following_count' => 0,
            'pending_follow_requests_count' => 0,
            'posts' => [],
        ];
    }

    private function storeProfileImageFile(User $user, UploadedFile $file, string $type): array
    {
        $disk = Storage::disk('public');
        $pathColumn = "{$type}_path";
        $mimeColumn = "{$type}_mime";

        if ($user->{$pathColumn}) {
            $disk->delete($user->{$pathColumn});
        }

        $path = $file->store("profiles/{$user->id}/{$type}", 'public');

        return [
            $type => null,
            $pathColumn => $path,
            $mimeColumn => $file->getMimeType(),
        ];
    }
}
