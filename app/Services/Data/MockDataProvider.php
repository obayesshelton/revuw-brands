<?php

namespace App\Services\Data;

use App\Brand\Brand;
use Carbon\CarbonImmutable;

class MockDataProvider implements DataProvider
{
    public function __construct(
        private readonly EodhdNewsService $eodNews,
    ) {}

    public function trendingEntities(Brand $brand, int $limit = 12): array
    {
        $entities = MockDataset::entities($brand->entityType);
        usort($entities, fn (array $a, array $b): int => $b['mentionCount'] <=> $a['mentionCount']);

        return array_map($this->toEntitySummary(...), array_slice($entities, 0, $limit));
    }

    public function trendingChannels(Brand $brand, int $limit = 8): array
    {
        $channels = MockDataset::channels();
        usort($channels, fn (array $a, array $b): int => $b['contentsCount'] <=> $a['contentsCount']);

        return array_map(
            fn (array $c): array => $this->toChannelSummary($c, $brand),
            array_slice($channels, 0, $limit),
        );
    }

    public function entity(Brand $brand, string $slug): ?array
    {
        $entity = MockDataset::entityBySlug($brand->entityType, $slug);

        if ($entity === null) {
            return null;
        }

        return $this->toEntity($entity);
    }

    public function entityTimeline(Brand $brand, string $entityId): array
    {
        $entity = MockDataset::entityById($entityId);

        if ($entity === null) {
            return [];
        }

        $buckets = [];

        foreach ($entity['monthlyMentions'] as $point) {
            $count = (int) $point['count'];
            $date = CarbonImmutable::createFromFormat('Y-m', $point['month'])->startOfMonth();

            $buckets[] = [
                'id' => $point['month'],
                'date' => $date->format('M Y'),
                'heat' => $this->heat($count),
                'summary' => $this->timelineSummary($entity['name'], $count, $date),
                'videoCount' => $count,
                'creatorCount' => min($count, max(1, (int) ceil($count / 2))),
                'keyCreators' => $this->keyCreators($entityId, $date),
            ];
        }

        return $buckets;
    }

    public function entityTopSources(Brand $brand, string $entityId): array
    {
        $videos = MockDataset::videosForEntity($entityId);

        /** @var array<string, array<string, mixed>> $grouped */
        $grouped = [];

        foreach ($videos as $video) {
            $channelId = $video['channelId'];
            if (! isset($grouped[$channelId])) {
                $channel = MockDataset::channelById($channelId);
                $grouped[$channelId] = [
                    'id' => $channelId,
                    'name' => $channel['title'] ?? 'Unknown',
                    'handle' => $channel['handle'] ?? '',
                    'thumbnail' => $channel['thumbnailUrl'] ?? '',
                    'mentionCount' => 0,
                ];
            }
            $grouped[$channelId]['mentionCount']++;
        }

        $sources = array_values($grouped);
        usort($sources, fn (array $a, array $b): int => $b['mentionCount'] <=> $a['mentionCount']);

        return array_slice($sources, 0, 6);
    }

    public function entityVideos(Brand $brand, string $entityId, int $limit = 20): array
    {
        $entity = MockDataset::entityById($entityId);
        if ($entity === null) {
            return [];
        }

        $videos = array_map($this->toVideo(...), MockDataset::videosForEntity($entityId));

        // Live EOD news for just this entity's ticker. The service caches so
        // multiple calls within the TTL hit the local store, not the API.
        $news = $this->eodNews->videosForEntities([$entity]);

        $merged = $this->sortByPublishedDesc(array_merge($videos, $news));

        return array_slice($merged, 0, $limit);
    }

    public function transcriptForVideo(string $videoId): ?array
    {
        if (str_starts_with($videoId, 'eod-')) {
            return $this->eodNews->transcriptForVideo($videoId, MockDataset::entities());
        }

        return MockDataset::transcriptFor($videoId);
    }

