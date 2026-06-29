<?php

namespace App\Services\Data;

use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Deterministic in-memory fixtures shaped exactly like mind-jam's models.
 * Everything is seeded from stable keys (slugs, handles) so entities, channels
 * and videos always cross-reference consistently. Built once per process.
 */
class MockDataset
{
    /** @var array{entities: list<array<string, mixed>>, channels: list<array<string, mixed>>, videos: list<array<string, mixed>>, transcripts: array<string, array<string, mixed>>}|null */
    private static ?array $cache = null;

    /**
     * @return list<array<string, mixed>>
     */
    public static function entities(?string $type = null): array
    {
        $entities = self::build()['entities'];

        if ($type === null) {
            return $entities;
        }

        return array_values(array_filter($entities, fn (array $e): bool => $e['type'] === $type));
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function entityBySlug(string $type, string $slug): ?array
    {
        foreach (self::entities($type) as $entity) {
            if ($entity['slug'] === $slug) {
                return $entity;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function entityById(string $id): ?array
    {
        foreach (self::build()['entities'] as $entity) {
            if ($entity['id'] === $id) {
                return $entity;
            }
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function channels(): array
    {
        return self::build()['channels'];
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function videos(): array
    {
        return self::build()['videos'];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function channelByHandle(string $handle): ?array
    {
        $handle = '@'.ltrim($handle, '@');

        foreach (self::channels() as $channel) {
            if (strcasecmp($channel['handle'], $handle) === 0) {
                return $channel;
            }
        }

        return null;
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function channelById(string $id): ?array
    {
        foreach (self::channels() as $channel) {
            if ($channel['id'] === $id) {
                return $channel;
            }
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function videosForEntity(string $entityId): array
    {
        return array_values(array_filter(
            self::build()['videos'],
            fn (array $v): bool => $v['entityId'] === $entityId,
        ));
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function videosForChannel(string $channelId): array
    {
        return array_values(array_filter(
            self::build()['videos'],
            fn (array $v): bool => $v['channelId'] === $channelId,
        ));
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function transcriptFor(string $videoId): ?array
    {
        return self::build()['transcripts'][$videoId] ?? null;
    }

    /**
     * @return array{entities: list<array<string, mixed>>, channels: list<array<string, mixed>>, videos: list<array<string, mixed>>, transcripts: array<string, array<string, mixed>>}
     */
    private static function build(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        $channels = self::buildChannels();
        $entities = self::buildEntities();
        [$videos, $transcripts] = self::buildVideos($entities, $channels);

        // Attach video-derived aggregates.
        $months = self::monthKeys();

        foreach ($entities as &$entity) {
            $own = array_values(array_filter($videos, fn (array $v): bool => $v['entityId'] === $entity['id']));
            $entity['contentCount'] = count($own);
            $entity['mentionCount'] = count($own);
            $entity['monthlyMentions'] = self::monthlyMentions($own, $months);
        }
        unset($entity);

        foreach ($channels as &$channel) {
            $channel['contentsCount'] = count(array_filter($videos, fn (array $v): bool => $v['channelId'] === $channel['id']));
        }
        unset($channel);

        return self::$cache = [
            'entities' => $entities,
            'channels' => $channels,
            'videos' => $videos,
            'transcripts' => $transcripts,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function buildChannels(): array
    {
        // [title, handle, subscribers, covers, country, persona]
        $raw = [
            ['Bloomberg Television', '@markets', 4_200_000, ['stocks'], 'US', 'Markets desk'],
            ['CNBC Television', '@cnbc', 3_100_000, ['stocks'], 'US', 'Markets desk'],
            ['Yahoo Finance', '@yahoofinance', 1_050_000, ['stocks'], 'US', 'Markets desk'],
            ['Meet Kevin', '@meetkevin', 2_050_000, ['stocks'], 'US', 'Retail investor'],
            ['Andrei Jikh', '@andreijikh', 2_300_000, ['stocks'], 'US', 'Personal finance'],
            ['Graham Stephan', '@grahamstephan', 4_700_000, ['stocks', 'startups'], 'US', 'Personal finance'],
            ['Ali Abdaal', '@aliabdaal', 5_800_000, ['startups'], 'UK', 'Productivity'],
            ['Lex Fridman', '@lexfridman', 4_400_000, ['startups'], 'US', 'Deep tech'],
            ['All-In Podcast', '@allin', 900_000, ['stocks', 'startups'], 'US', 'Founders & VCs'],
            ['Y Combinator', '@ycombinator', 1_400_000, ['startups'], 'US', 'Startups'],
            ['a16z', '@a16z', 350_000, ['startups'], 'US', 'Venture capital'],
            ['The Diary Of A CEO', '@thediaryofaceo', 7_800_000, ['startups'], 'UK', 'Founders'],
        ];

        $channels = [];

        foreach ($raw as $row) {
            [$title, $handle, $subs, $covers, $country, $persona] = $row;
            $videoCount = 40 + (self::h($handle, 'vc') % 240);

            $channels[] = [
                'id' => 'ch-'.ltrim($handle, '@'),
                'title' => $title,
                'handle' => $handle,
                'platformProfileUrl' => 'https://youtube.com/'.$handle,
                // Real channel avatar by handle (falls back to initials if the
                // handle can't be resolved). In production this is the
                // channel's stored platform_info.thumbnail_url.
                'thumbnailUrl' => 'https://unavatar.io/youtube/'.ltrim($handle, '@'),
                'subscriberCount' => $subs,
                'contentsCount' => 0,
                'covers' => $covers,
                'persona' => $persona,
                'platformInfo' => [
                    'description' => $title.' covers the people, companies and trends shaping the market.',
                    'subscriberCount' => $subs,
                    'videoCount' => $videoCount,
                    'viewCount' => $videoCount * (80_000 + self::h($handle, 'vv') % 400_000),
                    'country' => $country,
                    'publishedAt' => CarbonImmutable::create(2009 + self::h($handle, 'yr') % 12, 1, 1)->toIso8601String(),
                ],
                'topics' => self::topicsFor($persona),
            ];
        }

        return $channels;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function buildEntities(): array
    {
        // [name, ticker, sector, marketCap, pe]
        $stocks = [
            ['Apple', 'AAPL.US', 'Consumer tech', '$3.2T', '31.5'],
            ['Microsoft', 'MSFT.US', 'Software', '$3.1T', '36.2'],
            ['Nvidia', 'NVDA.US', 'Semiconductors', '$2.9T', '58.1'],
            ['Tesla', 'TSLA.US', 'Automotive', '$820B', '71.4'],
            ['Amazon', 'AMZN.US', 'E-commerce', '$1.9T', '42.7'],
            ['Alphabet', 'GOOGL.US', 'Software', '$2.1T', '26.9'],
            ['Meta Platforms', 'META.US', 'Software', '$1.3T', '29.3'],
            ['AMD', 'AMD.US', 'Semiconductors', '$260B', '45.0'],
            ['Palantir', 'PLTR.US', 'Software', '$120B', '88.0'],
            ['Coinbase', 'COIN.US', 'Fintech', '$62B', '33.0'],
            ['Netflix', 'NFLX.US', 'Media', '$300B', '41.0'],
            ['Shopify', 'SHOP.US', 'E-commerce', '$140B', '76.0'],
        ];

        // [name, sector, valuation, round, founded, hq]
        $startups = [
            ['OpenAI', 'Artificial intelligence', '$157B', 'Series F', '2015', 'San Francisco'],
            ['Anthropic', 'Artificial intelligence', '$61B', 'Series E', '2021', 'San Francisco'],
            ['SpaceX', 'Aerospace', '$350B', 'Private', '2002', 'Hawthorne'],
            ['Stripe', 'Fintech', '$70B', 'Series I', '2010', 'San Francisco'],
            ['Databricks', 'Data & AI', '$62B', 'Series J', '2013', 'San Francisco'],
            ['Canva', 'Design', '$32B', 'Secondary', '2013', 'Sydney'],
            ['Revolut', 'Fintech', '$45B', 'Secondary', '2015', 'London'],
            ['Ramp', 'Fintech', '$13B', 'Series D', '2019', 'New York'],
            ['Mistral AI', 'Artificial intelligence', '$6B', 'Series B', '2023', 'Paris'],
            ['Perplexity', 'Artificial intelligence', '$9B', 'Series C', '2022', 'San Francisco'],
        ];

        $entities = [];

        foreach ($stocks as $row) {
            [$name, $ticker, $sector, $marketCap, $pe] = $row;
            $slug = Str::slug($name);

            $entities[] = [
                'id' => 'ent-'.$slug,
                'name' => $name,
                'slug' => $slug,
                'type' => 'stocks',
                'ticker' => $ticker,
                'hook' => "The {$sector} name investors can't stop debating.",
                'description' => "{$name} is a publicly traded {$sector} company. Track how YouTube creators and analysts cover {$name}, from earnings reactions to long-term theses.",
                'quickStats' => [
                    ['label' => 'Sector', 'value' => $sector],
                    ['label' => 'Market cap', 'value' => $marketCap],
                    ['label' => 'P/E ratio', 'value' => $pe],
                    ['label' => 'Ticker', 'value' => $ticker],
                ],
                'headlineStat' => null,
                'citations' => self::citationsFor($name),
                'tldr' => self::tldrFor($name, 'stocks'),
                // Filled by build():
                'contentCount' => 0,
                'mentionCount' => 0,
                'monthlyMentions' => [],
            ];
        }

        foreach ($startups as $row) {
            [$name, $sector, $valuation, $round, $founded, $hq] = $row;
            $slug = Str::slug($name);

            $entities[] = [
                'id' => 'ent-'.$slug,
                'name' => $name,
                'slug' => $slug,
                'type' => 'startups',
                'ticker' => null,
                'hook' => "{$sector} startup last valued at {$valuation}.",
                'description' => "{$name} is a privately held {$sector} company founded in {$founded} and headquartered in {$hq}. Follow how the startup is discussed across YouTube.",
                'quickStats' => [
                    ['label' => 'Sector', 'value' => $sector],
                    ['label' => 'Valuation', 'value' => $valuation],
                    ['label' => 'Last round', 'value' => $round],
                    ['label' => 'Founded', 'value' => $founded],
                    ['label' => 'HQ', 'value' => $hq],
                ],
                'headlineStat' => ['label' => 'Valuation', 'value' => $valuation],
                'citations' => self::citationsFor($name),
                'tldr' => self::tldrFor($name, 'startups'),
                'contentCount' => 0,
                'mentionCount' => 0,
                'monthlyMentions' => [],
            ];
        }

        return $entities;
    }

    /**
     * @param  list<array<string, mixed>>  $entities
     * @param  list<array<string, mixed>>  $channels
     * @return array{0: list<array<string, mixed>>, 1: array<string, array<string, mixed>>}
     */
    private static function buildVideos(array $entities, array $channels): array
    {
        $topics = ['earnings breakdown', 'valuation deep dive', 'the bull case', 'the bear case', '5 things to know', 'is it a buy?', 'what the market missed'];
        $claims = ['could be the trade of the year', 'is dividing investors', 'just changed the game', 'is more fragile than it looks', 'keeps beating expectations', 'faces a reckoning'];
        $sentiments = ['positive', 'positive', 'neutral', 'negative', 'neutral'];

        // Same-type peers a video can mention alongside its focal entity.
        $stockEntities = array_values(array_filter($entities, fn ($e) => $e['type'] === 'stocks'));
        $startupEntities = array_values(array_filter($entities, fn ($e) => $e['type'] === 'startups'));

        $videos = [];
        $transcripts = [];

        foreach ($entities as $entity) {
            $slug = $entity['slug'];
            $eligible = array_values(array_filter($channels, fn (array $c): bool => in_array($entity['type'], $c['covers'], true)));

            if ($eligible === []) {
                continue;
            }

            $coverCount = min(count($eligible), 3 + self::h($slug, 'cc') % 3);
            $startIdx = self::h($slug, 'cs') % count($eligible);
            $picked = [];
            for ($k = 0; $k < $coverCount; $k++) {
                $picked[] = $eligible[($startIdx + $k) % count($eligible)];
            }

            $videoCount = 8 + self::h($slug, 'vc') % 9; // 8..16
            $peerPool = $entity['type'] === 'stocks' ? $stockEntities : $startupEntities;

            for ($v = 0; $v < $videoCount; $v++) {
                $channel = $picked[$v % $coverCount];
                $monthsAgo = self::h($slug, 'mo', (string) $v) % 12;
                $day = 1 + self::h($slug, 'dy', (string) $v) % 27;
                $publishedAt = CarbonImmutable::now()->startOfMonth()->subMonths($monthsAgo)->addDays($day);
                $topic = $topics[self::h($slug, 't', (string) $v) % count($topics)];
                $claim = $claims[self::h($slug, 'cl', (string) $v) % count($claims)];
                $durationSeconds = 360 + self::h($slug, 'du', (string) $v) % 2400;

                $id = 'vid-'.$slug.'-'.$v;

                // Real EOD news comes from EodhdNewsService; this mock now
                // only generates the YouTube half of the chatter feed.
                $isYoutube = true;
                $source = 'youtube';

                // Pick the focal entity + 1-3 peers, deterministically.
                $peerCount = 1 + self::h($slug, 'pc', (string) $v) % 3;
                $mentionedEntities = [$entity];
                $peerStart = self::h($slug, 'ps', (string) $v) % max(count($peerPool), 1);
                for ($p = 0; $p < $peerCount && $p < count($peerPool); $p++) {
                    $candidate = $peerPool[($peerStart + $p) % count($peerPool)];
                    if ($candidate['id'] === $entity['id']) {
                        continue;
                    }
                    $mentionedEntities[] = $candidate;
                }

                // Build per-mention occurrences. Each mentioned entity gets 1-3
                // occurrences; for YouTube each has a timestamp inside the
                // video's duration; for EOD news timestamps are null.
                $rawMentions = [];
                foreach ($mentionedEntities as $idx => $me) {
                    $occCount = 1 + self::h($slug, 'oc', (string) $v, (string) $idx) % 3;
                    for ($o = 0; $o < $occCount; $o++) {
                        $sent = $sentiments[self::h($slug, 'ms', (string) $v, (string) $idx, (string) $o) % count($sentiments)];
                        $ts = $isYoutube
                            ? (int) (self::h($slug, 'mt', (string) $v, (string) $idx, (string) $o) % max($durationSeconds - 10, 30))
                            : null;
                        $rawMentions[] = [
                            'entity' => [
                                'name' => $me['name'],
                                'slug' => $me['slug'],
                                'type' => $me['type'],
                            ],
                            'ticker' => $me['ticker'] ?? null,
                            'timestamp' => $ts,
                            'sentiment' => $sent,
                            'snippet' => "{$me['name']} {$claim}.",
                        ];
                    }
                }

                // Sort YouTube mentions by timestamp so segments build cleanly.
                if ($isYoutube) {
                    usort($rawMentions, fn ($a, $b) => $a['timestamp'] <=> $b['timestamp']);
                }

                // Summary: group by entity slug, majority sentiment per group.
                $bySlug = [];
                foreach ($rawMentions as $m) {
                    $key = $m['entity']['slug'];
                    if (! isset($bySlug[$key])) {
                        $bySlug[$key] = [
                            'entity' => $m['entity'],
                            'ticker' => $m['ticker'],
                            'count' => 0,
                            'sentimentTallies' => ['positive' => 0, 'negative' => 0, 'neutral' => 0],
                        ];
                    }
                    $bySlug[$key]['count']++;
                    $bySlug[$key]['sentimentTallies'][$m['sentiment']]++;
                }
                $mentionSummary = [];
                foreach ($bySlug as $row) {
                    arsort($row['sentimentTallies']);
                    $mentionSummary[] = [
                        'entity' => $row['entity'],
                        'ticker' => $row['ticker'],
                        'count' => $row['count'],
                        'sentiment' => array_key_first($row['sentimentTallies']),
                    ];
                }

                $transcripts[$id] = self::buildTimestampedTranscript($id, $rawMentions, $durationSeconds);
                $thumbnail = 'https://picsum.photos/seed/'.$id.'/640/360';
                $title = "{$entity['name']}: {$topic}";
                $url = 'https://youtube.com/watch?v='.substr(md5($id), 0, 11);
                $publisherName = $channel['title'];
                $publisherHandle = $channel['handle'];
                $publisherThumb = $channel['thumbnailUrl'];

                $videos[] = [
                    'id' => $id,
                    'source' => $source,
                    'entityId' => $entity['id'],
                    'channelId' => $channel['id'],
                    'platformContentUuid' => substr(md5($id), 0, 11),
                    'title' => $title,
                    'generatedTitle' => "Why {$entity['name']} {$claim}",
                    'url' => $url,
                    'articleUrl' => '/channels/'.$channel['handle'].'/'.substr(md5($id), 0, 11),
                    'summary' => "In this video, **{$channel['title']}** walks through {$entity['name']} — {$topic}. ".
                        "The discussion covers recent momentum, the key risks, and what it means for investors watching {$entity['name']} right now.",
                    'tldr' => "{$channel['title']} thinks {$entity['name']} {$claim}.",
                    'thumbnail' => $thumbnail,
                    'publishedAt' => $publishedAt->toIso8601String(),
                    'readDuration' => 3 + self::h($slug, 'rd', (string) $v) % 9,
                    'citations' => [
                        [
                            'claim' => "{$entity['name']} {$claim}",
                            'timestamp' => self::h($slug, 'ts', (string) $v) % $durationSeconds,
                            'directQuote' => "\"{$entity['name']} {$claim} — and most people aren't paying attention.\"",
                        ],
                    ],
                    'platformInfo' => [
                        'duration' => $durationSeconds,
                        'viewCount' => 8_000 + self::h($slug, 'vw', (string) $v) % 1_200_000,
                        'likeCount' => 200 + self::h($slug, 'lk', (string) $v) % 60_000,
                        'commentCount' => 10 + self::h($slug, 'cm', (string) $v) % 4_000,
                    ],
                    'entitySentiment' => $sentiments[self::h($slug, 'se', (string) $v) % count($sentiments)],
                    'entityTimestampStart' => self::h($slug, 'st', (string) $v) % $durationSeconds,
                    'channel' => [
                        'title' => $publisherName,
                        'handle' => $publisherHandle,
                        'thumbnailUrl' => $publisherThumb,
                    ],
                    'mentionSummary' => $mentionSummary,
                ];
            }
        }

        return [$videos, $transcripts];
    }

    /**
     * @param  list<array<string, mixed>>  $mentions  pre-sorted by timestamp
     * @return array<string, mixed>
     */
    private static function buildTimestampedTranscript(string $videoId, array $mentions, int $durationSeconds): array
    {
        $intros = [
            "Welcome back everyone. Today I want to walk through a few names I'm watching closely — and the biggest one is",
            "Let's get into the watchlist. First up,",
            "Now let's talk about",
            "Moving on to the next name —",
            "The story I keep coming back to this week is",
            "Quick note on",
            "And finally,",
        ];

        $segments = [];
        foreach ($mentions as $idx => $m) {
            $intro = $intros[$idx % count($intros)];
            $segments[] = [
                'timestamp' => $m['timestamp'],
                'tokens' => [
                    ['kind' => 'text', 'text' => $intro.' '],
                    ['kind' => 'mention', 'text' => $m['ticker'] ?? $m['entity']['name'], 'mentionIndex' => $idx],
                    ['kind' => 'text', 'text' => ". {$m['snippet']}"],
                ],
            ];
        }

        // Closing segment if we have any mentions.
        if ($segments !== []) {
            $segments[] = [
                'timestamp' => min($durationSeconds - 5, (int) ($durationSeconds * 0.95)),
                'tokens' => [
                    ['kind' => 'text', 'text' => "That wraps the watchlist. As always — this is not financial advice, do your own homework."],
                ],
            ];
        }

        return [
            'kind' => 'timestamped',
            'videoId' => $videoId,
            'mentions' => $mentions,
            'segments' => $segments,
        ];
    }

    /**
     * @return list<string> last 12 month keys, oldest first ('YYYY-MM')
     */
    private static function monthKeys(): array
    {
        $keys = [];
        for ($i = 11; $i >= 0; $i--) {
            $keys[] = CarbonImmutable::now()->startOfMonth()->subMonths($i)->format('Y-m');
        }

        return $keys;
    }

    /**
     * @param  list<array<string, mixed>>  $videos
     * @param  list<string>  $months
     * @return list<array{month: string, count: int}>
     */
    private static function monthlyMentions(array $videos, array $months): array
    {
        $counts = array_fill_keys($months, 0);

        foreach ($videos as $video) {
            $key = CarbonImmutable::parse($video['publishedAt'])->format('Y-m');
            if (array_key_exists($key, $counts)) {
                $counts[$key]++;
            }
        }

        $result = [];
        foreach ($months as $month) {
            $result[] = ['month' => $month, 'count' => $counts[$month]];
        }

        return $result;
    }

    /**
     * @return list<array{id: string, value: string, slug: string, type: string}>
     */
    private static function topicsFor(string $persona): array
    {
        return [
            ['id' => 'top-'.Str::slug($persona), 'value' => $persona, 'slug' => Str::slug($persona), 'type' => 'topic'],
        ];
    }

    /**
     * @return list<array{title: string, uri: string}>
     */
    private static function citationsFor(string $name): array
    {
        return [
            ['title' => "{$name} investor relations", 'uri' => 'https://example.com/'.Str::slug($name).'/ir'],
            ['title' => "{$name} latest filings", 'uri' => 'https://example.com/'.Str::slug($name).'/filings'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function tldrFor(string $name, string $type): array
    {
        $noun = $type === 'stocks' ? 'analysts' : 'founders and investors';

        return [
            'paragraph' => "Across recent YouTube coverage, {$noun} are increasingly focused on {$name}. Sentiment is mixed but the volume of mentions is climbing, suggesting {$name} is firmly on the radar right now.",
            'keyTakeaways' => [
                "Mention volume for {$name} is trending up over the last quarter.",
                'Coverage spans both dedicated finance channels and broader commentary.',
                'Sentiment is mixed, with bulls and bears both well represented.',
            ],
            'platformConsensus' => 'Cautiously optimistic',
            'citations' => self::citationsFor($name),
            'generatedAt' => CarbonImmutable::now()->subDays(2)->toIso8601String(),
        ];
    }

    private static function h(string ...$parts): int
    {
        return (int) hexdec(substr(md5(implode(':', $parts)), 0, 8));
    }
}
