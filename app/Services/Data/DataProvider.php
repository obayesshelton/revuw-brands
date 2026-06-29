<?php

namespace App\Services\Data;

use App\Brand\Brand;

/**
 * The read model behind every investor page. The mock implementation returns
 * fixtures today; a database implementation will read mind-jam's Postgres
 * later. Every method returns plain arrays already in the JSON shape the
 * frontend types (resources/js/types/investor.ts) expect, so swapping the
 * implementation needs no frontend changes.
 *
 * Entity methods take the active Brand and apply its `entityType` server-side,
 * so a user can never request another type.
 */
interface DataProvider
{
    /** @return list<array<string, mixed>> EntitySummary[] */
    public function trendingEntities(Brand $brand, int $limit = 12): array;

    /** @return list<array<string, mixed>> ChannelSummary[] */
    public function trendingChannels(Brand $brand, int $limit = 8): array;

    /** @return list<array<string, mixed>> Video[] — most recent content across the brand's entities */
    public function latestVideos(Brand $brand, int $limit = 10): array;

    /**
     * Source-agnostic mention feed used by the global MentionsTable.
     * Each row is one (content × entity) pair; a video that mentions
     * two entities therefore appears twice in the result.
     *
     * @return list<array<string, mixed>> Mention[]
     */
    public function latestMentions(Brand $brand, int $limit = 30): array;

    /** @return array<string, mixed>|null Entity */
    public function entity(Brand $brand, string $slug): ?array;

    /** @return list<array<string, mixed>> MentionTimelineBucket[] */
    public function entityTimeline(Brand $brand, string $entityId): array;

    /** @return list<array<string, mixed>> TopSource[] */
    public function entityTopSources(Brand $brand, string $entityId): array;

    /** @return list<array<string, mixed>> Video[] */
    public function entityVideos(Brand $brand, string $entityId, int $limit = 20): array;

    /**
     * Heavy per-video transcript. Returns the discriminated VideoTranscript
     * shape — `{kind: 'timestamped', ...}` for YouTube-style sources with
     * captions, `{kind: 'prose', ...}` for article-shaped sources like EOD
     * news. Null when no transcript is available yet.
     *
     * @return array<string, mixed>|null VideoTranscript
     */
    public function transcriptForVideo(string $videoId): ?array;

    /**
     * @param  array<string, mixed>  $filters  ScreenerFilters
     * @return array{data: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function screenEntities(Brand $brand, array $filters): array;

    /** @return array<string, mixed>|null Channel */
    public function channel(Brand $brand, string $handle): ?array;

    /** @return list<array<string, mixed>> Video[] */
    public function channelVideos(Brand $brand, string $channelId, int $limit = 20): array;

    /**
     * @return array{data: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function searchChannels(Brand $brand, string $query, int $page = 1, int $perPage = 24): array;

    /**
     * @return array{entities: list<array<string, mixed>>, channels: list<array<string, mixed>>}
     */
    public function search(Brand $brand, string $query, int $limit = 8): array;
}