    public function latestVideos(Brand $brand, int $limit = 10): array
    {
        $entities = MockDataset::entities($brand->entityType);
        $ids = [];
        foreach ($entities as $entity) {
            $ids[$entity['id']] = true;
        }

        $youtube = array_map(
            $this->toVideo(...),
            array_values(array_filter(
                MockDataset::videos(),
                fn (array $v): bool => isset($ids[$v['entityId']]),
            )),
        );

        $news = $this->eodNews->videosForEntities($entities);
        $merged = $this->sortByPublishedDesc(array_merge($youtube, $news));

        return array_slice($merged, 0, $limit);
    }

    public function latestMentions(Brand $brand, int $limit = 30): array
    {
        $entities = MockDataset::entities($brand->entityType);

        $refsById = [];
        $tickersById = [];
        foreach ($entities as $entity) {
            $refsById[$entity['id']] = [
                'name' => $entity['name'],
                'slug' => $entity['slug'],
                'type' => $entity['type'],
            ];
            $tickersById[$entity['id']] = $entity['ticker'] ?? null;
        }

        // YouTube mentions — one per video, tagged with its focal entity.
        $youtubeVideos = array_values(array_filter(
            MockDataset::videos(),
            fn (array $v): bool => isset($refsById[$v['entityId']]),
        ));

        $youtubeMentions = array_map(
            fn (array $v): array => $this->toMention(
                $v,
                $refsById[$v['entityId']],
                $tickersById[$v['entityId']] ?? null,
            ),
            $youtubeVideos,
        );

        // EOD news mentions — one row per (article × tagged entity) so a
        // wire piece that names AAPL + MSFT shows up twice, each with its
        // own ticker and price.
        $eodMentions = [];
        foreach ($this->eodNews->videosForEntities($entities) as $news) {
            foreach ($news['mentionSummary'] as $summary) {
                $eodMentions[] = $this->toMention(
                    $news,
                    $summary['entity'],
                    $summary['ticker'] ?? null,
                );
            }
        }

        $merged = $this->sortByPublishedDesc(array_merge($youtubeMentions, $eodMentions));

        return array_slice($merged, 0, $limit);
    }

    /**
     * @param  array<string, mixed>  $video
     * @param  array<string, mixed>  $entity
     * @return array<string, mixed>
     */
    private function toMention(array $video, array $entity, ?string $ticker): array
    {
        return [
            'id' => $video['id'].'-'.$entity['slug'],
            'source' => $video['source'] ?? 'youtube',
            'title' => $video['title'],
            'url' => $video['url'],
            'publishedAt' => $video['publishedAt'],
            'channel' => [
                'id' => $video['channel']['handle'],
                'name' => $video['channel']['title'],
                'handle' => $video['channel']['handle'],
                'thumbnail' => $video['channel']['thumbnailUrl'],
            ],
            'entity' => $entity,
            'ticker' => $ticker,
            'sentiment' => $video['entitySentiment'],
            'reach' => $video['platformInfo']['viewCount'] ?? 0,
        ];
    }

