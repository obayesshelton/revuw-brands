<?php

namespace App\Services\Data;

use Carbon\CarbonImmutable;

/**
 * Deterministic, EODHD-shaped price fixtures. Every value is seeded from the
 * ticker so a given symbol always returns the same series across requests.
 * Returns null/[] for empty tickers so startups (no ticker) degrade cleanly.
 */
class MockPriceProvider implements PriceProvider
{
    public function quote(string $ticker): ?array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '') {
            return null;
        }

        $candles = $this->history($ticker, '1m');

        if (count($candles) < 2) {
            return null;
        }

        $last = $candles[count($candles) - 1];
        $prev = $candles[count($candles) - 2];

        $close = (float) $last['close'];
        $previousClose = (float) $prev['close'];
        $change = round($close - $previousClose, 4);
        $changeP = $previousClose !== 0.0 ? round(($change / $previousClose) * 100, 2) : 0.0;

        return [
            'code' => $ticker,
            'timestamp' => CarbonImmutable::now()->getTimestamp(),
            'open' => $last['open'],
            'high' => $last['high'],
            'low' => $last['low'],
            'close' => $close,
            'volume' => $last['volume'],
            'previousClose' => $previousClose,
            'change' => $change,
            'change_p' => $changeP,
        ];
    }

    public function fundamentals(string $ticker): ?array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '') {
            return null;
        }

        // EODHD tickers are SYMBOL.EXCHANGE; split so we can echo a sensible
        // exchange label without needing a real lookup.
        [$code, $exchangeCode] = array_pad(explode('.', $ticker, 2), 2, 'US');
        $exchanges = [
            'US' => ['name' => 'NASDAQ', 'country' => 'USA', 'currency' => 'USD', 'symbol' => '$'],
            'LSE' => ['name' => 'London Stock Exchange', 'country' => 'UK', 'currency' => 'GBP', 'symbol' => '£'],
            'XETRA' => ['name' => 'XETRA', 'country' => 'Germany', 'currency' => 'EUR', 'symbol' => '€'],
            'TO' => ['name' => 'Toronto Stock Exchange', 'country' => 'Canada', 'currency' => 'CAD', 'symbol' => 'C$'],
        ];
        $exchange = $exchanges[$exchangeCode] ?? $exchanges['US'];

        return [
            'code' => $code,
            'ticker' => $ticker,
            'name' => $code, // stub — real EODHD returns the company name
            'exchange' => $exchange['name'],
            'exchangeCode' => $exchangeCode,
            'currencyCode' => $exchange['currency'],
            'currencySymbol' => $exchange['symbol'],
            'country' => $exchange['country'],
            // Real EODHD returns a hosted PNG (e.g. /img/logos/US/aapl.png).
            // Mock leaves it null so the UI falls back to a ticker monogram.
            'logoUrl' => null,
            'updatedAt' => CarbonImmutable::now()->subDay()->toIso8601String(),
        ];
    }

    public function history(string $ticker, string $range = '1y'): array
    {
        $ticker = strtoupper(trim($ticker));

        if ($ticker === '') {
            return [];
        }

        [$count, $step] = $this->window($range);

        // Anchor the walk to a fixed point in the past and price each day as a
        // pure function of its date. The price on any given day is therefore
        // identical across ranges, so the quote (last day) always matches the
        // last point of every chart.
        $anchor = CarbonImmutable::now()->startOfDay()->subYears(5);
        $start = CarbonImmutable::now()->startOfDay()->subDays(($count - 1) * $step);

        $candles = [];

        for ($i = 0; $i < $count; $i++) {
            $date = $start->addDays($i * $step);
            $candles[] = $this->candle($ticker, $date, $anchor);
        }

        return $candles;
    }

    /**
     * Price one day as a pure function of its date so every range agrees.
     *
     * @return array<string, mixed>
     */
    private function candle(string $ticker, CarbonImmutable $date, CarbonImmutable $anchor): array
    {
        $seed = crc32($ticker);
        $base = (float) (40 + ($seed % 360)); // 40..400
        $t = (int) $anchor->diffInDays($date); // days since the fixed anchor
        $key = $date->format('Y-m-d');

        $driftPerDay = (($seed % 9) - 4) / 20000; // gentle long-term trend
        $seasonal = $base * 0.06 * sin($t / 26.0 + ($seed % 6));
        $noise = $base * 0.015 * (($this->h($ticker, 'n', $key) % 1000) / 1000 - 0.5);

        $close = round(max(1.0, $base * (1 + $driftPerDay * $t) + $seasonal + $noise), 2);
        $open = round($close * (1 + ((($this->h($ticker, 'o', $key) % 100) / 100) - 0.5) * 0.02), 2);
        $high = round(max($open, $close) * (1 + ($this->h($ticker, 'h', $key) % 40) / 1000), 2);
        $low = round(min($open, $close) * (1 - ($this->h($ticker, 'l', $key) % 40) / 1000), 2);
        $volume = 1_000_000 + $this->h($ticker, 'v', $key) % 50_000_000;

        return [
            'date' => $key,
            'open' => $open,
            'high' => $high,
            'low' => $low,
            'close' => $close,
            'adjusted_close' => $close,
            'volume' => $volume,
        ];
    }

    /**
     * @return array{0: int, 1: int} [count, stepDays]
     */
    private function window(string $range): array
    {
        return match ($range) {
            '1m' => [22, 1],
            '3m' => [66, 1],
            '6m' => [132, 1],
            '5y' => [260, 7],
            default => [252, 1], // 1y
        };
    }

    private function h(string ...$parts): int
    {
        return (int) hexdec(substr(md5(implode(':', $parts)), 0, 8));
    }
}
