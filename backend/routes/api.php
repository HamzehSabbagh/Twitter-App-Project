<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\LikeController;
use App\Http\Controllers\MessageController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\PushTokenController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/email/verification-notification', [AuthController::class, 'resendVerification']);
Route::get('/posts', [PostController::class, 'index']);
Route::get('/explore', [PostController::class, 'explore']);
Route::get('/hashtags/{hashtag}', [PostController::class, 'hashtag']);
Route::get('/posts/{post}', [PostController::class, 'show']);
Route::get('/reposts/{repost}', [PostController::class, 'showRepost']);
Route::get('/users/search', [ProfileController::class, 'searchUsers']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::post('/push-tokens', [PushTokenController::class, 'store']);
    Route::delete('/push-tokens', [PushTokenController::class, 'destroy']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::patch('/posts/{post}', [PostController::class, 'update']);
    Route::delete('/posts/{post}', [PostController::class, 'destroy']);
    Route::post('/posts/{post}/repost', [PostController::class, 'storeRepost']);
    Route::delete('/posts/{post}/repost', [PostController::class, 'destroyRepost']);
    Route::post('/comments', [CommentController::class, 'store']);
    Route::post('/posts/{post}/like', [LikeController::class, 'storePost']);
    Route::delete('/posts/{post}/like', [LikeController::class, 'destroyPost']);
    Route::post('/comments/{comment}/like', [LikeController::class, 'storeComment']);
    Route::delete('/comments/{comment}/like', [LikeController::class, 'destroyComment']);
    Route::get('/profile/me', [ProfileController::class, 'me']);
    Route::patch('/profile', [ProfileController::class, 'update']);
    Route::post('/profile/{user:username}/follow', [ProfileController::class, 'follow']);
    Route::delete('/profile/{user:username}/follow', [ProfileController::class, 'unfollow']);
    Route::post('/profile/{user:username}/block', [ProfileController::class, 'block']);
    Route::delete('/profile/{user:username}/block', [ProfileController::class, 'unblock']);
    Route::post('/profile/follow-requests/{user:username}/accept', [ProfileController::class, 'acceptFollowRequest']);
    Route::delete('/profile/follow-requests/{user:username}', [ProfileController::class, 'declineFollowRequest']);
    Route::get('/messages/conversations', [MessageController::class, 'index']);
    Route::get('/messages/with/{user:username}', [MessageController::class, 'show']);
    Route::post('/messages/with/{user:username}', [MessageController::class, 'store']);
});

Route::get('/profile/{user:username}', [ProfileController::class, 'show']);
