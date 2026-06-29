<?php

namespace App\Services\Data;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Live EODHD price source. Endpoints under {base} = https://eodhd.com/api:
 *   quote()        -> GET {base}/real-time/{ticker}?api_token=...&fmt=json
 *   history()      -> GET {base}/eod/{ticker}?api_token=...&fmt=json&period=d&from=&to=
 *   fundamentals() -> GET {base}/fundamentals/{ticker}?api_token=...
 *
 * Responses are mapped to the same shapes MockPriceProvider returns; null/[]
 * on transport or shape errors so the UI degrades the same way it does for
 * tickerless startups.
 *
 * Cached aggressively because EODHD bills per call and the underlying data
 * doesn't move within these TTLs.
 */
class EodhdPriceProvider implements PriceProvider
{
    private const QUOTE_TTL = 60;            // 1 min — quotes are 15-20m delayed anyway

    private const HISTORY_TTL = 6 * 3600;    // 6 hours — EOD data updates once a day

    private const FUNDAMENTALS_TTL = 86_400; // 24 hours

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
    ) {}

    public function quote(string $ticker): ?array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '' || $this->apiKey === '') {
            return null;
        }

        return $this->cached(
            "eodhd:quote:{$ticker}",
            self::QUOTE_TTL,
            fn () => $this->fetchQuote($ticker),
        );
    }

    public function history(string $ticker, string $range = '1y'): array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '' || $this->apiKey === '') {
            return [];
        }

        return $this->cached(
            "eodhd:history:{$ticker}:{$range}",
            self::HISTORY_TTL,
            fn () => $this->fetchHistory($ticker, $range),
        ) ?? [];
    }

    public function fundamentals(string $ticker): ?array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '' || $this->apiKey === '') {
            return null;
        }

        return $this->cached(
            "eodhd:fundamentals:{$ticker}",
            self::FUNDAMENTALS_TTL,
            fn () => $this->fetchFundamentals($ticker),
        );
    }

    /**
     * Like Cache::remember, but caches `null` returns too — so a free-tier 403
     * on fundamentals doesn't re-hit the API on every page load. `Cache::has()`
     * returns false for stored nulls, so we wrap the cached value in an array
     * to distinguish "cached as null" from "not cached".
     */
    private function cached(string $key, int $ttl, Closure $callback): mixed
    {
        $cached = Cache::get($key);

        if (is_array($cached) && array_key_exists('value', $cached)) {
            return $cached['value'];
        }

        $value = $callback();
        Cache::put($key, ['value' => $value], $ttl);

        return $value;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fetchQuote(string $ticker): ?array
    {
        $response = Http::timeout(10)->get("{$this->baseUrl}/real-time/{$ticker}", [
            'api_token' => $this->apiKey,
            'fmt' => 'json',
        ]);

        if (! $response->successful()) {
            Log::warning('EODHD quote request failed', [
                'ticker' => $ticker,
                'status' => $response->status(),
            ]);

            return null;
        }

        $data = $response->json();

        if (! is_array($data) || ! is_numeric($data['close'] ?? null)) {
            return null;
        }

        return [
            'code' => (string) ($data['code'] ?? $ticker),
            'timestamp' => (int) ($data['timestamp'] ?? 0),
            'open' => (float) ($data['open'] ?? 0),
            'high' => (float) ($data['high'] ?? 0),
            'low' => (float) ($data['low'] ?? 0),
            'close' => (float) $data['close'],
            'volume' => (int) ($data['volume'] ?? 0),
            'previousClose' => (float) ($data['previousClose'] ?? 0),
            'change' => (float) ($data['change'] ?? 0),
            'change_p' => (float) ($data['change_p'] ?? 0),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchHistory(string $ticker, string $range): array
    {
        $from = $this->rangeFrom($range)->toDateString();
        $to = CarbonImmutable::now()->toDateString();

        $response = Http::timeout(15)->get("{$this->baseUrl}/eod/{$ticker}", [
            'api_token' => $this->apiKey,
            'fmt' => 'json',
            'period' => 'd',
            'from' => $from,
            'to' => $to,
        ]);

        if (! $response->successful()) {
            Log::warning('EODHD history request failed', [
                'ticker' => $ticker,
                'range' => $range,
                'status' => $response->status(),
            ]);

            return [];
        }

        $data = $response->json();

        if (! is_array($data)) {
            return [];
        }

        $candles = [];

        foreach ($data as $row) {
            if (! is_array($row) || ! isset($row['date'], $row['close'])) {
                continue;
            }

            $candles[] = [
                'date' => (string) $row['date'],
                'open' => (float) ($row['open'] ?? 0),
                'high' => (float) ($row['high'] ?? 0),
                'low' => (float) ($row['low'] ?? 0),
                'close' => (float) $row['close'],
                'adjusted_close' => (float) ($row['adjusted_close'] ?? $row['close']),
                'volume' => (int) ($row['volume'] ?? 0),
            ];
        }

        return $candles;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function fetchFundamentals(string $ticker): ?array
    {
        $response = Http::timeout(15)->get("{$this->baseUrl}/fundamentals/{$ticker}", [
            'api_token' => $this->apiKey,
        ]);

        if (! $response->successful()) {
            Log::warning('EODHD fundamentals request failed', [
                'ticker' => $ticker,
                'status' => $response->status(),
            ]);

            return null;
        }

        $data = $response->json();
        $general = is_array($data) ? ($data['General'] ?? null) : null;

        if (! is_array($general) || empty($general['Code'])) {
            return null;
        }

        $exchangeCode = $this->exchangeCodeFromTicker($ticker);
        $logoUrl = (string) ($general['LogoURL'] ?? '');

        if ($logoUrl !== '' && str_starts_with($logoUrl, '/')) {
            $logoUrl = 'https://eodhd.com'.$logoUrl;
        }

        return [
            'code' => (string) $general['Code'],
            'ticker' => $ticker,
            'name' => (string) ($general['Name'] ?? $general['Code']),
            'exchange' => (string) ($general['Exchange'] ?? ''),
            'exchangeCode' => $exchangeCode,
            'currencyCode' => (string) ($general['CurrencyCode'] ?? 'USD'),
            'currencySymbol' => (string) ($general['CurrencySymbol'] ?? '$'),
            'country' => (string) ($general['CountryName'] ?? ''),
            'logoUrl' => $logoUrl !== '' ? $logoUrl : null,
            'updatedAt' => (string) ($general['UpdatedAt'] ?? ''),
        ];
    }

    private function rangeFrom(string $range): CarbonImmutable
    {
        $now = CarbonImmutable::now();

        return match ($range) {
            '1m' => $now->subMonth(),
            '3m' => $now->subMonths(3),
            '6m' => $now->subMonths(6),
            '5y' => $now->subYears(5),
            default => $now->subYear(),
        };
    }

    private function exchangeCodeFromTicker(string $ticker): string
    {
        $parts = explode('.', $ticker, 2);

        return $parts[1] ?? 'US';
    }
}
