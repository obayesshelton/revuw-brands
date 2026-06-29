<?php

namespace App\Services\Data;

use App\Brand\Brand;
use App\Brand\BrandManager;
use Carbon\CarbonImmutable;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Read-only data layer over mind-jam's shared Postgres ('mindjam' connection).
 * Returns the SAME array shapes as MockDataProvider so the frontend is
 * unchanged. Every query is a SELECT — this class never writes.
 *
 * Notes on the source data:
 * - There is no stocks/startups taxonomy; the brand maps to a curated set of
 *   `entities.type` values ($brand->types). The DTO `type` is always the
 *   brand's canonical entityType so the frontend card/page registry works.
 * - Entities carry no ticker, so `ticker` is almost always null and price
 *   degrades to a headline stat (valuation) from metadata.quickStats.
 * - "Visible" content = published_at IS NOT NULL AND summary IS NOT NULL.
 */
class DatabaseDataProvider implements DataProvider
{
    public function __construct(
        private readonly EodhdNewsService $eodNews,
    ) {}

    private function db(): ConnectionInterface
    {
        return DB::connection('mindjam');
    }

    /**
     * Allowed YouTube handles (lowercased) — when non-empty, every query
     * that touches `channels` is scoped to these. Stored in `services.data
     * .youtube_handles` (see config/services.php). Lowercased here so
     * `whereIn` against `LOWER(platform_profile_url)` is case-insensitive.
     *
     * @return list<string>
     */
    private function allowedHandles(): array
    {
        /** @var list<string> $configured */
        $configured = config('services.data.youtube_handles', []);

        return array_map('strtolower', $configured);
    }

    /**
     * Add the channel-handle allowlist filter to any query that joins or
     * selects from `channels`. `$alias` is the channel-table alias used in
     * the query (defaults to `ch`).
     */
    private function withAllowedChannels(Builder $q, string $alias = 'ch'): Builder
    {
        $handles = $this->allowedHandles();

        if ($handles === []) {
            return $q;
        }

        return $q->whereIn(DB::raw('lower('.$alias.'.platform_profile_url)'), $handles);
    }

    public function trendingEntities(Brand $brand, int $limit = 12): array
    {
        return $this->remember("trending-entities:{$brand->key}:{$limit}", function () use ($brand, $limit): array {
            $rows = $this->visibleEntityMentions($brand)
                ->groupBy('e.id', 'e.name', 'e.slug')
                ->orderByRaw('count(*) desc')
                ->limit($limit)
                ->get(['e.id', 'e.name', 'e.slug', DB::raw('count(*) as mc')]);

            return $this->buildSummaries($brand, $rows->all());
        });
    }

    public function trendingChannels(Brand $brand, int $limit = 8): array
    {
        return $this->remember("trending-channels:{$brand->key}:{$limit}", function () use ($brand, $limit): array {
            $rows = $this->channelsWithContentCount()
                ->orderByRaw('count(cc.id) desc')
                ->limit($limit)
                ->get(['ch.id', 'ch.title', 'ch.platform_profile_url', 'ch.platform_info', DB::raw('count(cc.id) as ccount')]);

            $topMap = $this->topEntitiesForChannels($brand, array_map(fn ($r) => (int) $r->id, $rows->all()), 3);

            return array_map(fn ($r) => $this->channelSummary($brand, $r, $topMap[(int) $r->id] ?? []), $rows->all());
        });
    }

    public function latestVideos(Brand $brand, int $limit = 10): array
    {
        return $this->remember("latest-videos:{$brand->key}:{$limit}", function () use ($brand, $limit): array {
            $base = $this->db()->table('channel_contents as cc')
                ->join('channels as ch', 'ch.id', '=', 'cc.channel_id');

            $rows = $this->withAllowedChannels($base)
                ->whereNotNull('cc.published_at')
                ->whereNotNull('cc.summary')
                ->whereExists(function (Builder $q) use ($brand): void {
                    $q->select(DB::raw(1))
                        ->from('channel_content_entity as cce')
                        ->join('entities as e', 'e.id', '=', 'cce.entity_id')
                        ->whereColumn('cce.channel_content_id', 'cc.id')
                        ->whereIn('e.type', $brand->types);
                })
                ->orderByDesc('cc.published_at')
                ->limit($limit)
                ->get($this->videoColumns());

            $videos = array_map(fn ($r) => $this->video($r), $rows->all());

            $newsEntities = $this->newsEntitiesForBrand($brand);

            if ($newsEntities !== []) {
                $news = $this->eodNews->videosForEntities($newsEntities);
                $videos = $this->sortByPublishedDesc(array_merge($videos, $news));
            }

            return array_slice($videos, 0, $limit);
        });
    }

