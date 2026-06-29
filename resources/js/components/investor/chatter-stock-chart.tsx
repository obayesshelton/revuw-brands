import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PRICE_HEX, SENTIMENT_HEX, SOURCE_HEX, SOURCE_LABEL } from '@/lib/colors';
import { fetchHistory, PRICE_RANGES } from '@/lib/eodhd';
import {
    formatCompact,
    formatCurrency,
    formatSignedPercent,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    ChatterSource,
    PriceCandle,
    PriceRange,
    Sentiment,
    Video,
} from '@/types/investor';

const SOURCE_ORDER: ChatterSource[] = ['youtube', 'eod_news', 'reddit', 'revuw'];

function emptyCounts(): Record<ChatterSource, number> {
    return { youtube: 0, eod_news: 0, reddit: 0, revuw: 0 };
}

const SENT_LABEL: Record<Sentiment, string> = {
    positive: 'Positive',
    negative: 'Negative',
    neutral: 'Neutral',
};

// SVG coordinate system — fixed viewBox so the chart scales by CSS width.
const VB = { w: 900, h: 430 };
const PX0 = 48;
const PX1 = 884;
const PY0 = 18;
const PY1 = 250;
const SENT_Y = 298;
const SENT_H = 12;
const MENT_BOTTOM = 406;
const MENT_H = 64;
const DATE_Y = 424;
const TIP_W = 178;

interface DayBucket {
    date: string;
    close: number;
    bySource: Record<ChatterSource, number>;
    totalMentions: number;
    sentiment: Sentiment | null;
}

function tickDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}

function fullDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function dominantSentiment(videos: Video[]): Sentiment | null {
    if (videos.length === 0) {
        return null;
    }

    let pos = 0;
    let neg = 0;
    let neu = 0;

    for (const video of videos) {
        if (video.entitySentiment === 'positive') {
            pos++;
        } else if (video.entitySentiment === 'negative') {
            neg++;
        } else {
            neu++;
        }
    }

    if (pos >= neg && pos >= neu && pos > 0) {
        return 'positive';
    }

    if (neg >= pos && neg >= neu && neg > 0) {
        return 'negative';
    }

    return 'neutral';
}

function buildBuckets(candles: PriceCandle[], videos: Video[]): DayBucket[] {
    const byDate = new Map<string, Video[]>();

    for (const video of videos) {
        const day = video.publishedAt.slice(0, 10);
        const list = byDate.get(day);

        if (list) {
            list.push(video);
        } else {
            byDate.set(day, [video]);
        }
    }

    return candles.map((candle) => {
        const dayVideos = byDate.get(candle.date) ?? [];
        const bySource = emptyCounts();

        for (const video of dayVideos) {
            bySource[video.source] = (bySource[video.source] ?? 0) + 1;
        }

        return {
            date: candle.date,
            close: candle.close,
            bySource,
            totalMentions: dayVideos.length,
            sentiment: dominantSentiment(dayVideos),
        };
    });
}

interface HeaderProps {
    last: number;
    change: number;
    changePct: number;
    up: boolean;
    range: PriceRange;
    setRange: (range: PriceRange) => void;
    totalMentions: number;
    activeSources: ChatterSource[];
    showPrice: boolean;
}

function ChartHeader({
    last,
    change,
    changePct,
    up,
    range,
    setRange,
    totalMentions,
    activeSources,
    showPrice,
}: HeaderProps) {
    const color = up ? PRICE_HEX.up : PRICE_HEX.down;
    const sourceLabel =
        activeSources.length === 0
            ? 'mentions'
            : activeSources.length === 1
              ? `${SOURCE_LABEL[activeSources[0]]} mentions`
              : `mentions · ${activeSources.map((s) => SOURCE_LABEL[s]).join(' + ')}`;

    return (
        <div className="flex flex-wrap items-end gap-3">
            {showPrice ? (
                <div className="min-h-12">
                    <div className="text-3xl font-bold tabular-nums">
                        {formatCurrency(last)}
                    </div>
                    <div
                        className="text-sm font-medium tabular-nums"
                        style={{ color }}
                    >
                        {up ? '▲' : '▼'} {formatCurrency(Math.abs(change))} (
                        {formatSignedPercent(changePct)}) ·{' '}
                        {range.toUpperCase()}
                        <span className="ml-2 text-muted-foreground">
                            · {formatCompact(totalMentions)} {sourceLabel}
                        </span>
                    </div>
                </div>
            ) : (
                <div className="text-xs text-muted-foreground tabular-nums">
                    {formatCompact(totalMentions)} {sourceLabel} ·{' '}
                    {range.toUpperCase()}
                </div>
            )}
            <ToggleGroup
                type="single"
                value={range}
                onValueChange={(value) =>
                    value && setRange(value as PriceRange)
                }
                variant="outline"
                size="sm"
                className="ml-auto"
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
    );
}

