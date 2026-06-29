import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Badge } from '@/components/ui/badge';
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
    PRICE_HEX,
    SENTIMENT_HEX,
    SOURCE_HEX,
    SOURCE_LABEL,
} from '@/lib/colors';
import { fetchHistory } from '@/lib/eodhd';
import { formatSignedPercent } from '@/lib/format';
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
 * Rolling 7-day net sentiment vs rolling 7-day price return. A horizontal
 * strip below the lines colours each day as consensus / divergence / no
 * signal — the divergence runs are the analyst's "potentially mispriced"
 * candidates.
 *
 * Self-contained: fetches its own candles. Delete this file (and its single
 * import on the stocks research page) to retire the feature.
 */

const RANGES: PriceRange[] = ['3m', '6m', '1y'];
const WINDOW = 7;
const SENT_NEUTRAL_EPS = 0.05;
const RET_NEUTRAL_EPS = 0.005;

type State = 'agree' | 'diverge' | 'neutral';

const STATE_COLOR: Record<State, string> = {
    agree: PRICE_HEX.up,
    diverge: SENTIMENT_HEX.neutral,
    neutral: 'var(--muted-foreground)',
};

const STATE_LABEL: Record<State, string> = {
    agree: 'Consensus',
    diverge: 'Divergence',
    neutral: 'No signal',
};

// SVG layout — fixed viewBox, scales by CSS width.
const VB = { w: 900, h: 340 };
const PX0 = 56;
const PX1 = 880;
const PY0 = 18;
const PY1 = 210;
const STRIP_LABEL_Y = 234;
const STRIP_Y = 244;
const STRIP_H = 22;
const DATE_Y = 286;
const TIP_W = 196;
const TIP_H = 100;

interface DailyRow {
    date: string;
    close: number;
    posMentions: number;
    negMentions: number;
    totalMentions: number;
}

interface DivergencePoint {
    date: string;
    close: number;
    rollRet: number; // rolling % return over window
    rollNet: number; // net sentiment in [-1, 1] over window
    state: State;
}

function buildDaily(candles: PriceCandle[], videos: Video[]): DailyRow[] {
    const counts = new Map<
        string,
        { pos: number; neg: number; total: number }
    >();

    for (const video of videos) {
        const day = video.publishedAt.slice(0, 10);
        const entry = counts.get(day) ?? { pos: 0, neg: 0, total: 0 };

        if (video.entitySentiment === 'positive') {
            entry.pos++;
        } else if (video.entitySentiment === 'negative') {
            entry.neg++;
        }

        entry.total++;
        counts.set(day, entry);
    }

    return candles.map((candle) => {
        const entry = counts.get(candle.date) ?? {
            pos: 0,
            neg: 0,
            total: 0,
        };

        return {
            date: candle.date,
            close: candle.close,
            posMentions: entry.pos,
            negMentions: entry.neg,
            totalMentions: entry.total,
        };
    });
}

