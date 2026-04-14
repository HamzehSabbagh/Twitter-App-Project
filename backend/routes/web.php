<?php

use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/profile/{user:username}/image', function (Request $request, User $user) {
    $type = $request->query('type', 'picture');
    $disk = Storage::disk('public');

    if ($type === 'cover' && $user->cover_path && $disk->exists($user->cover_path)) {
        return response()->file($disk->path($user->cover_path), [
            'Content-Type' => $user->cover_mime ?? 'image/jpeg',
        ]);
    }

    if ($type === 'cover' && $user->cover) {
        return response($user->cover, 200)->header('Content-Type', $user->cover_mime ?? 'image/jpeg');
    }

    if ($user->picture_path && $disk->exists($user->picture_path)) {
        return response()->file($disk->path($user->picture_path), [
            'Content-Type' => $user->picture_mime ?? 'image/jpeg',
        ]);
    }

    if ($user->picture) {
        return response($user->picture, 200)->header('Content-Type', $user->picture_mime ?? 'image/jpeg');
    }

    $defaultProfilePath = public_path('default-profile.png');

    if (file_exists($defaultProfilePath)) {
        return response()->file($defaultProfilePath);
    }

    abort(404);
})->name('profile.image');

Route::get('/email/verify/{id}/{hash}', function (Request $request, string $id, string $hash) {
    if (! $request->hasValidSignature()) {
        abort(403, 'Invalid or expired verification link.');
    }

    $user = User::query()->findOrFail($id);

    if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
        abort(403, 'Invalid verification hash.');
    }

    if (! $user->hasVerifiedEmail()) {
        $user->markEmailAsVerified();
        event(new Verified($user));
    }

    $appUrl = 'hearus://login?verified=1';

    return response(
        <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email verified</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #164e63 100%);
      color: #e2e8f0;
      font-family: Arial, sans-serif;
      padding: 24px;
    }
    .card {
      width: 100%;
      max-width: 520px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(15, 23, 42, 0.92);
      border-radius: 24px;
      padding: 32px;
      box-sizing: border-box;
      box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    }
    .eyebrow {
      color: #67e8f9;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.24em;
      text-transform: uppercase;
    }
    h1 {
      margin: 16px 0 12px;
      font-size: 32px;
      line-height: 1.2;
      color: white;
    }
    p {
      margin: 0;
      line-height: 1.7;
      color: #cbd5e1;
    }
    a.button {
      display: inline-block;
      margin-top: 24px;
      padding: 14px 20px;
      border-radius: 14px;
      background: #22d3ee;
      color: #082f49;
      font-weight: 700;
      text-decoration: none;
    }
    .hint {
      margin-top: 16px;
      font-size: 14px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="eyebrow">Email verified</div>
    <h1>You can return to the app now</h1>
    <p>Your email address has been verified successfully. Tap the button below to open the HearUs mobile app and sign in.</p>
    <a class="button" href="{$appUrl}">Open the app</a>
    <p class="hint">If the app does not open automatically, go back to the app manually and sign in.</p>
  </main>
  <script>
    window.location.replace("{$appUrl}");
  </script>
</body>
</html>
HTML,
        200,
        ['Content-Type' => 'text/html; charset=UTF-8']
    );
})->name('verification.verify');
