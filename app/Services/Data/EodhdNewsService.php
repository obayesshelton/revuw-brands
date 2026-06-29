<?php

namespace App\Services\Data;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Fetches news from EODHD's per-symbol news endpoint, caches it for the
 * configured TTL, and maps each item into the same Video shape the mock
 * dataset emits — so MockDataProvider can merge real EOD news in next to
 * synthetic YouTube videos without the controllers caring.
 *
 *   GET {base}/api/news?api_token=...&s={ticker}&limit=N&fmt=json
 *
 * Cache lives in the default driver, keyed per ticker so a new tracked
 * entity can be added without invalidating the whole feed. A blanket
 * fetch failure (key revoked, network blip) returns [] so the page still
 * renders — YouTube-only — instead of throwing.
 */
class EodhdNewsService
{
    /** @var int Cache TTL in seconds. 6h default — news is stale within a day anyway. */
    private const TTL = 21_600;

    /** @var int How many news items to pull per ticker. */
    private const PER_TICKER = 15;

    /**
     * @var array<string, array<string, mixed>>|null
     *   Lazy id→raw-item index for transcript lookups; built once per request
     *   from whatever the last call to forTickers() loaded.
     */
    private ?array $index = null;

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
    ) {}

    /**
     * Fetch (or read cached) news for each ticker, deduplicate by article
     * link, and return a flat list of Video-shaped arrays sorted newest
     * first.
     *
     * @param  list<array<string, mixed>>  $entities  EntitySummary[] — we only
     *                                                fetch for entities that
     *                                                have a ticker.
     * @return list<array<string, mixed>>
     */
    public function videosForEntities(array $entities): array
    {
        if ($this->apiKey === '') {
            return [];
        }

        $tickerToEntity = [];
        foreach ($entities as $entity) {
            $ticker = $entity['ticker'] ?? null;
            if (is_string($ticker) && $ticker !== '') {
                $tickerToEntity[$ticker] = $entity;
            }
        }

        if ($tickerToEntity === []) {
            return [];
        }

        /** @var array<string, array<string, mixed>> $seen */
        $seen = [];
        /** @var array<string, array<string, mixed>> $index */
        $index = [];

        foreach ($tickerToEntity as $ticker => $entity) {
            foreach ($this->newsForTicker($ticker) as $item) {
                $link = (string) ($item['link'] ?? '');
                if ($link === '' || isset($seen[$link])) {
                    continue;
                }

                $video = $this->toVideo($item, $tickerToEntity);
                if ($video === null) {
                    continue;
                }

                $seen[$link] = $video;
                $index[$video['id']] = $item;
            }
        }

        $this->index = $index;

        $videos = array_values($seen);
        usort($videos, fn (array $a, array $b): int => strcmp($b['publishedAt'], $a['publishedAt']));

        return $videos;
    }

    /**
     * Return the prose VideoTranscript shape for a previously-loaded news
     * id, or null if we haven't seen it (the user might be deep-linking a
     * stale id, or the underlying article rolled out of the cache).
     *
     * @param  list<array<string, mixed>>  $entities  needed to resolve symbol→entity
     * @return array<string, mixed>|null
     */
    public function transcriptForVideo(string $videoId, array $entities): ?array
    {
        if (! str_starts_with($videoId, 'eod-')) {
            return null;
        }

        // Lazy-rebuild the id index if it's empty (e.g. transcript hit a
        // worker that didn't serve the list page first).
        if ($this->index === null) {
            $this->videosForEntities($entities);
        }

        $item = $this->index[$videoId] ?? null;
        if ($item === null) {
            return null;
        }

        $tickerToEntity = [];
        foreach ($entities as $entity) {
            $ticker = $entity['ticker'] ?? null;
            if (is_string($ticker) && $ticker !== '') {
                $tickerToEntity[$ticker] = $entity;
            }
        }

        return [
            'kind' => 'prose',
            'videoId' => $videoId,
            'mentions' => $this->mentionsForItem($item, $tickerToEntity, withSnippet: true),
            'body' => $this->toMarkdownBody($item),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function newsForTicker(string $ticker): array
    {
        $cacheKey = 'eodhd:news:'.$ticker;

        return Cache::remember($cacheKey, self::TTL, function () use ($ticker): array {
            try {
                $response = Http::timeout(8)->retry(2, 250)->get(
                    rtrim($this->baseUrl, '/').'/news',
                    [
                        'api_token' => $this->apiKey,
                        's' => $ticker,
                        'limit' => self::PER_TICKER,
                        'fmt' => 'json',
                    ],
                );

                if (! $response->ok()) {
                    Log::warning('EODHD news fetch non-OK', [
                        'ticker' => $ticker,
                        'status' => $response->status(),
                    ]);

                    return [];
                }

                $data = $response->json();

                return is_array($data) ? $data : [];
            } catch (Throwable $e) {
                Log::warning('EODHD news fetch failed', [
                    'ticker' => $ticker,
                    'message' => $e->getMessage(),
                ]);

                return [];
            }
        });
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, array<string, mixed>>  $tickerToEntity
     * @return array<string, mixed>|null
     */
    private function toVideo(array $item, array $tickerToEntity): ?array
    {
        $link = (string) ($item['link'] ?? '');
        $title = (string) ($item['title'] ?? '');

        if ($link === '' || $title === '') {
            return null;
        }

        $id = 'eod-'.substr(sha1($link), 0, 16);
        $publishedAt = CarbonImmutable::parse((string) ($item['date'] ?? 'now'))->toIso8601String();
        $content = (string) ($item['content'] ?? '');
        $publisher = $this->publisherFromLink($link);
        $polarity = $this->polarity($item);
        $mentions = $this->mentionsForItem($item, $tickerToEntity, withSnippet: false);

        // Skip items that don't mention any of our tracked entities — the
        // EOD news endpoint returns articles tangentially related to the
        // ticker we queried, and showing un-tagged ones would be noise.
        if ($mentions === []) {
            return null;
        }

        $summary = array_map(
            fn (array $m): array => [
                'entity' => $m['entity'],
                'ticker' => $m['ticker'],
                'count' => 1,
                'sentiment' => $m['sentiment'],
            ],
            $mentions,
        );

        return [
            'id' => $id,
            'source' => 'eod_news',
            'platformContentUuid' => substr(sha1($link), 0, 11),
            'title' => $title,
            'generatedTitle' => $title,
            'url' => $link,
            'articleUrl' => $link,
            'summary' => $content,
            'tldr' => $this->firstSentence($content),
            'thumbnail' => 'https://unavatar.io/'.$publisher['domain'],
            'publishedAt' => $publishedAt,
            'readDuration' => max(1, (int) round(str_word_count($content) / 220)),
            'citations' => [],
            'platformInfo' => [
                'duration' => 0,
                'viewCount' => 0,
                'likeCount' => 0,
                'commentCount' => 0,
            ],
            'entitySentiment' => $this->categoricalFromPolarity($polarity),
            'entityTimestampStart' => null,
            'channel' => [
                'title' => $publisher['name'],
                'handle' => '@'.$publisher['slug'],
                'thumbnailUrl' => 'https://unavatar.io/'.$publisher['domain'],
            ],
            'mentionSummary' => $summary,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array<string, array<string, mixed>>  $tickerToEntity
     * @return list<array<string, mixed>>
     */
    private function mentionsForItem(array $item, array $tickerToEntity, bool $withSnippet): array
    {
        $symbols = $item['symbols'] ?? [];
        if (! is_array($symbols)) {
            return [];
        }

        $sentiment = $this->categoricalFromPolarity($this->polarity($item));
        $content = (string) ($item['content'] ?? '');
        $snippet = $withSnippet ? $this->firstSentence($content) : '';

        $mentions = [];
        foreach ($symbols as $sym) {
            if (! is_string($sym) || ! isset($tickerToEntity[$sym])) {
                continue;
            }
            $entity = $tickerToEntity[$sym];
            $mentions[] = [
                'entity' => [
                    'name' => (string) $entity['name'],
                    'slug' => (string) $entity['slug'],
                    'type' => (string) $entity['type'],
                ],
                'ticker' => $sym,
                'timestamp' => null,
                'sentiment' => $sentiment,
                'snippet' => $snippet,
            ];
        }

        return $mentions;
    }

    /** @param  array<string, mixed>  $item */
    private function polarity(array $item): float
    {
        $s = $item['sentiment'] ?? null;
        if (! is_array($s)) {
            return 0.0;
        }

        return (float) ($s['polarity'] ?? 0.0);
    }

    private function categoricalFromPolarity(float $polarity): string
    {
        if ($polarity >= 0.10) {
            return 'positive';
        }
        if ($polarity <= -0.10) {
            return 'negative';
        }

        return 'neutral';
    }

    /** @return array{name: string, domain: string, slug: string} */
    private function publisherFromLink(string $link): array
    {
        $host = parse_url($link, PHP_URL_HOST) ?: 'news';
        $host = preg_replace('/^www\./', '', $host) ?? $host;
        $name = match (true) {
            str_contains($host, 'reuters.com') => 'Reuters',
            str_contains($host, 'bloomberg.com') => 'Bloomberg',
            str_contains($host, 'ft.com') => 'Financial Times',
            str_contains($host, 'wsj.com') => 'Wall Street Journal',
            str_contains($host, 'cnbc.com') => 'CNBC',
            str_contains($host, 'finance.yahoo.com') => 'Yahoo Finance',
            str_contains($host, 'marketwatch.com') => 'MarketWatch',
            str_contains($host, 'seekingalpha.com') => 'Seeking Alpha',
            str_contains($host, 'benzinga.com') => 'Benzinga',
            str_contains($host, 'fool.com') => 'The Motley Fool',
            default => ucfirst(explode('.', $host)[0]),
        };

        $slug = strtolower(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)) ?? 'news');

        return ['name' => $name, 'domain' => $host, 'slug' => trim($slug, '-')];
    }

    private function firstSentence(string $content): string
    {
        $trimmed = trim(preg_replace('/\s+/', ' ', $content) ?? $content);
        if ($trimmed === '') {
            return '';
        }
        if (preg_match('/^(.+?[.!?])(\s|$)/u', $trimmed, $m) === 1) {
            return $m[1];
        }

        return mb_substr($trimmed, 0, 160).(mb_strlen($trimmed) > 160 ? '…' : '');
    }

    /** Render the EODHD `content` field as a tiny markdown body for the prose card. */
    private function toMarkdownBody(array $item): string
    {
        $title = (string) ($item['title'] ?? '');
        $content = trim((string) ($item['content'] ?? ''));

        if ($content === '') {
            return "## {$title}\n\n_No article body available — read the full piece on the publisher's site._";
        }

        // Real EODHD content is often a single dense blob. Split on
        // double-newlines first, then fall back to chunking by sentence
        // groups so the prose body has breathable paragraphs.
        $blocks = preg_split('/\n{2,}/', $content) ?: [$content];
        if (count($blocks) === 1) {
            $sentences = preg_split('/(?<=[.!?])\s+(?=[A-Z])/u', $blocks[0]) ?: [$blocks[0]];
            $blocks = [];
            foreach (array_chunk($sentences, 3) as $chunk) {
                $blocks[] = implode(' ', $chunk);
            }
        }

        $body = "## {$title}\n\n";
        foreach ($blocks as $block) {
            $body .= trim($block)."\n\n";
        }

        return trim($body);
    }
}