function Legend({
    accent,
    activeSources,
}: {
    accent: string;
    activeSources: ChatterSource[];
}) {
    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
                <span
                    className="inline-block h-[3px] w-3.5 rounded-sm"
                    style={{ background: accent }}
                />
                Price
            </span>
            {activeSources.map((source) => (
                <span
                    key={source}
                    className="inline-flex items-center gap-1.5"
                >
                    <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ background: SOURCE_HEX[source] }}
                    />
                    {SOURCE_LABEL[source]}
                </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
                <span className="inline-flex gap-0.5">
                    <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ background: SENTIMENT_HEX.positive }}
                    />
                    <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ background: SENTIMENT_HEX.neutral }}
                    />
                    <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ background: SENTIMENT_HEX.negative }}
                    />
                </span>
                Sentiment
            </span>
        </div>
    );
}

interface ChartBodyProps {
    data: DayBucket[];
    accent: string;
    first: number;
}

function ChartBody({ data, accent, first }: ChartBodyProps) {
    const overlayRef = useRef<SVGRectElement | null>(null);
    const [hover, setHover] = useState<number | null>(null);

    const n = data.length;

    const geom = useMemo(() => {
        if (n === 0) {
            return null;
        }

        const xAt = (i: number) =>
            n === 1 ? PX0 : PX0 + ((PX1 - PX0) * i) / (n - 1);
        const stepW = (PX1 - PX0) / n;

        const prices = data.map((d) => d.close);
        let pmin = Math.min(...prices);
        let pmax = Math.max(...prices);
        const pad = (pmax - pmin) * 0.12 || 1;
        pmin -= pad;
        pmax += pad;
        const yAt = (p: number) =>
            PY1 - ((p - pmin) / (pmax - pmin)) * (PY1 - PY0);

        const mmax = Math.max(1, ...data.map((d) => d.totalMentions));
        const mH = (v: number) => (v / mmax) * MENT_H;

        const points = data
            .map((d, i) => `${xAt(i).toFixed(1)},${yAt(d.close).toFixed(1)}`)
            .join(' ');

        const path =
            data
                .map(
                    (d, i) =>
                        `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(d.close).toFixed(1)}`,
                )
                .join(' ') +
            ` L${xAt(n - 1).toFixed(1)} ${PY1} L${xAt(0).toFixed(1)} ${PY1} Z`;

        const yTicks = Array.from({ length: 4 }, (_, k) => {
            const p = pmin + ((pmax - pmin) * k) / 3;
            const y = yAt(p);

            return { y, label: formatCurrency(p) };
        });

        // Sentiment and mention bars share a band-based x system, so each day
        // occupies the same column across both rows and they stay aligned as
        // the timeframe (and therefore stepW) changes.
        const tileX = (i: number) => PX0 + i * stepW;
        const tileW = stepW + 0.6;

        const sentStrip = data.flatMap((d, i) =>
            d.sentiment
                ? [
                      {
                          key: d.date,
                          x: tileX(i),
                          w: tileW,
                          color: SENTIMENT_HEX[d.sentiment],
                      },
                  ]
                : [],
        );

        const bars = data.flatMap((d, i) => {
            if (d.totalMentions === 0) {
                return [];
            }

            const segments: {
                key: string;
                x: number;
                w: number;
                y: number;
                h: number;
                color: string;
            }[] = [];
            let topY = MENT_BOTTOM;

            for (const source of SOURCE_ORDER) {
                const count = d.bySource[source];

                if (count === 0) {
                    continue;
                }

                const h = mH(count);
                topY -= h;
                segments.push({
                    key: `${d.date}-${source}`,
                    x: tileX(i),
                    w: tileW,
                    y: topY,
                    h,
                    color: SOURCE_HEX[source],
                });
            }

            return segments;
        });

        // Top 5 mention spikes, marked as rings on the price line.
        const spikeIdxs = data
            .map((_, i) => i)
            .filter((i) => data[i].totalMentions > 0)
            .sort((a, b) => data[b].totalMentions - data[a].totalMentions)
            .slice(0, 5);

        const spikes = spikeIdxs.map((i) => ({
            key: data[i].date,
            cx: xAt(i),
            cy: yAt(data[i].close),
            color: data[i].sentiment
                ? SENTIMENT_HEX[data[i].sentiment]
                : SENTIMENT_HEX.neutral,
        }));

        // Even date ticks across the visible range.
        const tn = Math.min(6, n);
        const dateTicks = Array.from({ length: tn }, (_, k) => {
            const i = tn === 1 ? 0 : Math.round(((n - 1) * k) / (tn - 1));

            return {
                key: data[i].date,
                x: xAt(i),
                label: tickDate(data[i].date),
            };
        });

        const firstY = yAt(first);

        return {
            xAt,
            yAt,
            stepW,
            points,
            path,
            yTicks,
            sentStrip,
            bars,
            spikes,
            dateTicks,
            firstY,
        };
    }, [data, n, first]);

    const handleMove = (event: ReactMouseEvent<SVGRectElement>) => {
        if (!overlayRef.current || n === 0) {
            return;
        }

        const rect = overlayRef.current.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const idx = Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1))));

        if (idx !== hover) {
            setHover(idx);
        }
    };

    const handleLeave = () => setHover(null);

    if (!geom) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Price data unavailable.
            </div>
        );
    }

    let tip: {
        x: number;
        dotY: number;
        tipX: number;
        tipY: number;
        tipH: number;
        textX: number;
        date: string;
        price: string;
        total: number;
        sourceBreakdown: { label: string; count: number; color: string }[];
        sent: string | null;
        sentColor: string;
    } | null = null;

    if (hover != null && hover < n) {
        const bucket = data[hover];
        const x = geom.xAt(hover);
        const dotY = geom.yAt(bucket.close);
        let tipX = x + 14;

        if (tipX + TIP_W > PX1) {
            tipX = x - 14 - TIP_W;
        }

        if (tipX < PX0) {
            tipX = PX0;
        }

        const sourceBreakdown = SOURCE_ORDER.filter(
            (source) => bucket.bySource[source] > 0,
        ).map((source) => ({
            label: SOURCE_LABEL[source],
            count: bucket.bySource[source],
            color: SOURCE_HEX[source],
        }));

        // Tip grows to fit: header (date+price) + one row per source + sentiment.
        const tipH =
            54 +
            Math.max(sourceBreakdown.length, 1) * 18 +
            (bucket.sentiment ? 22 : 6);

        const tipY = Math.max(PY0 + 2, dotY - tipH - 8);

        tip = {
            x,
            dotY,
            tipX,
            tipY,
            tipH,
            textX: tipX + 14,
            date: fullDate(bucket.date),
            price: formatCurrency(bucket.close),
            total: bucket.totalMentions,
            sourceBreakdown,
            sent: bucket.sentiment ? SENT_LABEL[bucket.sentiment] : null,
            sentColor: bucket.sentiment
                ? SENTIMENT_HEX[bucket.sentiment]
                : SENTIMENT_HEX.neutral,
        };
    }

    return (
        <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            className="block h-auto w-full overflow-visible"
        >
            <defs>
                <linearGradient id="csc-price-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                </linearGradient>
            </defs>

            {/* Price grid */}
            {geom.yTicks.map((tick) => (
                <g key={tick.label}>
                    <line
                        x1={PX0}
                        y1={tick.y}
                        x2={PX1}
                        y2={tick.y}
                        stroke="var(--border)"
                        strokeOpacity={0.6}
                    />
                    <text
                        x={PX0 - 8}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        fontSize={11}
                        fill="var(--muted-foreground)"
                    >
                        {tick.label}
                    </text>
                </g>
            ))}

            {/* Open-price reference line */}
            <line
                x1={PX0}
                y1={geom.firstY}
                x2={PX1}
                y2={geom.firstY}
                stroke="var(--muted-foreground)"
                strokeOpacity={0.4}
                strokeDasharray="4 4"
            />

            {/* Price area + line */}
            <path d={geom.path} fill="url(#csc-price-fill)" />
            <polyline
                points={geom.points}
                fill="none"
                stroke={accent}
                strokeWidth={2.4}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Mention spike markers */}
            {geom.spikes.map((s) => (
                <circle
                    key={s.key}
                    cx={s.cx}
                    cy={s.cy}
                    r={4.5}
                    fill="var(--background)"
                    stroke={s.color}
                    strokeWidth={2.5}
                />
            ))}

            {/* Sentiment band */}
            <text
                x={PX0}
                y={SENT_Y - 7}
                fontSize={10.5}
                fill="var(--muted-foreground)"
                fontWeight={600}
                letterSpacing="0.04em"
            >
                SENTIMENT
            </text>
            {geom.sentStrip.map((c) => (
                <rect
                    key={c.key}
                    x={c.x}
                    y={SENT_Y}
                    width={c.w}
                    height={SENT_H}
                    fill={c.color}
                />
            ))}

            {/* Mentions band */}
            <text
                x={PX0}
                y={SENT_Y + SENT_H + 22}
                fontSize={10.5}
                fill="var(--muted-foreground)"
                fontWeight={600}
                letterSpacing="0.04em"
            >
                MENTIONS / DAY
            </text>
            {geom.bars.map((b) => (
                <rect
                    key={b.key}
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    fill={b.color}
                    fillOpacity={0.92}
                />
            ))}

            {/* Date ticks */}
            {geom.dateTicks.map((d) => (
                <text
                    key={d.key}
                    x={d.x}
                    y={DATE_Y}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--muted-foreground)"
                >
                    {d.label}
                </text>
            ))}

            {/* Hover */}
            {tip && (
                <g pointerEvents="none">
                    <line
                        x1={tip.x}
                        y1={PY0}
                        x2={tip.x}
                        y2={MENT_BOTTOM}
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.5}
                        strokeDasharray="3 3"
                    />
                    <circle
                        cx={tip.x}
                        cy={tip.dotY}
                        r={5}
                        fill={accent}
                        stroke="var(--background)"
                        strokeWidth={2}
                    />
                    <rect
                        x={tip.tipX}
                        y={tip.tipY}
                        width={TIP_W}
                        height={tip.tipH}
                        rx={8}
                        fill="var(--popover)"
                        stroke="var(--border)"
                    />
                    <text
                        x={tip.textX}
                        y={tip.tipY + 20}
                        fontSize={11}
                        fill="var(--muted-foreground)"
                    >
                        {tip.date}
                    </text>
                    <text
                        x={tip.textX}
                        y={tip.tipY + 44}
                        fontSize={16}
                        fontWeight={700}
                        fill="var(--popover-foreground)"
                    >
                        {tip.price}
                    </text>
                    {tip.sourceBreakdown.length === 0 ? (
                        <text
                            x={tip.textX}
                            y={tip.tipY + 62}
                            fontSize={11.5}
                            fill="var(--muted-foreground)"
                        >
                            No chatter today
                        </text>
                    ) : (
                        tip.sourceBreakdown.map((source, i) => (
                            <text
                                key={source.label}
                                x={tip.textX}
                                y={tip.tipY + 62 + i * 18}
                                fontSize={11.5}
                                fill="var(--popover-foreground)"
                            >
                                <tspan fill={source.color}>●</tspan>
                                <tspan dx={6}>{source.label}</tspan>
                                <tspan
                                    dx={8}
                                    fontWeight={600}
                                    className="tabular-nums"
                                >
                                    {source.count}
                                </tspan>
                            </text>
                        ))
                    )}
                    {tip.sent && (
                        <text
                            x={tip.textX}
                            y={
                                tip.tipY +
                                62 +
                                Math.max(tip.sourceBreakdown.length, 1) * 18 +
                                14
                            }
                            fontSize={11.5}
                            fontWeight={600}
                            fill={tip.sentColor}
                        >
                            {tip.sent}
                        </text>
                    )}
                </g>
            )}

            {/* Interaction surface (last so it captures mouse) */}
            <rect
                ref={overlayRef}
                x={PX0}
                y={PY0}
                width={PX1 - PX0}
                height={MENT_BOTTOM - PY0}
                fill="transparent"
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                style={{ cursor: 'crosshair' }}
            />
        </svg>
    );
}

