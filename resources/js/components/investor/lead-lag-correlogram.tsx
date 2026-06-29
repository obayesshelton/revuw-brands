import { useEffect, useMemo, useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    PRICE_HEX,
    PRICE_TEXT_CLASS,
    SOURCE_HEX,
    SOURCE_LABEL,
} from '@/lib/colors';
import { fetchHistory } from '@/lib/eodhd';
import { cn } from '@/lib/utils';
import type {
    ChatterSource,
    PriceCandle,
    PriceRange,
    Video,
} from '@/types/investor';

const SOURCE_ORDER: ChatterSource[] = ['youtube', 'eod_news', 'reddit', 'revuw'];

function activeSources(videos: Video[]): ChatterSource[] {
    const seen = new Set<ChatterSource>();

    for (const video of videos) {
        seen.add(video.source);
    }

    return SOURCE_ORDER.filter((source) => seen.has(source));
}

/**
 * Cross-correlation between daily YouTube mention volume and daily price
 * returns at lags −7…+7 days. Answers: does coverage *predict* price moves
 * (positive lag), *react* to them (negative lag), or *coincide* (lag 0)?
 *
 * Self-contained: fetches its own candles so it can be dropped onto any page
 * with a ticker + Video[] in hand. If we decide it's not pulling its weight,
 * delete this file and the import — nothing else depends on it.
 */

const RANGES: PriceRange[] = ['3m', '6m', '1y'];
const MAX_LAG = 7;
const STRONG_R = 0.25;
const NOTABLE_R = 0.15;
const MIN_PAIRS = 20;

// SVG layout — fixed viewBox, scales by CSS width.
const VB = { w: 800, h: 280 };
const PX0 = 56;
const PX1 = 770;
const PY0 = 18;
const PY1 = 230;
const AXIS_Y = 252;

interface LagPoint {
    lag: number;
    r: number;
    n: number;
}

function pearson(x: number[], y: number[]): number {
    const n = x.length;

    if (n < 5) {
        return 0;
    }

    let sumX = 0;
    let sumY = 0;

    for (let i = 0; i < n; i++) {
        sumX += x[i];
        sumY += y[i];
    }

    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        num += dx * dy;
        denomX += dx * dx;
        denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);

    return denom === 0 ? 0 : num / denom;
}

function buildSeries(
    candles: PriceCandle[],
    videos: Video[],
): { mentions: number[]; returns: number[] } {
    const byDate = new Map<string, number>();

    for (const video of videos) {
        const day = video.publishedAt.slice(0, 10);

        byDate.set(day, (byDate.get(day) ?? 0) + 1);
    }

    const mentions: number[] = [];
    const returns: number[] = [];

    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];

        mentions.push(byDate.get(candle.date) ?? 0);

        if (i === 0) {
            returns.push(0);
        } else {
            const prev = candles[i - 1].close;

            returns.push(prev !== 0 ? (candle.close - prev) / prev : 0);
        }
    }

    return { mentions, returns };
}

function crossCorrelation(
    mentions: number[],
    returns: number[],
    maxLag: number,
): LagPoint[] {
    const out: LagPoint[] = [];

    for (let lag = -maxLag; lag <= maxLag; lag++) {
        const xs: number[] = [];
        const ys: number[] = [];

        for (let t = 0; t < mentions.length; t++) {
            const j = t + lag;

            // j <= 0 excludes the always-zero first return that would bias r.
            if (j <= 0 || j >= returns.length) {
                continue;
            }

            xs.push(mentions[t]);
            ys.push(returns[j]);
        }

        out.push({ lag, r: pearson(xs, ys), n: xs.length });
    }

    return out;
}

interface Verdict {
    peak: LagPoint;
    headline: string;
    tone: 'strong' | 'notable' | 'weak';
}

