import type {
    PriceCandle,
    PriceFundamentals,
    PriceQuote,
    PriceRange,
} from '@/types/investor';

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

/**
 * Module-level promise cache so a screener showing 30 rows that mention
 * the same 6 tickers only fires 6 `/api/price/.../quote` requests, not 30.
 * Cleared on a hard reload — that's fine for a 15-min-delayed quote.
 */
const quoteCache = new Map<string, Promise<PriceQuote | null>>();

export function getQuote(ticker: string): Promise<PriceQuote | null> {
    let p = quoteCache.get(ticker);

    if (!p) {
        p = fetchQuote(ticker);
        quoteCache.set(ticker, p);
    }

    return p;
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

export async function fetchFundamentals(
    ticker: string,
): Promise<PriceFundamentals | null> {
    const response = await fetch(
        `/api/price/${encodeURIComponent(ticker)}/fundamentals`,
        {
            headers: { Accept: 'application/json' },
        },
    );

    if (!response.ok) {
        return null;
    }

    const data = (await response.json()) as {
        fundamentals: PriceFundamentals | null;
    };

    return data.fundamentals;
}

export const PRICE_RANGES: PriceRange[] = ['1m', '3m', '6m', '1y', '5y'];
