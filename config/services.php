<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Which DataProvider backs the investor pages: 'mock' (fixtures) or
    // 'database' (mind-jam's shared Postgres, not implemented yet).
    'data' => [
        'provider' => env('DATA_PROVIDER', 'mock'),

        // Optional allowlist of YouTube handles (case-insensitive). When set,
        // DatabaseDataProvider filters every channel/video/mention query down
        // to chatter from these handles only. Empty (default) = no filter.
        // Override via YOUTUBE_ALLOWED_HANDLES env (comma-separated, with or
        // without the leading `@`).
        'youtube_handles' => array_values(array_filter(array_map(
            fn (string $h): string => '@'.ltrim(trim($h), '@'),
            explode(',', (string) env('YOUTUBE_ALLOWED_HANDLES', implode(',', [
                'thecompoundnews',
                'theprofgpod',
            ]))),
        ), fn (string $h): bool => $h !== '@')),
    ],

    // Share-price source: 'mock' (fixtures) or 'eodhd' (live, not implemented).
    'eodhd' => [
        'provider' => env('PRICE_PROVIDER', 'mock'),
        'key' => env('EODHD_API_KEY'),
        'base_url' => env('EODHD_BASE_URL', 'https://eodhd.com/api'),
    ],

];