function interpret(points: LagPoint[]): Verdict {
    let peak = points[0];

    for (const point of points) {
        if (Math.abs(point.r) > Math.abs(peak.r)) {
            peak = point;
        }
    }

    const mag = Math.abs(peak.r);
    const tone: Verdict['tone'] =
        mag >= STRONG_R ? 'strong' : mag >= NOTABLE_R ? 'notable' : 'weak';

    if (tone === 'weak') {
        return {
            peak,
            tone,
            headline: 'No meaningful correlation between coverage and price',
        };
    }

    let timing: string;

    if (peak.lag > 0) {
        timing = `Coverage leads price by ${peak.lag}d`;
    } else if (peak.lag < 0) {
        timing = `Coverage lags price by ${Math.abs(peak.lag)}d`;
    } else {
        timing = 'Coverage is concurrent with price';
    }

    const polarity =
        peak.r > 0
            ? 'high-mention days saw higher returns'
            : 'high-mention days saw lower returns';

    return { peak, tone, headline: `${timing} · ${polarity}` };
}

interface Props {
    ticker: string;
    videos: Video[];
    initialRange?: PriceRange;
    className?: string;
}

export function LeadLagCorrelogram({
    ticker,
    videos,
    initialRange = '3m',
    className,
}: Props) {
    const [range, setRange] = useState<PriceRange>(initialRange);
    const [state, setState] = useState<{
        key: string;
        candles: PriceCandle[];
    } | null>(null);
    const cacheKey = `${ticker}:${range}`;

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

    const candles = state && state.key === cacheKey ? state.candles : null;

    const lags = useMemo<LagPoint[] | null>(() => {
        if (!candles || candles.length < MIN_PAIRS) {
            return null;
        }

        const { mentions, returns } = buildSeries(candles, videos);

        return crossCorrelation(mentions, returns, MAX_LAG);
    }, [candles, videos]);

    const verdict = useMemo(() => (lags ? interpret(lags) : null), [lags]);
    const sources = useMemo(() => activeSources(videos), [videos]);

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                        <CardTitle className="text-base">
                            Lead/Lag analysis
                        </CardTitle>
                        <CardDescription>
                            Does coverage predict price moves, or chase them?
                        </CardDescription>
                        <SourceChips sources={sources} />
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
                        {RANGES.map((option) => (
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
            </CardHeader>
            <CardContent className="space-y-4">
                {candles === null ? (
                    <Skeleton className="h-16 w-full" />
                ) : verdict === null ? (
                    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        Not enough price data for a stable cross-correlation.
                    </div>
                ) : (
                    <ResultBanner verdict={verdict} window={candles.length} />
                )}

                {candles === null ? (
                    <Skeleton className="aspect-[800/280] w-full" />
                ) : !lags ? null : (
                    <Chart lags={lags} peakLag={verdict?.peak.lag ?? null} />
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ background: PRICE_HEX.up }}
                        />
                        Positive correlation
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ background: PRICE_HEX.down }}
                        />
                        Negative correlation
                    </span>
                    <span>
                        Positive lag = mentions lead · negative lag = mentions
                        react
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

function SourceChips({ sources }: { sources: ChatterSource[] }) {
    if (sources.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Aggregates</span>
            {sources.map((source) => (
                <span
                    key={source}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-0.5"
                >
                    <span
                        className="inline-block size-2 rounded-full"
                        style={{ background: SOURCE_HEX[source] }}
                    />
                    {SOURCE_LABEL[source]}
                </span>
            ))}
        </div>
    );
}

function ResultBanner({
    verdict,
    window,
}: {
    verdict: Verdict;
    window: number;
}) {
    const { peak, tone, headline } = verdict;
    const accentClass =
        tone === 'weak'
            ? 'text-muted-foreground'
            : peak.r > 0
              ? PRICE_TEXT_CLASS.up
              : PRICE_TEXT_CLASS.down;

    return (
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <div className={cn('text-sm font-medium', accentClass)}>
                {headline}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                Peak r = {peak.r >= 0 ? '+' : ''}
                {peak.r.toFixed(2)} at lag {peak.lag >= 0 ? '+' : ''}
                {peak.lag}d · n = {peak.n} pairs · {window}d window
            </div>
        </div>
    );
}

function Chart({
    lags,
    peakLag,
}: {
    lags: LagPoint[];
    peakLag: number | null;
}) {
    const geom = useMemo(() => {
        const yMax =
            Math.max(0.3, ...lags.map((point) => Math.abs(point.r))) * 1.15;
        const stepX = (PX1 - PX0) / (2 * MAX_LAG);
        const midY = (PY0 + PY1) / 2;
        const yAt = (r: number) => midY - (r / yMax) * ((PY1 - PY0) / 2);
        const xAt = (lag: number) =>
            PX0 + ((lag + MAX_LAG) / (2 * MAX_LAG)) * (PX1 - PX0);
        const barW = stepX * 0.62;

        const tickValues = [-yMax, -yMax / 2, 0, yMax / 2, yMax];
        const yTicks = tickValues.map((value) => ({
            value,
            y: yAt(value),
            label: (value > 0 ? '+' : '') + value.toFixed(2),
        }));

        return { yMax, midY, yAt, xAt, barW, yTicks };
    }, [lags]);

    return (
        <TooltipProvider delayDuration={50}>
            <svg
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                className="block h-auto w-full overflow-visible"
            >
                {/* gridlines + y labels */}
                {geom.yTicks.map((tick) => (
                    <g key={tick.label}>
                        <line
                            x1={PX0}
                            y1={tick.y}
                            x2={PX1}
                            y2={tick.y}
                            stroke="var(--border)"
                            strokeOpacity={tick.value === 0 ? 0.9 : 0.45}
                            strokeDasharray={tick.value === 0 ? '' : '3 3'}
                        />
                        <text
                            x={PX0 - 8}
                            y={tick.y + 3.5}
                            textAnchor="end"
                            fontSize={11}
                            fill="var(--muted-foreground)"
                            className="tabular-nums"
                        >
                            {tick.label}
                        </text>
                    </g>
                ))}

                {/* bars */}
                {lags.map((point) => {
                    const x = geom.xAt(point.lag) - geom.barW / 2;
                    const y =
                        point.r >= 0 ? geom.yAt(point.r) : geom.midY;
                    const h = Math.abs(geom.yAt(point.r) - geom.midY);
                    const color =
                        point.r >= 0 ? PRICE_HEX.up : PRICE_HEX.down;
                    const isPeak = point.lag === peakLag;

                    return (
                        <Tooltip key={point.lag}>
                            <TooltipTrigger asChild>
                                <g className="cursor-default">
                                    <rect
                                        x={x}
                                        y={y}
                                        width={geom.barW}
                                        height={Math.max(0.5, h)}
                                        fill={color}
                                        fillOpacity={isPeak ? 1 : 0.7}
                                        stroke={
                                            isPeak ? color : 'transparent'
                                        }
                                        strokeWidth={isPeak ? 1.5 : 0}
                                        rx={2}
                                    />
                                    {/* invisible expanded hit box */}
                                    <rect
                                        x={x - 2}
                                        y={PY0}
                                        width={geom.barW + 4}
                                        height={PY1 - PY0}
                                        fill="transparent"
                                    />
                                </g>
                            </TooltipTrigger>
                            <TooltipContent
                                side="top"
                                className="bg-popover text-popover-foreground border"
                            >
                                <div className="space-y-0.5">
                                    <div className="font-medium tabular-nums">
                                        lag {point.lag >= 0 ? '+' : ''}
                                        {point.lag}d
                                    </div>
                                    <div className="tabular-nums">
                                        r = {point.r >= 0 ? '+' : ''}
                                        {point.r.toFixed(3)}
                                    </div>
                                    <div className="text-muted-foreground">
                                        n = {point.n} pairs
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}

                {/* x axis */}
                {lags.map((point) => (
                    <text
                        key={point.lag}
                        x={geom.xAt(point.lag)}
                        y={AXIS_Y}
                        textAnchor="middle"
                        fontSize={11}
                        fill="var(--muted-foreground)"
                        fontWeight={point.lag === peakLag ? 600 : 400}
                        className="tabular-nums"
                    >
                        {point.lag > 0 ? `+${point.lag}` : point.lag}
                    </text>
                ))}

                <text
                    x={(PX0 + PX1) / 2}
                    y={VB.h - 4}
                    textAnchor="middle"
                    fontSize={10.5}
                    fill="var(--muted-foreground)"
                    fontWeight={600}
                    letterSpacing="0.04em"
                >
                    LAG (DAYS)
                </text>
            </svg>
        </TooltipProvider>
    );
}
