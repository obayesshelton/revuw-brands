import { Link } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useInitials } from '@/hooks/use-initials';
import { PRICE_TEXT_CLASS, SENTIMENT_HEX, SENTIMENT_TEXT_CLASS, SOURCE_HEX, SOURCE_LABEL } from '@/lib/colors';
import { getQuote } from '@/lib/eodhd';
import { formatCompact, formatSignedPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Mention, ChatterSource, PriceQuote } from '@/types/investor';

export interface MentionColumn {
    key: string;
    label: string;
    width?: string;
    align?: 'left' | 'right';
    /** Hidden by default unless the user opts in via the column-toggle menu. */
    optional?: boolean;
    headClassName?: string;
    cellClassName?: string;
    render: (mention: Mention) => ReactNode;
}

const REACH_SUFFIX: Record<ChatterSource, string> = {
    youtube: 'views',
    eod_news: 'reads',
    reddit: 'upvotes',
    revuw: 'reads',
};

export const sourceColumn: MentionColumn = {
    key: 'source',
    label: 'Source',
    width: '90px',
    render: (m) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span
                className="size-2 rounded-full"
                style={{ background: SOURCE_HEX[m.source] ?? '#94a3b8' }}
            />
            {SOURCE_LABEL[m.source]}
        </span>
    ),
};

export const titleColumn: MentionColumn = {
    key: 'title',
    label: 'Title',
    width: 'minmax(0, 1fr)',
    render: (m) => (
        <a
            href={m.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-sm font-medium hover:text-primary"
            title={m.title}
        >
            {m.title}
        </a>
    ),
};

function ChannelCell({ mention }: { mention: Mention }) {
    const getInitials = useInitials();

    return (
        <div className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6 shrink-0">
                <AvatarImage
                    src={mention.channel.thumbnail}
                    alt={mention.channel.name}
                />
                <AvatarFallback className="text-[9px]">
                    {getInitials(mention.channel.name)}
                </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{mention.channel.name}</span>
        </div>
    );
}

export const channelColumn: MentionColumn = {
    key: 'channel',
    label: 'Channel',
    width: '200px',
    render: (m) => <ChannelCell mention={m} />,
};

export const entityColumn: MentionColumn = {
    key: 'entity',
    label: 'Entity',
    width: '120px',
    render: (m) =>
        m.entity ? (
            <Link href={`/entities/${m.entity.slug}`} className="inline-flex">
                <Badge variant="outline" className="font-medium">
                    {m.entity.name}
                </Badge>
            </Link>
        ) : (
            <span className="text-xs text-muted-foreground">—</span>
        ),
};

export const postedColumn: MentionColumn = {
    key: 'posted',
    label: 'Posted',
    width: '84px',
    render: (m) => (
        <span className="text-sm text-muted-foreground">
            {formatRelative(m.publishedAt)}
        </span>
    ),
};

export const sentimentColumn: MentionColumn = {
    key: 'sentiment',
    label: 'Sentiment',
    width: '120px',
    render: (m) =>
        m.sentiment ? (
            <span
                className={cn(
                    'inline-flex items-center gap-1.5 text-xs font-semibold',
                    SENTIMENT_TEXT_CLASS[m.sentiment],
                )}
            >
                <span
                    className="size-1.5 rounded-full"
                    style={{ background: SENTIMENT_HEX[m.sentiment] }}
                />
                {sentimentLabel(m.sentiment)}
            </span>
        ) : (
            <span className="text-xs text-muted-foreground">—</span>
        ),
};

export const reachColumn: MentionColumn = {
    key: 'reach',
    label: 'Reach',
    width: '110px',
    align: 'right',
    render: (m) => (
        <span className="text-sm tabular-nums">
            {formatCompact(m.reach)}{' '}
            <span className="text-xs text-muted-foreground">
                {REACH_SUFFIX[m.source]}
            </span>
        </span>
    ),
};

export const countryColumn: MentionColumn = {
    key: 'country',
    label: 'Country',
    width: '110px',
    optional: true,
    render: (m) => (
        <span className="text-sm">
            {m.entityFundamentals?.country ?? (
                <span className="text-muted-foreground">—</span>
            )}
        </span>
    ),
};

export const exchangeColumn: MentionColumn = {
    key: 'exchange',
    label: 'Exchange',
    width: '110px',
    optional: true,
    render: (m) => (
        <span className="text-sm">
            {m.entityFundamentals?.exchangeCode ?? (
                <span className="text-muted-foreground">—</span>
            )}
        </span>
    ),
};

function PriceCell({ ticker }: { ticker: string | null }) {
    const [quote, setQuote] = useState<PriceQuote | null | 'error'>(null);

    useEffect(() => {
        if (!ticker) return;
        let cancelled = false;
        getQuote(ticker)
            .then((q) => {
                if (!cancelled) setQuote(q ?? 'error');
            })
            .catch(() => {
                if (!cancelled) setQuote('error');
            });

        return () => {
            cancelled = true;
        };
    }, [ticker]);

    if (!ticker) {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    if (quote === null) {
        return (
            <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-2 w-10" />
            </div>
        );
    }

    if (quote === 'error') {
        return <span className="text-xs text-muted-foreground">—</span>;
    }

    const dir = quote.change_p >= 0 ? 'up' : 'down';

    return (
        <div className="flex flex-col items-end leading-tight tabular-nums">
            <span className="text-sm font-semibold">
                {quote.close.toFixed(2)}
            </span>
            <span className={cn('text-xs font-medium', PRICE_TEXT_CLASS[dir])}>
                {formatSignedPercent(quote.change_p)}
            </span>
        </div>
    );
}

export const priceColumn: MentionColumn = {
    key: 'price',
    label: 'Price',
    width: '100px',
    align: 'right',
    render: (m) => <PriceCell ticker={m.ticker} />,
};

export const currencyColumn: MentionColumn = {
    key: 'currency',
    label: 'Currency',
    width: '90px',
    optional: true,
    render: (m) => (
        <span className="text-sm">
            {m.entityFundamentals?.currencyCode ?? (
                <span className="text-muted-foreground">—</span>
            )}
        </span>
    ),
};

function sentimentLabel(s: Mention['sentiment']): string {
    if (s === 'positive') {
        return 'Bullish';
    }

    if (s === 'negative') {
        return 'Bearish';
    }

    return 'Mixed';
}

function formatRelative(iso: string): string {
    const then = new Date(iso).getTime();

    if (Number.isNaN(then)) {
        return '';
    }

    const diff = Date.now() - then;
    const minutes = Math.floor(diff / 60_000);

    if (minutes < 60) {
        return `${Math.max(1, minutes)}m`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h`;
    }

    const days = Math.floor(hours / 24);

    if (days < 30) {
        return `${days}d`;
    }

    const months = Math.floor(days / 30);

    if (months < 12) {
        return `${months}mo`;
    }

    const years = Math.floor(months / 12);

    return `${years}y`;
}

