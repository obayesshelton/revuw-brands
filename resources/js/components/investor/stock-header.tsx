import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PRICE_TEXT_CLASS } from '@/lib/colors';
import { fetchFundamentals, fetchQuote } from '@/lib/eodhd';
import {
    formatCurrency,
    formatSignedPercent,
    formatUnixDateTime,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Entity, PriceFundamentals, PriceQuote } from '@/types/investor';

function tickerMonogram(ticker: string): string {
    const code = ticker.split('.')[0] ?? ticker;

    return code.slice(0, 4);
}

export function StockHeader({
    entity,
    typeLabel,
}: {
    entity: Entity;
    typeLabel: string;
}) {
    const ticker = entity.ticker;

    const [data, setData] = useState<{
        ticker: string;
        quote: PriceQuote | null;
        fundamentals: PriceFundamentals | null;
    } | null>(null);

    useEffect(() => {
        if (!ticker) {
            return;
        }

        let active = true;

        Promise.all([fetchQuote(ticker), fetchFundamentals(ticker)]).then(
            ([quote, fundamentals]) => {
                if (active) {
                    setData({ ticker, quote, fundamentals });
                }
            },
        );

        return () => {
            active = false;
        };
    }, [ticker]);

    const ready = ticker !== null && data !== null && data.ticker === ticker;
    const quote = ready ? data.quote : null;
    const fundamentals = ready ? data.fundamentals : null;

    const up = quote ? quote.change >= 0 : true;
    const currencyCode = fundamentals?.currencyCode ?? 'USD';

    return (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
                <Avatar className="size-14 rounded-md border bg-background">
                    {fundamentals?.logoUrl && (
                        <AvatarImage
                            src={fundamentals.logoUrl}
                            alt={`${entity.name} logo`}
                            className="object-contain p-1"
                        />
                    )}
                    <AvatarFallback className="rounded-md text-sm font-semibold tracking-tight">
                        {ticker
                            ? tickerMonogram(ticker)
                            : entity.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                            {entity.name}
                        </h1>
                        {ticker && (
                            <Badge
                                variant="outline"
                                className="font-mono text-xs"
                            >
                                {ticker}
                            </Badge>
                        )}
                        <Badge variant="secondary" className="capitalize">
                            {typeLabel}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {ready && fundamentals ? (
                            <>
                                {fundamentals.exchange}
                                {fundamentals.country &&
                                    ` · ${fundamentals.country}`}
                            </>
                        ) : ticker ? (
                            <Skeleton className="inline-block h-4 w-40 align-middle" />
                        ) : null}
                    </p>
                </div>
            </div>

            {ticker && (
                <div className="shrink-0 text-left sm:text-right">
                    {ready && quote ? (
                        <>
                            <div className="flex items-baseline gap-2 sm:justify-end">
                                <span className="text-2xl font-bold tabular-nums">
                                    {formatCurrency(quote.close, currencyCode)}
                                </span>
                                <span
                                    className={cn(
                                        'text-sm font-medium tabular-nums',
                                        up
                                            ? PRICE_TEXT_CLASS.up
                                            : PRICE_TEXT_CLASS.down,
                                    )}
                                >
                                    {formatSignedPercent(quote.change_p)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                As of {formatUnixDateTime(quote.timestamp)}
                            </p>
                        </>
                    ) : (
                        <div className="space-y-1.5 sm:flex sm:flex-col sm:items-end">
                            <Skeleton className="h-8 w-32" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