interface Props {
    ticker: string;
    videos: Video[];
    initialRange?: PriceRange;
    className?: string;
    showPrice?: boolean;
}

export function ChatterStockChart({
    ticker,
    videos,
    initialRange = '3m',
    className,
    showPrice = true,
}: Props) {
    const [range, setRange] = useState<PriceRange>(initialRange);
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

    const data = useMemo<DayBucket[]>(
        () => (candles ? buildBuckets(candles, videos) : []),
        [candles, videos],
    );

    const first = data[0]?.close ?? 0;
    const last = data[data.length - 1]?.close ?? 0;
    const change = last - first;
    const changePct = first !== 0 ? (change / first) * 100 : 0;
    const up = change >= 0;
    const color = up ? PRICE_HEX.up : PRICE_HEX.down;

    const totalMentions = useMemo(
        () => data.reduce((sum, d) => sum + d.totalMentions, 0),
        [data],
    );

    const activeSources = useMemo<ChatterSource[]>(() => {
        const totals = emptyCounts();

        for (const day of data) {
            for (const source of SOURCE_ORDER) {
                totals[source] += day.bySource[source];
            }
        }

        return SOURCE_ORDER.filter((source) => totals[source] > 0);
    }, [data]);

    return (
        <div className={cn('space-y-4', className)}>
            <ChartHeader
                last={last}
                change={change}
                changePct={changePct}
                up={up}
                range={range}
                setRange={setRange}
                totalMentions={totalMentions}
                activeSources={activeSources}
                showPrice={showPrice}
            />

            <Legend accent={color} activeSources={activeSources} />

            <div className="w-full">
                {candles === null ? (
                    <Skeleton className="aspect-[900/430] w-full" />
                ) : (
                    <ChartBody data={data} accent={color} first={first} />
                )}
            </div>
        </div>
    );
}
