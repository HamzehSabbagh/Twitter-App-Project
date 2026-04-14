<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AuthController extends Controller
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

    private function transformUser(User $user): array
    {
        return [
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'username' => $user->username,
            'email' => $user->email,
            'picture_url' => $user->hasProfilePicture()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'picture'], false))
                : null,
            'cover_url' => $user->hasCoverImage()
                ? $this->absoluteUrl(route('profile.image', ['user' => $user->username, 'type' => 'cover'], false))
                : null,
            'role' => $user->role ? [
                'id' => $user->role->id,
                'name' => $user->role->name,
            ] : null,
        ];
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'username' => ['required', 'string', 'max:30', Rule::unique('users', 'username')],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'birth_date' => ['required', 'date', 'before_or_equal:' . now()->subYears(18)->toDateString()],
            'location' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:160'],
            'is_profile_public' => ['nullable', 'boolean'],
        ]);

        $role = Role::query()->firstOrCreate(['name' => 'user']);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'username' => $validated['username'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'birth_date' => $validated['birth_date'],
            'location' => $validated['location'] ?? null,
            'bio' => $validated['bio'] ?? null,
            'is_profile_public' => $validated['is_profile_public'] ?? true,
            'role_id' => $role->id,
        ]);

        event(new Registered($user));

        return response()->json([
            'message' => 'Registered successfully. Please verify your email before logging in.',
            'email' => $user->email,
            'requires_verification' => true,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
            ], 422);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before logging in.',
            ], 403);
        }

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'message' => 'Logged in successfully.',
            'token' => $token,
            'user' => $this->transformUser($user->load('role')),
        ]);
    }

    public function resendVerification(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user) {
            return response()->json([
                'message' => 'If that account exists, a verification email has been sent.',
            ]);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'This email address is already verified.',
            ]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Verification email sent.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user()?->load('role');

        return response()->json($user ? $this->transformUser($user) : null);
    }
}