function buildPoints(rows: DailyRow[], windowDays: number): DivergencePoint[] {
    return rows.map((row, i) => {
        const from = Math.max(0, i - windowDays + 1);
        let pos = 0;
        let neg = 0;
        let total = 0;

        for (let j = from; j <= i; j++) {
            pos += rows[j].posMentions;
            neg += rows[j].negMentions;
            total += rows[j].totalMentions;
        }

        const rollNet = total > 0 ? (pos - neg) / total : 0;
        const anchor = rows[from].close;
        const rollRet =
            anchor !== 0 ? (row.close - anchor) / anchor : 0;

        let state: State;

        if (total === 0 || Math.abs(rollNet) < SENT_NEUTRAL_EPS) {
            state = 'neutral';
        } else if (Math.abs(rollRet) < RET_NEUTRAL_EPS) {
            state = 'neutral';
        } else if (Math.sign(rollNet) === Math.sign(rollRet)) {
            state = 'agree';
        } else {
            state = 'diverge';
        }

        return {
            date: row.date,
            close: row.close,
            rollRet,
            rollNet,
            state,
        };
    });
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

interface Props {
    ticker: string;
    videos: Video[];
    initialRange?: PriceRange;
    windowDays?: number;
    className?: string;
}

export function SentimentDivergenceStrip({
    ticker,
    videos,
    initialRange = '3m',
    windowDays = WINDOW,
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

    const points = useMemo<DivergencePoint[] | null>(() => {
        if (!candles || candles.length < windowDays + 1) {
            return null;
        }

        return buildPoints(buildDaily(candles, videos), windowDays);
    }, [candles, videos, windowDays]);

    const summary = useMemo(() => {
        if (!points) {
            return null;
        }

        let agree = 0;
        let diverge = 0;
        let neutral = 0;

        for (const point of points) {
            if (point.state === 'agree') {
                agree++;
            } else if (point.state === 'diverge') {
                diverge++;
            } else {
                neutral++;
            }
        }

        const total = points.length;
        const current = points[points.length - 1];

        return {
            agreePct: total > 0 ? (agree / total) * 100 : 0,
            divergePct: total > 0 ? (diverge / total) * 100 : 0,
            neutralPct: total > 0 ? (neutral / total) * 100 : 0,
            current,
        };
    }, [points]);

    const sources = useMemo(() => activeSources(videos), [videos]);

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                        <CardTitle className="text-base">
                            Sentiment ↔ Price divergence
                        </CardTitle>
                        <CardDescription>
                            Rolling {windowDays}-day net sentiment against
                            rolling price return. Amber bands flag chatter that
                            disagrees with the tape.
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
                    <Skeleton className="h-9 w-2/3" />
                ) : summary === null ? (
                    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        Not enough price data for a stable divergence read.
                    </div>
                ) : (
                    <SummaryBar summary={summary} />
                )}

                {candles === null ? (
                    <Skeleton className="aspect-[900/340] w-full" />
                ) : !points ? null : (
                    <Body points={points} />
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block h-[3px] w-3.5 rounded-sm"
                            style={{ background: 'var(--primary)' }}
                        />
                        Net sentiment
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block h-[3px] w-3.5 rounded-sm"
                            style={{ background: PRICE_HEX.up }}
                        />
                        Price return
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ background: STATE_COLOR.agree }}
                        />
                        Consensus
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span
                            className="inline-block size-2.5 rounded-sm"
                            style={{ background: STATE_COLOR.diverge }}
                        />
                        Divergence
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}

interface Summary {
    agreePct: number;
    divergePct: number;
    neutralPct: number;
    current: DivergencePoint;
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

function SummaryBar({ summary }: { summary: Summary }) {
    const currentLabel = STATE_LABEL[summary.current.state];

    const currentTone =
        summary.current.state === 'diverge'
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : summary.current.state === 'agree'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : 'border-border bg-muted text-muted-foreground';

    let currentDetail = '';

    if (summary.current.state === 'diverge') {
        currentDetail =
            summary.current.rollNet > 0
                ? 'chatter bullish, price falling'
                : 'chatter bearish, price rising';
    } else if (summary.current.state === 'agree') {
        currentDetail =
            summary.current.rollNet > 0
                ? 'both bullish'
                : 'both bearish';
    } else {
        currentDetail = 'insufficient signal';
    }

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2.5">
            <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 tabular-nums dark:text-emerald-400"
            >
                {summary.agreePct.toFixed(0)}% consensus
            </Badge>
            <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/10 text-amber-700 tabular-nums dark:text-amber-400"
            >
                {summary.divergePct.toFixed(0)}% divergence
            </Badge>
            {summary.neutralPct > 5 && (
                <Badge variant="outline" className="tabular-nums">
                    {summary.neutralPct.toFixed(0)}% no signal
                </Badge>
            )}
            <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <span>Today:</span>
                <Badge variant="outline" className={cn('font-medium', currentTone)}>
                    {currentLabel}
                </Badge>
                <span>· {currentDetail}</span>
            </div>
        </div>
    );
}

