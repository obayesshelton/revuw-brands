import type { PriceCandle, PriceQuote, PriceRange } from '@/types/investor';

/**
 * Thin client for our async price endpoints. The backend returns EODHD-shaped
 * data (mocked today), so these helpers won't change when the live provider
 * is wired in.
 */

export async function fetchQuote(ticker: string): Promise<PriceQuote | null> {
    const response = await fetch(
        `/api/price/${encodeURIComponent(ticker)}/quote`,
        {
            headers: { Accept: 'application/json' },
        },
    );

    if (!response.ok) {
        return null;
    }

    const data = (await response.json()) as { quote: PriceQuote | null };

    return data.quote;
}

export async function fetchHistory(
    ticker: string,
    range: PriceRange,
): Promise<PriceCandle[]> {
    const response = await fetch(
        `/api/price/${encodeURIComponent(ticker)}/history?range=${range}`,
        { headers: { Accept: 'application/json' } },
    );

    if (!response.ok) {
        return [];
    }

    const data = (await response.json()) as { candles: PriceCandle[] };

    return data.candles ?? [];
}

export const PRICE_RANGES: PriceRange[] = ['1m', '3m', '6m', '1y', '5y'];
