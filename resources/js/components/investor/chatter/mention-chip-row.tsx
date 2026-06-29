import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PRICE_TEXT_CLASS, SENTIMENT_HEX, tickerColor } from '@/lib/colors';
import { fetchQuote } from '@/lib/eodhd';
import { formatSignedPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Sentiment, VideoMentionSummary } from '@/types/investor';

interface MentionChipRowProps {
    mentions: VideoMentionSummary[];
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
}

/**
 * Rich chip strip rendered in the expanded view of YouTube + EOD news cards.
 * `All · N` toggle + one per-ticker pill with sentiment-colored dot and live
 * EODHD day-change. Sentiment color lives left of the ticker; price color
 * lives right of it — two channels of meaning, two anchors.
 */
export function MentionChipRow({
    mentions,
    selectedTicker,
    onSelect,
}: MentionChipRowProps) {
    const total = mentions.reduce((sum, m) => sum + m.count, 0);
    const allActive = selectedTicker === null;

    return (
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2">
            <span className="mr-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Mentioned
            </span>
            <button
                type="button"
                onClick={() => onSelect(null)}
                className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    allActive
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-background hover:border-foreground/40',
                )}
            >
                All · {total}
            </button>
            {mentions.map((m) => (
                <TickerChip
                    key={m.entity.slug}
                    ticker={m.ticker ?? m.entity.name}
                    sentiment={m.sentiment}
                    count={m.count}
                    isActive={selectedTicker === (m.ticker ?? m.entity.name)}
                    onToggle={(t) => onSelect(selectedTicker === t ? null : t)}
                    hasLivePrice={m.ticker !== null}
                />
            ))}
        </div>
    );
}

function TickerChip({
    ticker,
    sentiment,
    count,
    isActive,
    onToggle,
    hasLivePrice,
}: {
    ticker: string;
    sentiment: Sentiment;
    count: number;
    isActive: boolean;
    onToggle: (t: string) => void;
    hasLivePrice: boolean;
}) {
    const { fg, bg } = tickerColor(ticker);

    return (
        <button
            type="button"
            onClick={() => onToggle(ticker)}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                isActive
                    ? 'border-foreground'
                    : 'border-border hover:border-foreground/40',
            )}
            style={{
                background: isActive ? bg : undefined,
                color: isActive ? fg : undefined,
            }}
        >
            <span
                className="size-1.5 rounded-full"
                style={{ background: SENTIMENT_HEX[sentiment] }}
                aria-hidden
            />
            <span>{ticker}</span>
            {hasLivePrice && <PriceChange ticker={ticker} />}
            <span className="font-medium opacity-60">· {count}</span>
        </button>
    );
}

/**
 * Live day-change for a ticker. Mirrors PriceTag — fetches its own quote so
 * each chip can render independently as the card expands.
 */
function PriceChange({ ticker }: { ticker: string }) {
    const [changeP, setChangeP] = useState<number | null | 'error'>(null);

    useEffect(() => {
        let cancelled = false;

        fetchQuote(ticker)
            .then((quote) => {
                if (!cancelled) {
setChangeP(quote?.change_p ?? 'error');
}
            })
            .catch(() => {
                if (!cancelled) {
setChangeP('error');
}
            });

        return () => {
            cancelled = true;
        };
    }, [ticker]);

    if (changeP === null) {
        return <Skeleton className="h-3 w-10 rounded-sm" />;
    }

    if (changeP === 'error') {
        return <span className="text-muted-foreground">—</span>;
    }

    const dir = changeP >= 0 ? 'up' : 'down';

    return (
        <span className={PRICE_TEXT_CLASS[dir]}>
            {formatSignedPercent(changeP)}
        </span>
    );
}