function Body({ points }: { points: DivergencePoint[] }) {
    const overlayRef = useRef<SVGRectElement | null>(null);
    const [hover, setHover] = useState<number | null>(null);

    const n = points.length;

    const geom = useMemo(() => {
        if (n === 0) {
            return null;
        }

        const xAt = (i: number) =>
            n === 1 ? PX0 : PX0 + ((PX1 - PX0) * i) / (n - 1);
        const stepW = (PX1 - PX0) / n;
        const midY = (PY0 + PY1) / 2;
        const halfH = (PY1 - PY0) / 2;

        const retMax = Math.max(
            0.02,
            ...points.map((p) => Math.abs(p.rollRet)),
        );

        const retY = (r: number) =>
            midY - (r / retMax) * halfH;
        const sentY = (s: number) => midY - s * halfH;

        const sentPath = points
            .map(
                (p, i) =>
                    `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${sentY(p.rollNet).toFixed(1)}`,
            )
            .join(' ');
        const retPath = points
            .map(
                (p, i) =>
                    `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${retY(p.rollRet).toFixed(1)}`,
            )
            .join(' ');

        const tiles = points.map((p, i) => ({
            key: p.date,
            x: PX0 + i * stepW,
            w: stepW + 0.5,
            state: p.state,
        }));

        // Even date ticks
        const tn = Math.min(7, n);
        const dateTicks = Array.from({ length: tn }, (_, k) => {
            const i =
                tn === 1 ? 0 : Math.round(((n - 1) * k) / (tn - 1));

            return {
                key: points[i].date,
                x: xAt(i),
                label: tickDate(points[i].date),
            };
        });

        const yLabels = [
            { value: retMax, label: formatSignedPercent(retMax * 100) },
            { value: 0, label: '0%' },
            { value: -retMax, label: formatSignedPercent(-retMax * 100) },
        ].map((entry) => ({
            ...entry,
            y: retY(entry.value),
        }));

        const sentYLabels = [
            { value: 1, label: '+1.0' },
            { value: 0, label: '0' },
            { value: -1, label: '−1.0' },
        ].map((entry) => ({ ...entry, y: sentY(entry.value) }));

        return {
            xAt,
            stepW,
            midY,
            retY,
            sentY,
            sentPath,
            retPath,
            tiles,
            dateTicks,
            yLabels,
            sentYLabels,
            retMax,
        };
    }, [points, n]);

    const handleMove = (event: ReactMouseEvent<SVGRectElement>) => {
        if (!overlayRef.current || n === 0) {
            return;
        }

        const rect = overlayRef.current.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const idx = Math.max(
            0,
            Math.min(n - 1, Math.round(ratio * (n - 1))),
        );

        if (idx !== hover) {
            setHover(idx);
        }
    };

    const handleLeave = () => setHover(null);

    if (!geom) {
        return null;
    }

    let tip: {
        x: number;
        tipX: number;
        tipY: number;
        textX: number;
        date: string;
        sent: string;
        ret: string;
        state: State;
        stateColor: string;
    } | null = null;

    if (hover != null && hover < n) {
        const point = points[hover];
        const x = geom.xAt(hover);
        let tipX = x + 14;

        if (tipX + TIP_W > PX1) {
            tipX = x - 14 - TIP_W;
        }

        if (tipX < PX0) {
            tipX = PX0;
        }

        const tipY = Math.max(PY0 + 2, geom.midY - TIP_H - 4);

        tip = {
            x,
            tipX,
            tipY,
            textX: tipX + 14,
            date: fullDate(point.date),
            sent: point.rollNet.toFixed(2),
            ret: formatSignedPercent(point.rollRet * 100),
            state: point.state,
            stateColor: STATE_COLOR[point.state],
        };
    }

    return (
        <svg
            viewBox={`0 0 ${VB.w} ${VB.h}`}
            className="block h-auto w-full overflow-visible"
        >
            {/* Y axis grid + labels (price-return on left) */}
            {geom.yLabels.map((tick) => (
                <g key={`yL-${tick.label}`}>
                    <line
                        x1={PX0}
                        y1={tick.y}
                        x2={PX1}
                        y2={tick.y}
                        stroke="var(--border)"
                        strokeOpacity={tick.value === 0 ? 0.9 : 0.4}
                        strokeDasharray={tick.value === 0 ? '' : '3 3'}
                    />
                    <text
                        x={PX0 - 8}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        fontSize={11}
                        fill={PRICE_HEX.up}
                        fillOpacity={0.85}
                        className="tabular-nums"
                    >
                        {tick.label}
                    </text>
                </g>
            ))}

            {/* Y axis labels (sentiment on right) */}
            {geom.sentYLabels.map((tick) => (
                <text
                    key={`yR-${tick.label}`}
                    x={PX1 + 8}
                    y={tick.y + 3.5}
                    textAnchor="start"
                    fontSize={11}
                    fill="var(--primary)"
                    fillOpacity={0.85}
                    className="tabular-nums"
                >
                    {tick.label}
                </text>
            ))}

            {/* Net sentiment line */}
            <path
                d={geom.sentPath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
            />

            {/* Price-return line */}
            <path
                d={geom.retPath}
                fill="none"
                stroke={PRICE_HEX.up}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeOpacity={0.85}
            />

            {/* Strip label */}
            <text
                x={PX0}
                y={STRIP_LABEL_Y}
                fontSize={10.5}
                fill="var(--muted-foreground)"
                fontWeight={600}
                letterSpacing="0.04em"
            >
                AGREEMENT
            </text>

            {/* Strip tiles */}
            {geom.tiles.map((tile) => (
                <rect
                    key={tile.key}
                    x={tile.x}
                    y={STRIP_Y}
                    width={tile.w}
                    height={STRIP_H}
                    fill={STATE_COLOR[tile.state]}
                    fillOpacity={tile.state === 'neutral' ? 0.18 : 0.92}
                />
            ))}

            {/* Date ticks */}
            {geom.dateTicks.map((tick) => (
                <text
                    key={tick.key}
                    x={tick.x}
                    y={DATE_Y}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--muted-foreground)"
                >
                    {tick.label}
                </text>
            ))}

            {/* Hover */}
            {tip && (
                <g pointerEvents="none">
                    <line
                        x1={tip.x}
                        y1={PY0}
                        x2={tip.x}
                        y2={STRIP_Y + STRIP_H}
                        stroke="var(--muted-foreground)"
                        strokeOpacity={0.5}
                        strokeDasharray="3 3"
                    />
                    <rect
                        x={tip.tipX}
                        y={tip.tipY}
                        width={TIP_W}
                        height={TIP_H}
                        rx={8}
                        fill="var(--popover)"
                        stroke="var(--border)"
                    />
                    <text
                        x={tip.textX}
                        y={tip.tipY + 22}
                        fontSize={11}
                        fill="var(--muted-foreground)"
                    >
                        {tip.date}
                    </text>
                    <text
                        x={tip.textX}
                        y={tip.tipY + 44}
                        fontSize={12.5}
                        fill="var(--popover-foreground)"
                        className="tabular-nums"
                    >
                        Sentiment{' '}
                        <tspan fontWeight={700}>{tip.sent}</tspan>
                    </text>
                    <text
                        x={tip.textX}
                        y={tip.tipY + 62}
                        fontSize={12.5}
                        fill="var(--popover-foreground)"
                        className="tabular-nums"
                    >
                        Return{' '}
                        <tspan fontWeight={700}>{tip.ret}</tspan>
                    </text>
                    <text
                        x={tip.textX}
                        y={tip.tipY + 85}
                        fontSize={11.5}
                        fontWeight={600}
                        fill={tip.stateColor}
                    >
                        {STATE_LABEL[tip.state]}
                    </text>
                </g>
            )}

            {/* Interaction surface (last so it captures the mouse) */}
            <rect
                ref={overlayRef}
                x={PX0}
                y={PY0}
                width={PX1 - PX0}
                height={STRIP_Y + STRIP_H - PY0}
                fill="transparent"
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
                style={{ cursor: 'crosshair' }}
            />
        </svg>
    );
}
