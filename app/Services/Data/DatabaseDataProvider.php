<?php

namespace App\Services\Data;

use App\Brand\Brand;
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
    private function db(): ConnectionInterface
    {
        return DB::connection('mindjam');
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
            $rows = $this->db()->table('channel_contents as cc')
                ->join('channels as ch', 'ch.id', '=', 'cc.channel_id')
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

            return array_map(fn ($r) => $this->video($r), $rows->all());
        });
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

        $rows = $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id')
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
        $rows = $this->db()->table('channels as ch')
            ->join('channel_contents as cc', 'cc.channel_id', '=', 'ch.id')
            ->join('channel_content_entity as cce', 'cce.channel_content_id', '=', 'cc.id')
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
        $rows = $this->db()->table('channel_content_entity as cce')
            ->join('channel_contents as cc', 'cce.channel_content_id', '=', 'cc.id')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id')
            ->where('cce.entity_id', (int) $entityId)
            ->whereNotNull('cc.published_at')
            ->whereNotNull('cc.summary')
            ->orderByDesc('cc.published_at')
            ->limit($limit)
            ->get(array_merge($this->videoColumns(), ['cce.sentiment', 'cce.timestamp_start']));

        return array_map(
            fn ($r) => $this->video($r, $this->sentiment($r->sentiment), $r->timestamp_start !== null ? (int) $r->timestamp_start : null),
            $rows->all(),
        );
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
        $row = $this->db()->table('channels')
            ->where('platform_profile_url', '@'.ltrim($handle, '@'))
            ->whereNull('deleted_at')
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
        $rows = $this->db()->table('channel_contents as cc')
            ->join('channels as ch', 'ch.id', '=', 'cc.channel_id')
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
            $this->db()->table('channels as ch')
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
        return $this->db()->table('channels as ch')
            ->join('channel_contents as cc', function ($join): void {
                $join->on('cc.channel_id', '=', 'ch.id')
                    ->whereNotNull('cc.published_at')
                    ->whereNotNull('cc.summary');
            })
            ->whereNull('ch.deleted_at')
            // Group by the PK only — Postgres can't GROUP BY the json
            // platform_info column, and the others are functionally dependent.
            ->groupBy('ch.id');
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