    public function screenEntities(Brand $brand, array $filters): array
    {
        $entities = MockDataset::entities($brand->entityType);

        $q = strtolower(trim((string) ($filters['q'] ?? '')));
        $min = $filters['minMentions'] ?? null;
        $max = $filters['maxMentions'] ?? null;
        $sort = in_array($filters['sort'] ?? '', ['mentionCount', 'name', 'contentCount'], true) ? $filters['sort'] : 'mentionCount';
        $dir = ($filters['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = max(1, (int) ($filters['perPage'] ?? 20));

        if ($q !== '') {
            $entities = array_values(array_filter($entities, fn (array $e): bool => str_contains(strtolower($e['name']), $q)));
        }
        if ($min !== null && $min !== '') {
            $entities = array_values(array_filter($entities, fn (array $e): bool => $e['mentionCount'] >= (int) $min));
        }
        if ($max !== null && $max !== '') {
            $entities = array_values(array_filter($entities, fn (array $e): bool => $e['mentionCount'] <= (int) $max));
        }

        usort($entities, function (array $a, array $b) use ($sort, $dir): int {
            $cmp = $sort === 'name'
                ? strcasecmp($a['name'], $b['name'])
                : $a[$sort] <=> $b[$sort];

            return $dir === 'asc' ? $cmp : -$cmp;
        });

        return $this->paginate(array_map($this->toEntitySummary(...), $entities), $page, $perPage);
    }

    public function channel(Brand $brand, string $handle): ?array
    {
        $channel = MockDataset::channelByHandle($handle);

        if ($channel === null) {
            return null;
        }

        return $this->toChannel($channel, $brand);
    }

    public function channelVideos(Brand $brand, string $channelId, int $limit = 20): array
    {
        $videos = MockDataset::videosForChannel($channelId);
        $videos = $this->sortByPublishedDesc($videos);

        return array_map($this->toVideo(...), array_slice($videos, 0, $limit));
    }

    public function searchChannels(Brand $brand, string $query, int $page = 1, int $perPage = 24): array
    {
        $channels = MockDataset::channels();
        $q = strtolower(trim($query));

        if ($q !== '') {
            $channels = array_values(array_filter(
                $channels,
                fn (array $c): bool => str_contains(strtolower($c['title']), $q) || str_contains(strtolower($c['handle']), $q),
            ));
        }

        usort($channels, fn (array $a, array $b): int => $b['contentsCount'] <=> $a['contentsCount']);

        $summaries = array_map(fn (array $c): array => $this->toChannelSummary($c, $brand), $channels);

        return $this->paginate($summaries, max(1, $page), max(1, $perPage));
    }

    public function search(Brand $brand, string $query, int $limit = 8): array
    {
        $q = strtolower(trim($query));

        if ($q === '') {
            return ['entities' => [], 'channels' => []];
        }

        $entities = array_values(array_filter(
            MockDataset::entities($brand->entityType),
            fn (array $e): bool => str_contains(strtolower($e['name']), $q),
        ));

        $channels = array_values(array_filter(
            MockDataset::channels(),
            fn (array $c): bool => str_contains(strtolower($c['title']), $q) || str_contains(strtolower($c['handle']), $q),
        ));

        return [
            'entities' => array_map($this->toEntitySummary(...), array_slice($entities, 0, $limit)),
            'channels' => array_map(fn (array $c): array => $this->toChannelSummary($c, $brand), array_slice($channels, 0, $limit)),
        ];
    }

    /**
     * @param  array<string, mixed>  $entity
     * @return array<string, mixed>
     */
    private function toEntitySummary(array $entity): array
    {
        return [
            'id' => $entity['id'],
            'name' => $entity['name'],
            'slug' => $entity['slug'],
            'type' => $entity['type'],
            'mentionCount' => $entity['mentionCount'],
            'contentCount' => $entity['contentCount'],
            'monthlyMentions' => $entity['monthlyMentions'],
            'ticker' => $entity['ticker'],
            'headlineStat' => $entity['headlineStat'],
        ];
    }

    /**
     * @param  array<string, mixed>  $entity
     * @return array<string, mixed>
     */
    private function toEntity(array $entity): array
    {
        return [
            ...$this->toEntitySummary($entity),
            'description' => $entity['description'],
            'hook' => $entity['hook'],
            'quickStats' => $entity['quickStats'],
            'citations' => $entity['citations'],
            'tldr' => $entity['tldr'],
        ];
    }

    /**
     * @param  array<string, mixed>  $channel
     * @return array<string, mixed>
     */
    private function toChannelSummary(array $channel, Brand $brand): array
    {
        return [
            'id' => $channel['id'],
            'title' => $channel['title'],
            'handle' => $channel['handle'],
            'thumbnailUrl' => $channel['thumbnailUrl'],
            'subscriberCount' => $channel['subscriberCount'],
            'contentsCount' => $channel['contentsCount'],
            'topEntities' => array_map(
                fn (array $e): array => [
                    'name' => $e['name'],
                    'slug' => $e['slug'],
                    'type' => $e['type'],
                ],
                array_slice($this->channelTopEntities($channel['id'], $brand), 0, 3),
            ),
        ];
    }

    /**
     * @param  array<string, mixed>  $channel
     * @return array<string, mixed>
     */
    private function toChannel(array $channel, Brand $brand): array
    {
        return [
            ...$this->toChannelSummary($channel, $brand),
            'platformProfileUrl' => $channel['platformProfileUrl'],
            'platformInfo' => $channel['platformInfo'],
            'persona' => $channel['persona'],
            'topics' => $channel['topics'],
            'topEntities' => array_slice($this->channelTopEntities($channel['id'], $brand), 0, 8),
        ];
    }

    /**
     * Entities of the brand's type mentioned by this channel, ranked by how
     * many of the channel's videos reference them.
     *
     * @return list<array<string, mixed>> EntitySummary[] with mentionCount = mentions on this channel
     */
    private function channelTopEntities(string $channelId, Brand $brand): array
    {
        $videos = MockDataset::videosForChannel($channelId);

        /** @var array<string, int> $counts */
        $counts = [];
        foreach ($videos as $video) {
            $counts[$video['entityId']] = ($counts[$video['entityId']] ?? 0) + 1;
        }

        arsort($counts);

        $entities = [];
        foreach ($counts as $entityId => $count) {
            $entity = MockDataset::entityById($entityId);
            if ($entity === null || $entity['type'] !== $brand->entityType) {
                continue;
            }
            $summary = $this->toEntitySummary($entity);
            $summary['mentionCount'] = $count;
            $entities[] = $summary;
        }

        return $entities;
    }

    /**
     * @param  array<string, mixed>  $video
     * @return array<string, mixed>
     */
    private function toVideo(array $video): array
    {
        unset($video['entityId'], $video['channelId']);

        return $video;
    }

    /**
     * @param  list<array<string, mixed>>  $videos
     * @return list<array<string, mixed>>
     */
    private function sortByPublishedDesc(array $videos): array
    {
        usort($videos, fn (array $a, array $b): int => strcmp($b['publishedAt'], $a['publishedAt']));

        return $videos;
    }

    /**
     * @param  list<array<string, mixed>>  $items
     * @return array{data: list<array<string, mixed>>, meta: array<string, int>}
     */
    private function paginate(array $items, int $page, int $perPage): array
    {
        $total = count($items);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        return [
            'data' => array_slice($items, ($page - 1) * $perPage, $perPage),
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => $lastPage,
            ],
        ];
    }

    private function heat(int $count): string
    {
        return match (true) {
            $count === 0 => 'neutral',
            $count <= 2 => 'cool',
            $count <= 4 => 'warm',
            default => 'hot',
        };
    }

    private function timelineSummary(string $name, int $count, CarbonImmutable $date): string
    {
        if ($count === 0) {
            return "No tracked mentions of {$name} in {$date->format('F Y')}.";
        }

        $word = $count === 1 ? 'video' : 'videos';

        return "{$count} {$word} covered {$name} in {$date->format('F Y')}.";
    }

    /**
     * @return list<string>
     */
    private function keyCreators(string $entityId, CarbonImmutable $date): array
    {
        $month = $date->format('Y-m');
        $names = [];

        foreach (MockDataset::videosForEntity($entityId) as $video) {
            if (CarbonImmutable::parse($video['publishedAt'])->format('Y-m') === $month) {
                $names[$video['channel']['title']] = true;
            }
        }

        return array_slice(array_keys($names), 0, 3);
    }
}
