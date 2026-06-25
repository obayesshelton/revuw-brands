import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchQuote } from '@/lib/eodhd';
import { formatCurrency, formatSignedPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PriceQuote } from '@/types/investor';

export function PriceTag({
    ticker,
    size = 'sm',
    className,
}: {
    ticker: string;
    size?: 'sm' | 'lg';
    className?: string;
}) {
    const [state, setState] = useState<{
        ticker: string;
        quote: PriceQuote | null;
    } | null>(null);

    useEffect(() => {
        let active = true;

        fetchQuote(ticker).then((quote) => {
            if (active) {
                setState({ ticker, quote });
            }
        });

        return () => {
            active = false;
        };
    }, [ticker]);

    // Show a skeleton until the fetch for *this* ticker resolves.
    if (state === null || state.ticker !== ticker) {
        return (
            <Skeleton
                className={cn(
                    size === 'lg' ? 'h-8 w-32' : 'h-5 w-24',
                    className,
                )}
            />
        );
    }

    if (state.quote === null) {
        return null;
    }

    const { quote } = state;
    const up = quote.change >= 0;

    return (
        <span className={cn('inline-flex items-baseline gap-2', className)}>
            <span
                className={
                    size === 'lg'
                        ? 'text-2xl font-bold'
                        : 'text-sm font-semibold'
                }
            >
                {formatCurrency(quote.close)}
            </span>
            <span
                className={cn(
                    'text-xs font-medium',
                    up
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                )}
            >
                {formatSignedPercent(quote.change_p)}
            </span>
        </span>
    );
}
