<?php

namespace App\Services\Data;

/**
 * Share-price data, keyed by an EODHD-style ticker (SYMBOL.EXCHANGE, e.g.
 * AAPL.US). Brand-agnostic — only stock entities carry a ticker. Returned
 * arrays match EODHD's real response shapes so the live implementation is a
 * drop-in swap.
 */
interface PriceProvider
{
    /** @return array<string, mixed>|null EODHD real-time quote, or null if the ticker has no price */
    public function quote(string $ticker): ?array;

    /** @return list<array<string, mixed>> EODHD end-of-day candles */
    public function history(string $ticker, string $range = '1y'): array;

    /**
     * EODHD fundamentals — the `General` block trimmed to what the UI needs
     * (code, name, exchange, currency, logo). Returns null if unknown.
     *
     * @return array<string, mixed>|null
     */
    public function fundamentals(string $ticker): ?array;
}
