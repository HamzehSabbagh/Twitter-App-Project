<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\CommentLike;
use App\Models\Like;
use App\Models\Post;
use App\Support\InAppActivityNotifier;
use App\Support\UserBlocks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    public function storePost(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        abort_if(UserBlocks::areUsersBlocked($user->id, $post->user_id), 403, 'You cannot like a blocked user post.');

        $like = Like::query()->firstOrCreate([
            'user_id' => $user->id,
            'post_id' => $post->id,
        ]);

        if ($like->wasRecentlyCreated) {
            $post->loadMissing('user:id,username');
            InAppActivityNotifier::send($post->user, 'post_like', $user, [
                'message' => 'liked your post',
                'post' => [
                    'id' => $post->id,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Post liked.',
        ]);
    }

    public function destroyPost(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();
        abort_if(UserBlocks::areUsersBlocked($user->id, $post->user_id), 403, 'You cannot interact with a blocked user post.');

        Like::query()
            ->where('user_id', $user->id)
            ->where('post_id', $post->id)
            ->delete();

        return response()->json([
            'message' => 'Post like removed.',
        ]);
    }

    public function storeComment(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        abort_if(UserBlocks::areUsersBlocked($user->id, $comment->user_id), 403, 'You cannot like a blocked user comment.');

        $commentLike = CommentLike::query()->firstOrCreate([
            'user_id' => $user->id,
            'comment_id' => $comment->id,
        ]);

        if ($commentLike->wasRecentlyCreated) {
            $comment->loadMissing('user:id,username', 'post:id');
            InAppActivityNotifier::send($comment->user, 'comment_like', $user, [
                'message' => 'liked your comment',
                'post' => [
                    'id' => $comment->post_id,
                ],
                'comment' => [
                    'id' => $comment->id,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Comment liked.',
        ]);
    }

    public function destroyComment(Request $request, Comment $comment): JsonResponse
    {
        $user = $request->user();
        abort_if(UserBlocks::areUsersBlocked($user->id, $comment->user_id), 403, 'You cannot interact with a blocked user comment.');

        CommentLike::query()
            ->where('user_id', $user->id)
            ->where('comment_id', $comment->id)
            ->delete();

        return response()->json([
            'message' => 'Comment like removed.',
        ]);
    }

}
