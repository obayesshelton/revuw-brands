/**
 * Domain color tokens. See CLAUDE.md "Color conventions" for the rule of thumb:
 *
 *   - Greens and reds are reserved for PRICE direction and SENTIMENT only.
 *   - Source / platform colors (YouTube, Reddit, …) must NOT use green or red.
 *   - Neutral sentiment is AMBER (not gray).
 *
 * Import from here instead of hardcoding hex codes in components, so the rule
 * is grep-able and a future palette change touches one file.
 */

import type { Sentiment } from '@/types/investor';

/**
 * Price direction. Used by price chart strokes, price-tag text, day-change
 * indicators. Never use for sources.
 */
export const PRICE_HEX = {
    up: '#10b981', // emerald-500
    down: '#ef4444', // red-500
} as const;

export const PRICE_TEXT_CLASS = {
    up: 'text-emerald-600 dark:text-emerald-400',
    down: 'text-red-600 dark:text-red-400',
} as const;

/**
 * Sentiment. Positive=green, negative=red, neutral=AMBER.
 * The amber for neutral is intentional — gray reads as "no data".
 */
export const SENTIMENT_HEX: Record<Sentiment, string> = {
    positive: '#10b981', // emerald-500
    negative: '#ef4444', // red-500
    neutral: '#f59e0b', // amber-500
};

export const SENTIMENT_TEXT_CLASS: Record<Sentiment, string> = {
    positive: 'text-emerald-600 dark:text-emerald-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-amber-600 dark:text-amber-500',
};

/**
 * Source / platform colors. These identify WHERE chatter came from
 * (YouTube vs Reddit vs EOD news vs …). Picked to be unambiguously
 * non-stoplight so they never collide with price or sentiment cues —
 * YouTube's brand red is deliberately replaced with slate.
 */
export const SOURCE_HEX = {
    youtube: '#475569', // slate-600
    eod_news: '#0d9488', // teal-600
    reddit: '#7c3aed', // violet-600
    revuw: '#0891b2', // cyan-600 — our own articles
} as const;

export type SourcePlatform = keyof typeof SOURCE_HEX;

export const SOURCE_LABEL: Record<SourcePlatform, string> = {
    youtube: 'YouTube',
    eod_news: 'EOD News',
    reddit: 'Reddit',
    revuw: 'Revuw',
};

/**
 * Per-ticker color palette for chip/pill identity within a chatter card.
 * Hash the ticker to a stable index so the same ticker reads as the same
 * color across renders. Explicitly NOT green or red — those stay reserved
 * for sentiment / price direction (see CLAUDE.md color rule).
 */
export const TICKER_PALETTE = [
    { name: 'indigo', fg: '#4f46e5', bg: '#eef2ff' },
    { name: 'cyan', fg: '#0891b2', bg: '#ecfeff' },
    { name: 'amber', fg: '#b45309', bg: '#fef3c7' },
    { name: 'violet', fg: '#7c3aed', bg: '#f5f3ff' },
    { name: 'orange', fg: '#c2410c', bg: '#ffedd5' },
    { name: 'pink', fg: '#be185d', bg: '#fce7f3' },
] as const;

export function tickerColor(ticker: string): { fg: string; bg: string } {
    let hash = 0;

    for (let i = 0; i < ticker.length; i++) {
        hash = (hash * 31 + ticker.charCodeAt(i)) >>> 0;
    }

    const swatch = TICKER_PALETTE[hash % TICKER_PALETTE.length];

    return { fg: swatch.fg, bg: swatch.bg };
}
