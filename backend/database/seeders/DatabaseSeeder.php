<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $userRole = Role::query()->firstOrCreate(['name' => 'user']);
        Role::query()->firstOrCreate(['name' => 'admin']);

        User::query()->firstOrCreate(
            ['email' => 'mobile@example.com'],
            [
                'first_name' => 'Mobile',
                'last_name' => 'User',
                'username' => 'mobile_user',
                'birth_date' => '2000-01-01',
                'role_id' => $userRole->id,
                'password' => 'password123',
                'is_profile_public' => true,
            ]
        );
    }
}