    public function latestMentions(Brand $brand, int $limit = 30): array
    {
        return $this->remember("latest-mentions:{$brand->key}:{$limit}", function () use ($brand, $limit): array {
            $base = $this->db()->table('channel_content_entity as cce')
                ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
                ->join('channels as ch', 'ch.id', '=', 'cc.channel_id')
                ->join('entities as e', 'e.id', '=', 'cce.entity_id');

            $rows = $this->withAllowedChannels($base)
                ->whereIn('e.type', $brand->types)
                ->whereNotNull('cc.published_at')
                ->whereNotNull('cc.summary')
                ->whereNull('ch.deleted_at')
                ->orderByDesc('cc.published_at')
                ->limit($limit)
                ->get([
                    'cc.id as cc_id',
                    'cc.title as cc_title',
                    'cc.platform_content_url as cc_url',
                    'cc.published_at as cc_published_at',
                    'cc.platform_info as cc_platform_info',
                    'ch.id as ch_id',
                    'ch.title as ch_title',
                    'ch.platform_profile_url as ch_handle',
                    'ch.platform_info as ch_info',
                    'e.id as e_id',
                    'e.name as e_name',
                    'e.slug as e_slug',
                    // `entities` has no ticker column — derived from metadata
                    // by tickerFor when we hydrate the Mention row.
                    'e.metadata as e_metadata',
                    'cce.sentiment as cce_sentiment',
                ]);

            $youtubeMentions = array_map(
                fn ($r): array => $this->mention($brand, $r),
                $rows->all(),
            );

            // One Mention row per (EOD article × tagged entity).
            $eodMentions = [];
            $newsEntities = $this->newsEntitiesForBrand($brand);

            if ($newsEntities !== []) {
                foreach ($this->eodNews->videosForEntities($newsEntities) as $news) {
                    foreach ($news['mentionSummary'] as $summary) {
                        $eodMentions[] = $this->newsToMention($news, $summary);
                    }
                }
            }

            $merged = $this->sortByPublishedDesc(array_merge($youtubeMentions, $eodMentions));

            return array_slice($merged, 0, $limit);
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function mention(Brand $brand, object $row): array
    {
        $pi = $this->decode($row->cc_platform_info ?? null);
        $chInfo = $this->decode($row->ch_info ?? null);
        $meta = $this->decode($row->e_metadata ?? null);
        $quickStats = is_array($meta['quickStats'] ?? null) ? $meta['quickStats'] : [];

        return [
            'id' => "{$row->cc_id}-{$row->e_id}",
            'source' => 'youtube',
            'title' => (string) $row->cc_title,
            'url' => (string) $row->cc_url,
            'publishedAt' => $row->cc_published_at
                ? CarbonImmutable::parse($row->cc_published_at)->toIso8601String()
                : '',
            'channel' => [
                'id' => (string) $row->ch_id,
                'name' => (string) $row->ch_title,
                'handle' => (string) $row->ch_handle,
                'thumbnail' => $this->channelThumb($chInfo),
            ],
            'entity' => [
                'name' => (string) $row->e_name,
                'slug' => (string) $row->e_slug,
                'type' => $brand->entityType,
            ],
            'ticker' => $this->tickerFor($brand, (string) $row->e_name, $quickStats),
            'sentiment' => $this->sentiment($row->cce_sentiment ?? null),
            'reach' => (int) ($pi['view_count'] ?? 0),
        ];
    }

    public function entity(Brand $brand, string $slug): ?array
    {
        $row = $this->db()->table('entities')
            ->where('slug', $slug)
            ->whereIn('type', $brand->types)
            ->first();

        if ($row === null) {
            return null;
        }

        $count = $this->mentionCount((int) $row->id);
        $metadata = $this->decode($row->metadata ?? null);
        $quickStats = is_array($metadata['quickStats'] ?? null) ? $metadata['quickStats'] : [];

        return [
            'id' => (string) $row->id,
            'name' => $row->name,
            'slug' => $row->slug,
            'type' => $brand->entityType,
            'mentionCount' => $count,
            'contentCount' => $count,
            'monthlyMentions' => $this->monthlyMentionsFor([(int) $row->id])[(int) $row->id] ?? $this->zeroMonths(),
            'ticker' => $this->tickerFor($brand, (string) $row->name, $quickStats),
            'headlineStat' => $this->headlineStat($quickStats),
            'description' => (string) ($row->description ?? ''),
            'hook' => (string) ($metadata['hook'] ?? ''),
            'quickStats' => $this->quickStatsList($quickStats),
            'citations' => $this->citationList($this->decode($row->citations ?? null)),
            'tldr' => $this->tldrFor((int) $row->id, $brand),
        ];
    }

    public function entityTimeline(Brand $brand, string $entityId): array
    {
        $since = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        $base = $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id');

        $rows = $this->withAllowedChannels($base)
            ->where('cce.entity_id', (int) $entityId)
            ->whereNotNull('cc.summary')
            ->where('cc.published_at', '>=', $since)
            ->groupBy(DB::raw("to_char(date_trunc('month', cc.published_at), 'YYYY-MM')"), 'ch.title')
            ->get([
                DB::raw("to_char(date_trunc('month', cc.published_at), 'YYYY-MM') as ym"),
                'ch.title as title',
                DB::raw('count(*) as n'),
            ]);

        /** @var array<string, array{count: int, creators: array<string, int>}> $byMonth */
        $byMonth = [];
        foreach ($rows as $r) {
            $byMonth[$r->ym]['count'] = ($byMonth[$r->ym]['count'] ?? 0) + (int) $r->n;
            $byMonth[$r->ym]['creators'][$r->title] = ($byMonth[$r->ym]['creators'][$r->title] ?? 0) + (int) $r->n;
        }

        $buckets = [];
        foreach ($this->monthKeys() as $month) {
            $count = $byMonth[$month]['count'] ?? 0;
            $creators = $byMonth[$month]['creators'] ?? [];
            arsort($creators);
            $date = CarbonImmutable::createFromFormat('Y-m', $month)->startOfMonth();

            $buckets[] = [
                'id' => $month,
                'date' => $date->format('M Y'),
                'heat' => $this->heat($count),
                'summary' => $count === 0
                    ? "No tracked mentions in {$date->format('F Y')}."
                    : "{$count} ".($count === 1 ? 'video' : 'videos')." in {$date->format('F Y')}.",
                'videoCount' => $count,
                'creatorCount' => count($creators),
                'keyCreators' => array_slice(array_keys($creators), 0, 3),
            ];
        }

        return $buckets;
    }

    public function entityTopSources(Brand $brand, string $entityId): array
    {
        $base = $this->db()->table('channels as ch')
            ->join('channel_contents as cc', 'cc.channel_id', '=', 'ch.id')
            ->join('channel_content_entity as cce', 'cce.channel_content_id', '=', 'cc.id');

        $rows = $this->withAllowedChannels($base)
            ->where('cce.entity_id', (int) $entityId)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary')
            ->whereNull('ch.deleted_at')
            ->groupBy('ch.id')
            ->orderByRaw('count(distinct cce.channel_content_id) desc')
            ->limit(6)
            ->get(['ch.id', 'ch.title', 'ch.platform_profile_url', 'ch.platform_info', DB::raw('count(distinct cce.channel_content_id) as mc')]);

        return array_map(fn ($r) => [
            'id' => (string) $r->id,
            'name' => $r->title,
            'handle' => (string) $r->platform_profile_url,
            'thumbnail' => $this->channelThumb($this->decode($r->platform_info)),
            'mentionCount' => (int) $r->mc,
        ], $rows->all());
    }

    public function entityVideos(Brand $brand, string $entityId, int $limit = 20): array
    {
        $base = $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id');

        $rows = $this->withAllowedChannels($base)
            ->where('cce.entity_id', (int) $entityId)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary')
            ->orderByDesc('cc.published_at')
            ->limit($limit)
            ->get(array_merge($this->videoColumns(), ['cce.sentiment', 'cce.timestamp_start']));

        $videos = array_map(
            fn ($r) => $this->video($r, $this->sentiment($r->sentiment), $r->timestamp_start !== null ? (int) $r->timestamp_start : null),
            $rows->all(),
        );

        // Merge live EOD News for this entity's ticker. The news service
        // caches per ticker for 6h, so this is a no-op after first warmup.
        $newsEntity = $this->newsEntityFor($brand, $entityId);

        if ($newsEntity !== null) {
            $news = $this->eodNews->videosForEntities([$newsEntity]);
            $videos = $this->sortByPublishedDesc(array_merge($videos, $news));
        }

        return array_slice($videos, 0, $limit);
    }

    public function screenEntities(Brand $brand, array $filters): array
    {
        $q = strtolower(trim((string) ($filters['q'] ?? '')));
        $min = $filters['minMentions'] ?? null;
        $sort = in_array($filters['sort'] ?? '', ['mentionCount', 'name', 'contentCount'], true) ? $filters['sort'] : 'mentionCount';
        $dir = ($filters['dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = max(1, (int) ($filters['perPage'] ?? 12));

        $base = fn (): Builder => $this->visibleEntityMentions($brand)
            ->when($q !== '', fn (Builder $x) => $x->whereRaw('lower(e.name) like ?', ['%'.$q.'%']));

        $grouped = $base()->groupBy('e.id', 'e.name', 'e.slug');

        if ($min !== null && $min !== '') {
            $grouped->havingRaw('count(*) >= ?', [(int) $min]);
        }

        $total = (int) $this->db()->table((clone $grouped)->select('e.id', DB::raw('count(*) as mc')), 'sub')->count();

        $orderExpr = $sort === 'name' ? 'e.name' : DB::raw('count(*)');
        $rows = (clone $grouped)
            ->orderBy($orderExpr, $dir)
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->get(['e.id', 'e.name', 'e.slug', DB::raw('count(*) as mc')]);

        return [
            'data' => $this->buildSummaries($brand, $rows->all()),
            'meta' => [
                'page' => $page,
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => max(1, (int) ceil($total / $perPage)),
            ],
        ];
    }

    public function channel(Brand $brand, string $handle): ?array
    {
        $row = $this->withAllowedChannels(
            $this->db()->table('channels as ch'),
        )
            ->where('ch.platform_profile_url', '@'.ltrim($handle, '@'))
            ->whereNull('ch.deleted_at')
            ->first();

        if ($row === null) {
            return null;
        }

        $pi = $this->decode($row->platform_info);

        $contentsCount = (int) $this->db()->table('channel_contents')
            ->where('channel_id', $row->id)
            ->whereNotNull('published_at')
            ->whereNotNull('summary')
            ->count();

        $entityRows = $this->visibleEntityMentions($brand)
            ->where('cc.channel_id', $row->id)
            ->groupBy('e.id', 'e.name', 'e.slug')
            ->orderByRaw('count(*) desc')
            ->limit(8)
            ->get(['e.id', 'e.name', 'e.slug', DB::raw('count(*) as mc')]);

        $persona = $row->persona_id !== null
            ? $this->db()->table('personas')->where('id', $row->persona_id)->value('name')
            : null;

        $topics = $this->db()->table('topics as t')
            ->join('channel_topic as ct', 'ct.topic_id', '=', 't.id')
            ->where('ct.channel_id', $row->id)
            ->limit(8)
            ->get(['t.id', 't.name', 't.slug']);

        return [
            'id' => (string) $row->id,
            'title' => $row->title,
            'handle' => (string) $row->platform_profile_url,
            'thumbnailUrl' => $this->channelThumb($pi),
            'subscriberCount' => (int) ($pi['subscriber_count'] ?? 0),
            'contentsCount' => $contentsCount,
            'topEntities' => $this->buildSummaries($brand, $entityRows->all()),
            'platformProfileUrl' => 'https://youtube.com/'.ltrim((string) $row->platform_profile_url, '@'),
            'platformInfo' => [
                'description' => (string) ($pi['description'] ?? ''),
                'subscriberCount' => (int) ($pi['subscriber_count'] ?? 0),
                'videoCount' => (int) ($pi['video_count'] ?? 0),
                'viewCount' => (int) ($pi['view_count'] ?? 0),
                'country' => (string) ($pi['country'] ?? '—'),
                'publishedAt' => (string) ($pi['published_at'] ?? ''),
            ],
            'persona' => $persona !== null ? (string) $persona : null,
            'topics' => $topics->map(fn ($t) => [
                'id' => (string) $t->id,
                'value' => $t->name,
                'slug' => $t->slug,
                'type' => 'topic',
            ])->all(),
        ];
    }

    public function channelVideos(Brand $brand, string $channelId, int $limit = 20): array
    {
        $base = $this->db()->table('channel_contents as cc')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id');

        $rows = $this->withAllowedChannels($base)
            ->where('cc.channel_id', (int) $channelId)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary')
            ->orderByDesc('cc.published_at')
            ->limit($limit)
            ->get($this->videoColumns());

        return array_map(fn ($r) => $this->video($r), $rows->all());
    }

    public function searchChannels(Brand $brand, string $query, int $page = 1, int $perPage = 24): array
    {
        $q = trim($query);
        $page = max(1, $page);
        $perPage = max(1, $perPage);

        $filtered = fn (Builder $x): Builder => $x->when($q !== '', fn (Builder $w) => $w->where(fn (Builder $g) => $g
            ->whereRaw('lower(ch.title) like ?', ['%'.strtolower($q).'%'])
            ->orWhereRaw('lower(ch.platform_profile_url) like ?', ['%'.strtolower($q).'%'])));

        $total = (int) $filtered(
            $this->withAllowedChannels(
                $this->db()->table('channels as ch')
            )
                ->whereNull('ch.deleted_at')
                ->whereExists(fn (Builder $q) => $q->select(DB::raw(1))
                    ->from('channel_contents as cc')
                    ->whereColumn('cc.channel_id', 'ch.id')
                    ->whereNotNull('cc.published_at')
                    ->whereNotNull('cc.summary'))
        )->count();

        $rows = $filtered($this->channelsWithContentCount())
            ->orderByRaw('count(cc.id) desc')
            ->limit($perPage)
            ->offset(($page - 1) * $perPage)
            ->get(['ch.id', 'ch.title', 'ch.platform_profile_url', 'ch.platform_info', DB::raw('count(cc.id) as ccount')]);

        $topMap = $this->topEntitiesForChannels($brand, array_map(fn ($r) => (int) $r->id, $rows->all()), 3);
        $lastPage = max(1, (int) ceil($total / $perPage));

        return [
            'data' => array_map(fn ($r) => $this->channelSummary($brand, $r, $topMap[(int) $r->id] ?? []), $rows->all()),
            'meta' => [
                'page' => min($page, $lastPage),
                'perPage' => $perPage,
                'total' => $total,
                'lastPage' => $lastPage,
            ],
        ];
    }

    public function search(Brand $brand, string $query, int $limit = 8): array
    {
        $q = strtolower(trim($query));

        if ($q === '') {
            return ['entities' => [], 'channels' => []];
        }

        $entityRows = $this->visibleEntityMentions($brand)
            ->whereRaw('lower(e.name) like ?', ['%'.$q.'%'])
            ->groupBy('e.id', 'e.name', 'e.slug')
            ->orderByRaw('count(*) desc')
            ->limit($limit)
            ->get(['e.id', 'e.name', 'e.slug', DB::raw('count(*) as mc')]);

        $channelRows = $this->channelsWithContentCount()
            ->whereRaw('lower(ch.title) like ?', ['%'.$q.'%'])
            ->orderByRaw('count(cc.id) desc')
            ->limit($limit)
            ->get(['ch.id', 'ch.title', 'ch.platform_profile_url', 'ch.platform_info', DB::raw('count(cc.id) as ccount')]);

        $topMap = $this->topEntitiesForChannels($brand, array_map(fn ($r) => (int) $r->id, $channelRows->all()), 3);

        return [
            'entities' => $this->buildSummaries($brand, $entityRows->all()),
            'channels' => array_map(fn ($r) => $this->channelSummary($brand, $r, $topMap[(int) $r->id] ?? []), $channelRows->all()),
        ];
    }

    // --- Shared query fragments -------------------------------------------

    /** Entities of the brand's type joined to their visible mentions. */
    private function visibleEntityMentions(Brand $brand): Builder
    {
        return $this->db()->table('entities as e')
            ->join('channel_content_entity as cce', 'e.id', '=', 'cce.entity_id')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->whereIn('e.type', $brand->types)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary');
    }

    private function channelsWithContentCount(): Builder
    {
        $q = $this->db()->table('channels as ch')
            ->join('channel_contents as cc', function ($join): void {
                $join->on('cc.channel_id', '=', 'ch.id')
                    ->whereNotNull('cc.published_at')
                    ->whereNotNull('cc.summary');
            })
            ->whereNull('ch.deleted_at')
            // Group by the PK only — Postgres can't GROUP BY the json
            // platform_info column, and the others are functionally dependent.
            ->groupBy('ch.id');

        return $this->withAllowedChannels($q);
    }

    /**
     * @return list<string>
     */
    private function videoColumns(): array
    {
        return [
            'cc.id', 'cc.title', 'cc.generated_title', 'cc.platform_content_url',
            'cc.platform_content_uuid', 'cc.platform_info', 'cc.summary', 'cc.tldr',
            'cc.email_summary', 'cc.published_at',
            'ch.title as ch_title', 'ch.platform_profile_url as ch_url', 'ch.platform_info as ch_info',
        ];
    }

    // --- Builders ---------------------------------------------------------

    /**
     * @param  list<object>  $rows  each with ->id, ->name, ->slug, ->mc
     * @return list<array<string, mixed>>
     */
    private function buildSummaries(Brand $brand, array $rows): array
    {
        if ($rows === []) {
            return [];
        }

        $ids = array_map(fn ($r) => (int) $r->id, $rows);
        $metadata = $this->db()->table('entities')->whereIn('id', $ids)->pluck('metadata', 'id');
        $monthly = $this->monthlyMentionsFor($ids);

        return array_map(function ($r) use ($brand, $metadata, $monthly): array {
            $meta = $this->decode($metadata[$r->id] ?? null);
            $quickStats = is_array($meta['quickStats'] ?? null) ? $meta['quickStats'] : [];

            return [
                'id' => (string) $r->id,
                'name' => $r->name,
                'slug' => $r->slug,
                'type' => $brand->entityType,
                'mentionCount' => (int) $r->mc,
                'contentCount' => (int) $r->mc,
                'monthlyMentions' => $monthly[(int) $r->id] ?? $this->zeroMonths(),
                'ticker' => $this->tickerFor($brand, (string) $r->name, $quickStats),
                'headlineStat' => $this->headlineStat($quickStats),
            ];
        }, $rows);
    }

    /**
     * @param  array<string, mixed>  $topEntities
     * @return array<string, mixed>
     */
    private function channelSummary(Brand $brand, object $row, array $topEntities): array
    {
        $pi = $this->decode($row->platform_info);

        return [
            'id' => (string) $row->id,
            'title' => $row->title,
            'handle' => (string) $row->platform_profile_url,
            'thumbnailUrl' => $this->channelThumb($pi),
            'subscriberCount' => (int) ($pi['subscriber_count'] ?? 0),
            'contentsCount' => (int) ($row->ccount ?? 0),
            'topEntities' => $topEntities,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function video(object $row, ?string $sentiment = null, ?int $timestampStart = null): array
    {
        $pi = $this->decode($row->platform_info);
        $chInfo = $this->decode($row->ch_info);
        $uuid = (string) $row->platform_content_uuid;

        return [
            'id' => (string) $row->id,
            'source' => 'youtube', // TODO: derive from channel_contents.source once EOD/news lands
            'platformContentUuid' => $uuid,
            'title' => (string) $row->title,
            'generatedTitle' => (string) ($row->generated_title ?: $row->title),
            'url' => (string) $row->platform_content_url,
            'articleUrl' => (string) $row->platform_content_url,
            'summary' => (string) ($row->summary ?? ''),
            'tldr' => (string) ($row->tldr ?: ($row->email_summary ?? '')),
            'thumbnail' => $this->contentThumb($pi, $uuid),
            'publishedAt' => $row->published_at ? CarbonImmutable::parse($row->published_at)->toIso8601String() : '',
            'readDuration' => $this->readDuration($row->summary),
            'citations' => [],
            'platformInfo' => [
                'duration' => $this->durationSeconds($pi),
                'viewCount' => (int) ($pi['view_count'] ?? 0),
                'likeCount' => (int) ($pi['like_count'] ?? 0),
                'commentCount' => (int) ($pi['comment_count'] ?? 0),
            ],
            'entitySentiment' => $sentiment,
            'entityTimestampStart' => $timestampStart,
            'channel' => [
                'title' => (string) $row->ch_title,
                'handle' => (string) $row->ch_url,
                'thumbnailUrl' => $this->channelThumb($chInfo),
            ],
            'mentionSummary' => [], // TODO: wire from extraction pipeline
        ];
    }

    public function transcriptForVideo(string $videoId): ?array
    {
        if (str_starts_with($videoId, 'eod-')) {
            // EOD news only applies to stocks-type entities; use a stocks
            // Brand so newsEntitiesForBrand resolves the same tickers the
            // listing endpoints used to fetch this article.
            $stocks = app(BrandManager::class)->make('stocks');

            return $this->eodNews->transcriptForVideo(
                $videoId,
                $this->newsEntitiesForBrand($stocks),
            );
        }

        // TODO: wire from extraction pipeline. Until then YouTube videos
        // degrade to a "transcript not available yet" inline message.
        return null;
    }

    // --- EOD News integration --------------------------------------------

    /**
     * Minimal entity descriptor for EodhdNewsService — needs name, slug, type,
     * ticker. Returns null when the entity isn't found or has no ticker.
     *
     * @return array{name: string, slug: string, type: string, ticker: string}|null
     */
    private function newsEntityFor(Brand $brand, string $entityId): ?array
    {
        $row = $this->db()->table('entities')
            ->where('id', (int) $entityId)
            ->whereIn('type', $brand->types)
            ->first(['name', 'slug', 'metadata']);

        if ($row === null) {
            return null;
        }

        $meta = $this->decode($row->metadata ?? null);
        $quickStats = is_array($meta['quickStats'] ?? null) ? $meta['quickStats'] : [];
        $ticker = $this->tickerFor($brand, (string) $row->name, $quickStats);

        if ($ticker === null) {
            return null;
        }

        return [
            'name' => (string) $row->name,
            'slug' => (string) $row->slug,
            'type' => $brand->entityType,
            'ticker' => $ticker,
        ];
    }

    /**
     * Top-N brand-typed entities by mention count that resolve to a ticker.
     * Capped because fanning EODHD news fetches across every tickered entity
     * in production (79+) was a ~60s cold load — capping at the trending
     * head matches what users actually look at and keeps cold load < 10s.
     * Result cached for 10 min; EodhdNewsService caches per ticker on its
     * own (6h).
     *
     * @return list<array{name: string, slug: string, type: string, ticker: string}>
     */
    private function newsEntitiesForBrand(Brand $brand, int $cap = 12): array
    {
        if (! $brand->hasPrice()) {
            return [];
        }

        return $this->remember("news-entities:{$brand->key}:{$cap}", function () use ($brand, $cap): array {
            $rows = $this->visibleEntityMentions($brand)
                ->groupBy('e.id', 'e.name', 'e.slug')
                ->orderByRaw('count(*) desc')
                ->limit($cap)
                ->get(['e.id', 'e.name', 'e.slug']);

            if ($rows->isEmpty()) {
                return [];
            }

            $ids = array_map(fn ($r) => (int) $r->id, $rows->all());
            $metadata = $this->db()->table('entities')->whereIn('id', $ids)->pluck('metadata', 'id');

            $entities = [];

            foreach ($rows as $row) {
                $meta = $this->decode($metadata[$row->id] ?? null);
                $quickStats = is_array($meta['quickStats'] ?? null) ? $meta['quickStats'] : [];
                $ticker = $this->tickerFor($brand, (string) $row->name, $quickStats);

                if ($ticker === null || ! $this->looksLikeTicker($ticker)) {
                    continue;
                }

                $entities[] = [
                    'name' => (string) $row->name,
                    'slug' => (string) $row->slug,
                    'type' => $brand->entityType,
                    'ticker' => $ticker,
                ];
            }

            return $entities;
        });
    }

    /**
     * Cheap sanity check before we burn an EODHD call on a ticker. mind-jam's
     * metadata can carry stray free-text values in the `ticker` slot (e.g.
     * "The Donkey"); EODHD format is SYMBOL.EXCHANGE.
     */
    private function looksLikeTicker(string $ticker): bool
    {
        return preg_match('/^[A-Z][A-Z0-9.\-]{0,11}$/', $ticker) === 1;
    }

    /**
     * Sort any array of Video- or Mention-shaped items newest first.
     *
     * @param  list<array<string, mixed>>  $items
     * @return list<array<string, mixed>>
     */
    private function sortByPublishedDesc(array $items): array
    {
        usort(
            $items,
            fn (array $a, array $b): int => strcmp(
                (string) ($b['publishedAt'] ?? ''),
                (string) ($a['publishedAt'] ?? ''),
            ),
        );

        return $items;
    }

    /**
     * Flatten an EOD news Video + a single mentionSummary entry into a
     * Mention row, mirroring MockDataProvider::toMention so the frontend
     * MentionsTable renders both sources identically.
     *
     * @param  array<string, mixed>  $news
     * @param  array<string, mixed>  $summary
     * @return array<string, mixed>
     */
    private function newsToMention(array $news, array $summary): array
    {
        return [
            'id' => $news['id'].'-'.($summary['entity']['slug'] ?? ''),
            'source' => 'eod_news',
            'title' => (string) $news['title'],
            'url' => (string) $news['url'],
            'publishedAt' => (string) $news['publishedAt'],
            'channel' => [
                'id' => (string) $news['channel']['handle'],
                'name' => (string) $news['channel']['title'],
                'handle' => (string) $news['channel']['handle'],
                'thumbnail' => (string) $news['channel']['thumbnailUrl'],
            ],
            'entity' => $summary['entity'],
            'ticker' => $summary['ticker'] ?? null,
            'sentiment' => $news['entitySentiment'] ?? null,
            'reach' => 0,
        ];
    }

    // --- Entity helpers ---------------------------------------------------

    private function mentionCount(int $entityId): int
    {
        return (int) $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->where('cce.entity_id', $entityId)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary')
            ->count();
    }

    /**
     * @param  list<int>  $ids
     * @return array<int, list<array{month: string, count: int}>>
     */
    private function monthlyMentionsFor(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $since = CarbonImmutable::now()->startOfMonth()->subMonths(11);

        $rows = $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->whereIn('cce.entity_id', $ids)
            ->whereNotNull('cc.summary')
            ->where('cc.published_at', '>=', $since)
            ->groupBy('cce.entity_id', DB::raw("to_char(date_trunc('month', cc.published_at), 'YYYY-MM')"))
            ->get([
                'cce.entity_id',
                DB::raw("to_char(date_trunc('month', cc.published_at), 'YYYY-MM') as ym"),
                DB::raw('count(*) as n'),
            ]);

        /** @var array<int, array<string, int>> $counts */
        $counts = [];
        foreach ($rows as $r) {
            $counts[(int) $r->entity_id][$r->ym] = (int) $r->n;
        }

        $months = $this->monthKeys();
        $result = [];
        foreach ($ids as $id) {
            $result[$id] = array_map(fn (string $m): array => [
                'month' => $m,
                'count' => $counts[$id][$m] ?? 0,
            ], $months);
        }

        return $result;
    }

    /**
     * Top entities (of the brand's type) per channel, in a single windowed query.
     *
     * @param  list<int>  $channelIds
     * @return array<int, list<array{name: string, slug: string, type: string}>>
     */
    private function topEntitiesForChannels(Brand $brand, array $channelIds, int $per): array
    {
        if ($channelIds === [] || $brand->types === []) {
            return [];
        }

        $chIn = implode(',', array_fill(0, count($channelIds), '?'));
        $typeIn = implode(',', array_fill(0, count($brand->types), '?'));

        $sql = "select sub.channel_id, e.name, e.slug from (
            select cc.channel_id, cce.entity_id,
                row_number() over (partition by cc.channel_id order by count(*) desc) as rn
            from channel_content_entity cce
            join channel_contents cc on cce.channel_content_id = cc.id
            join entities e2 on e2.id = cce.entity_id
            where cc.channel_id in ($chIn)
                and cc.published_at is not null and cc.summary is not null
                and e2.type in ($typeIn)
            group by cc.channel_id, cce.entity_id
        ) sub
        join entities e on e.id = sub.entity_id
        where sub.rn <= ?
        order by sub.channel_id, sub.rn";

        $bindings = array_merge(array_map('intval', $channelIds), $brand->types, [$per]);
        $rows = $this->db()->select($sql, $bindings);

        $map = [];
        foreach ($rows as $r) {
            $map[(int) $r->channel_id][] = [
                'name' => $r->name,
                'slug' => $r->slug,
                'type' => $brand->entityType,
            ];
        }

        return $map;
    }

    /**
     * Well-known public companies → EODHD tickers. Applied only to the stocks
     * brand (mind-jam stores no tickers), so the share-price chart can render
     * for recognisable names; everything else degrades to a valuation stat.
     *
     * @var array<string, string>
     */
    private const TICKERS = [
        'apple' => 'AAPL.US', 'microsoft' => 'MSFT.US', 'nvidia' => 'NVDA.US',
        'amazon' => 'AMZN.US', 'google' => 'GOOGL.US', 'alphabet' => 'GOOGL.US',
        'meta' => 'META.US', 'meta platforms' => 'META.US', 'facebook' => 'META.US',
        'tesla' => 'TSLA.US', 'netflix' => 'NFLX.US', 'amd' => 'AMD.US',
        'intel' => 'INTC.US', 'palantir' => 'PLTR.US', 'coinbase' => 'COIN.US',
        'shopify' => 'SHOP.US', 'uber' => 'UBER.US', 'airbnb' => 'ABNB.US',
        'spotify' => 'SPOT.US', 'paypal' => 'PYPL.US', 'salesforce' => 'CRM.US',
        'oracle' => 'ORCL.US', 'adobe' => 'ADBE.US', 'disney' => 'DIS.US',
        'walmart' => 'WMT.US', 'jpmorgan' => 'JPM.US', 'morgan stanley' => 'MS.US',
        'goldman sachs' => 'GS.US', 'broadcom' => 'AVGO.US', 'qualcomm' => 'QCOM.US',
        'micron' => 'MU.US', 'arm' => 'ARM.US', 'snowflake' => 'SNOW.US',
        'robinhood' => 'HOOD.US', 'ford' => 'F.US', 'boeing' => 'BA.US',
        'starbucks' => 'SBUX.US', 'nike' => 'NKE.US', 'visa' => 'V.US',
        'mastercard' => 'MA.US', 'exxon mobil' => 'XOM.US', 'chevron' => 'CVX.US',
    ];

    /**
     * @param  array<string, mixed>  $quickStats
     */
    private function tickerFor(Brand $brand, string $name, array $quickStats): ?string
    {
        if (! $brand->hasPrice()) {
            return null;
        }

        foreach (['ticker', 'Ticker', 'symbol', 'Symbol'] as $key) {
            if (! empty($quickStats[$key]) && is_scalar($quickStats[$key])) {
                return (string) $quickStats[$key];
            }
        }

        return self::TICKERS[strtolower(trim($name))] ?? null;
    }

    /**
     * @param  array<string, mixed>  $quickStats
     * @return array{label: string, value: string}|null
     */
    private function headlineStat(array $quickStats): ?array
    {
        foreach (['valuation', 'marketCap', 'market_cap', 'revenue', 'aum', 'industry', 'founded'] as $key) {
            if (! empty($quickStats[$key]) && is_scalar($quickStats[$key])) {
                return ['label' => Str::headline($key), 'value' => (string) $quickStats[$key]];
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $quickStats
     * @return list<array{label: string, value: string}>
     */
    private function quickStatsList(array $quickStats): array
    {
        $out = [];
        foreach ($quickStats as $key => $value) {
            if (is_scalar($value) && (string) $value !== '') {
                $out[] = ['label' => Str::headline((string) $key), 'value' => (string) $value];
            }
        }

        return array_slice($out, 0, 8);
    }

    /**
     * @param  array<int, mixed>  $citations
     * @return list<array{title: string, uri: string}>
     */
    private function citationList(array $citations): array
    {
        $out = [];
        foreach ($citations as $citation) {
            if (is_array($citation) && isset($citation['title'], $citation['uri'])) {
                $out[] = ['title' => (string) $citation['title'], 'uri' => (string) $citation['uri']];
            }
        }

        return $out;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function tldrFor(int $entityId, Brand $brand): ?array
    {
        $row = $this->db()->table('tldrs')
            ->where('summarizable_type', 'App\\Models\\Entity')
            ->where('summarizable_id', $entityId)
            ->orderByRaw("case when context = ? then 0 when context = 'all' then 1 else 2 end", [$brand->tldrContext])
            ->first();

        if ($row === null) {
            return null;
        }

        $takeaways = $this->decode($row->key_takeaways ?? null);

        return [
            'paragraph' => (string) $row->tldr_paragraph,
            'keyTakeaways' => array_values(array_filter(array_map(fn ($t) => is_scalar($t) ? (string) $t : null, $takeaways))),
            'platformConsensus' => $row->platform_consensus !== null ? (string) $row->platform_consensus : null,
            'citations' => $this->citationList($this->decode($row->citations ?? null)),
            'generatedAt' => $row->generated_at ? CarbonImmutable::parse($row->generated_at)->toIso8601String() : '',
        ];
    }

    // --- Small utilities --------------------------------------------------

    private function sentiment(?string $value): ?string
    {
        return match ($value) {
            'positive' => 'positive',
            'negative' => 'negative',
            'neutral', 'mixed' => 'neutral',
            default => null,
        };
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

    /**
     * @param  array<string, mixed>  $platformInfo
     */
    private function channelThumb(array $platformInfo): string
    {
        return (string) ($platformInfo['thumbnail_url'] ?? $platformInfo['thumbnail'] ?? '');
    }

    /**
     * @param  array<string, mixed>  $platformInfo
     */
    private function contentThumb(array $platformInfo, string $uuid): string
    {
        foreach (['thumbnail_maxres', 'thumbnail_high', 'thumbnail_medium', 'thumbnail_default'] as $key) {
            if (! empty($platformInfo[$key]) && is_string($platformInfo[$key])) {
                return $platformInfo[$key];
            }
        }

        return "https://i.ytimg.com/vi/{$uuid}/hqdefault.jpg";
    }

    /**
     * @param  array<string, mixed>  $platformInfo
     */
    private function durationSeconds(array $platformInfo): int
    {
        $duration = $platformInfo['duration'] ?? null;

        if (is_numeric($duration)) {
            return (int) $duration;
        }

        if (is_string($duration) && $duration !== '') {
            try {
                $interval = new \DateInterval($duration);

                return ((int) $interval->d * 86400) + ((int) $interval->h * 3600) + ((int) $interval->i * 60) + (int) $interval->s;
            } catch (\Throwable) {
                return 0;
            }
        }

        return 0;
    }

    private function readDuration(?string $summary): int
    {
        $words = str_word_count(strip_tags((string) $summary));

        return max(1, (int) ceil($words / 200));
    }

    /**
     * @return list<string>
     */
    private function monthKeys(): array
    {
        $keys = [];
        for ($i = 11; $i >= 0; $i--) {
            $keys[] = CarbonImmutable::now()->startOfMonth()->subMonths($i)->format('Y-m');
        }

        return $keys;
    }

    /**
     * @return list<array{month: string, count: int}>
     */
    private function zeroMonths(): array
    {
        return array_map(fn (string $m): array => ['month' => $m, 'count' => 0], $this->monthKeys());
    }

    /**
     * Cache expensive aggregations briefly (file cache; mind-jam data is
     * read-only here, so short staleness is fine).
     *
     * @param  \Closure(): array<int|string, mixed>  $callback
     * @return array<int|string, mixed>
     */
    private function remember(string $key, \Closure $callback): array
    {
        $value = Cache::remember('mindjam:'.$key, now()->addMinutes(10), $callback);

        return is_array($value) ? $value : [];
    }

    private function decode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (is_string($value) && $value !== '') {
            $decoded = json_decode($value, true);

            return is_array($decoded) ? $decoded : [];
        }

        return [];
    }
}
