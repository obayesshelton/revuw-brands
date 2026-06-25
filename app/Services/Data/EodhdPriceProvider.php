<?php

namespace App\Services\Data;

use RuntimeException;

/**
 * Future implementation that calls EODHD's real endpoints (base = https://eodhd.com):
 *   quote()   -> GET {base}/api/real-time/{ticker}?api_token=...&fmt=json
 *   history() -> GET {base}/api/eod/{ticker}?api_token=...&fmt=json&period=d&from=&to=
 * Configure via services.eodhd. Swap in with PRICE_PROVIDER=eodhd. Return
 * shapes already match EODHD, so MockPriceProvider can be replaced directly.
 */
class EodhdPriceProvider implements PriceProvider
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl,
    ) {}

    public function quote(string $ticker): ?array
    {
        throw $this->notImplemented("{$this->baseUrl}/api/real-time/{$ticker}");
    }

    public function history(string $ticker, string $range = '1y'): array
    {
        throw $this->notImplemented("{$this->baseUrl}/api/eod/{$ticker} (period=d, range={$range})");
    }

    private function notImplemented(string $endpoint): RuntimeException
    {
        $auth = $this->apiKey === '' ? 'no API key configured' : 'API key configured';

        return new RuntimeException(
            "EodhdPriceProvider is not implemented yet (would call {$endpoint}, {$auth}); set PRICE_PROVIDER=mock."
        );
    }
}
