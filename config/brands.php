<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default brand
    |--------------------------------------------------------------------------
    |
    | Used when the request host does not match any configured domain (e.g.
    | local development on http://localhost). In local you can also flip the
    | active brand with the ?brand=<key> query string.
    |
    */

    'default' => env('BRAND_DEFAULT', 'stocks'),

    /*
    |--------------------------------------------------------------------------
    | Host => brand key
    |--------------------------------------------------------------------------
    |
    | A single deployment serves every brand; the active brand is resolved
    | from the request host. Add the production and local hosts here.
    |
    */

    'domains' => [
        'stocks.revuw.test' => 'stocks',
        'startups.revuw.test' => 'startups',
        // Production hosts:
        // 'stocks.revuw.io' => 'stocks',
        // 'startups.revuw.io' => 'startups',
    ],

    /*
    |--------------------------------------------------------------------------
    | Brands
    |--------------------------------------------------------------------------
    |
    | `entityType` is the only entity type this brand exposes — it is applied
    | server-side to every entity query, so users can never request another
    | type. Colours live in resources/css/app.css under [data-brand=...].
    |
    */

    'brands' => [

        'stocks' => [
            'key' => 'stocks',
            'name' => 'Revuw Stocks',
            'logo' => '/brands/stocks-logo.svg',
            'entityType' => 'stocks',
            // TL;DR context to prefer from mind-jam for this brand.
            'tldrContext' => 'finance',
            // mind-jam `entities.type` values mapped to this brand. The source
            // data has no public/private or ticker classification, so this is
            // a curated proxy — tune it freely.
            'types' => [
                'companies', 'company', 'stocks', 'organizations', 'brands',
                'financial_instruments', 'financial_products', 'stock_indices',
                'indices', 'markets', 'financial_assets',
            ],
            'copy' => [
                'tagline' => 'How the internet talks about public companies.',
                'entityNoun' => 'stock',
                'entityNounPlural' => 'stocks',
            ],
        ],

        'startups' => [
            'key' => 'startups',
            'name' => 'Revuw Startups',
            'logo' => '/brands/startups-logo.svg',
            'entityType' => 'startups',
            'tldrContext' => 'tech',
            'types' => [
                'companies', 'organizations', 'software', 'technology',
                'technologies', 'tech', 'platforms', 'software_platforms',
                'apps', 'ai_models', 'developer_tools', 'startups',
            ],
            'copy' => [
                'tagline' => 'How the internet talks about private startups.',
                'entityNoun' => 'startup',
                'entityNounPlural' => 'startups',
            ],
        ],

    ],

];
