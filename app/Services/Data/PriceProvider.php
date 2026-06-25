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
}
