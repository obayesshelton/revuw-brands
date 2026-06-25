import { useEffect, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { fetchHistory, PRICE_RANGES } from '@/lib/eodhd';
import { formatCurrency, formatSignedPercent } from '@/lib/format';
import type { PriceCandle, PriceRange } from '@/types/investor';

const UP = '#10b981'; // emerald-500
const DOWN = '#ef4444'; // red-500

function tickDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

type TooltipPayload = {
    active?: boolean;
    payload?: Array<{ payload: PriceCandle }>;
};

function PriceTooltip({ active, payload }: TooltipPayload) {
    if (!active || !payload || payload.length === 0) {
        return null;
    }

    const candle = payload[0].payload;

    return (
        <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
            <div className="font-semibold">{formatCurrency(candle.close)}</div>
            <div className="text-muted-foreground">{tickDate(candle.date)}</div>
        </div>
    );
}

export function PriceChart({ ticker }: { ticker: string }) {
    const [range, setRange] = useState<PriceRange>('1y');
    const [state, setState] = useState<{
        key: string;
        candles: PriceCandle[];
    } | null>(null);
    const key = `${ticker}:${range}`;

    useEffect(() => {
        let active = true;

        fetchHistory(ticker, range).then((candles) => {
            if (active) {
                setState({ key: `${ticker}:${range}`, candles });
            }
        });

        return () => {
            active = false;
        };
    }, [ticker, range]);

    const candles = state && state.key === key ? state.candles : null;

    const first = candles?.[0]?.close ?? 0;
    const last =
        candles && candles.length > 0 ? candles[candles.length - 1].close : 0;
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;
    const up = change >= 0;
    const color = up ? UP : DOWN;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-h-12">
                    {candles === null ? (
                        <Skeleton className="h-10 w-44" />
                    ) : candles.length > 0 ? (
                        <>
                            <div className="text-3xl font-bold tabular-nums">
                                {formatCurrency(last)}
                            </div>
                            <div
                                className="text-sm font-medium tabular-nums"
                                style={{ color }}
                            >
                                {up ? '▲' : '▼'}{' '}
                                {formatCurrency(Math.abs(change))} (
                                {formatSignedPercent(changePct)}) ·{' '}
                                {range.toUpperCase()}
                            </div>
                        </>
                    ) : null}
                </div>
                <ToggleGroup
                    type="single"
                    value={range}
                    onValueChange={(value) =>
                        value && setRange(value as PriceRange)
                    }
                    variant="outline"
                    size="sm"
                >
                    {PRICE_RANGES.map((option) => (
                        <ToggleGroupItem
                            key={option}
                            value={option}
                            className="uppercase"
                        >
                            {option}
                        </ToggleGroupItem>
                    ))}
                </ToggleGroup>
            </div>

            <div className="h-72 w-full">
                {candles === null ? (
                    <Skeleton className="h-full w-full" />
                ) : candles.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Price data unavailable.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={candles}
                            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                        >
                            <defs>
                                <linearGradient
                                    id="price-fill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={color}
                                        stopOpacity={0.25}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={color}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--border)"
                                strokeOpacity={0.6}
                            />
                            <XAxis
                                dataKey="date"
                                tickFormatter={tickDate}
                                minTickGap={48}
                                tick={{ fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                width={64}
                                orientation="right"
                                tickFormatter={(value: number) =>
                                    formatCurrency(value)
                                }
                                tick={{ fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <ReferenceLine
                                y={first}
                                stroke="var(--muted-foreground)"
                                strokeOpacity={0.4}
                                strokeDasharray="4 4"
                            />
                            <Tooltip content={<PriceTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="close"
                                stroke={color}
                                strokeWidth={2}
                                fill="url(#price-fill)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
