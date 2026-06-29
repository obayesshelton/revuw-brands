import { ChevronLeft, ChevronRight, Youtube } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { SENTIMENT_HEX, tickerColor } from '@/lib/colors';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { fetchVideoTranscript } from '@/lib/videos';
import type {
    TranscriptSegment,
    Video,
    VideoMention,
    VideoTranscript,
} from '@/types/investor';
import { ChatterRow } from './chatter-row';
import { MentionChipRow } from './mention-chip-row';

interface YouTubeCardProps {
    video: Video;
    activeTicker?: string;
}

type TranscriptState = VideoTranscript | null | 'loading' | 'error';

export function YouTubeCard({ video, activeTicker }: YouTubeCardProps) {
    const [isOpen, setOpen] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptState>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
    const [pos, setPos] = useState(0);
    const transcriptRef = useRef<HTMLDivElement>(null);

    const expand = useCallback(
        (ticker?: string | null) => {
            const next = ticker !== undefined ? ticker : selectedTicker;
            setOpen(true);

            if (next !== undefined) {
                setSelectedTicker(next);
                setPos(0);
            }

            if (transcript === null) {
                setTranscript('loading');
                fetchVideoTranscript(video.id)
                    .then((t) => setTranscript(t ?? 'error'))
                    .catch(() => setTranscript('error'));
            }
        },
        [transcript, video.id, selectedTicker],
    );

    const handleToggle = useCallback(() => {
        if (isOpen) {
            setOpen(false);

            return;
        }

        // First-open preselect from activeTicker if it matches a mention.
        const preselect =
            activeTicker &&
            video.mentionSummary.some(
                (m) => (m.ticker ?? m.entity.name) === activeTicker,
            )
                ? activeTicker
                : null;
        expand(preselect);
    }, [isOpen, expand, activeTicker, video.mentionSummary]);

    const handleChipSelect = useCallback(
        (ticker: string | null) => {
            // Toggle off when reselected.
            setSelectedTicker((cur) => (cur === ticker ? null : ticker));
            setPos(0);
        },
        [],
    );

    const handleRowChipClick = useCallback(
        (ticker: string) => {
            expand(ticker);
        },
        [expand],
    );

    const loaded =
        transcript !== null &&
        transcript !== 'loading' &&
        transcript !== 'error'
            ? transcript
            : null;

    const navList = useMemo<VideoMention[]>(() => {
        if (!loaded || loaded.kind !== 'timestamped') {
return [];
}

        if (selectedTicker === null) {
return loaded.mentions;
}

        return loaded.mentions.filter(
            (m) =>
                (m.ticker ?? m.entity.name) === selectedTicker,
        );
    }, [loaded, selectedTicker]);

    const current = navList[Math.min(pos, navList.length - 1)] ?? null;

    // Auto-scroll the transcript to the current segment whenever selection
    // or position changes.
    useEffect(() => {
        if (!current || !transcriptRef.current) {
return;
}

        const el = transcriptRef.current.querySelector(
            `[data-ts="${current.timestamp}"]`,
        );

        if (el instanceof HTMLElement) {
            transcriptRef.current.scrollTo({
                top: el.offsetTop - 12,
                behavior: 'smooth',
            });
        }
    }, [current]);

    return (
        <Collapsible open={isOpen} onOpenChange={setOpen}>
            <ChatterRow
                video={video}
                leadingVisual={
                    <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-muted sm:w-28">
                        <img
                            src={video.thumbnail}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover"
                        />
                        <span className="absolute right-1 bottom-1 rounded bg-black/80 px-1 text-[10px] font-medium text-white">
                            {formatDuration(video.platformInfo.duration)}
                        </span>
                    </div>
                }
                sourceIcon={<Youtube className="size-3.5" aria-hidden />}
                isOpen={isOpen}
                onToggle={handleToggle}
                onChipClick={handleRowChipClick}
                activeTicker={selectedTicker}
            />

            <CollapsibleContent>
                <div className="border-t bg-card pt-3 pb-4">
                    {transcript === 'loading' && <LoadingSkeleton />}
                    {transcript === 'error' && (
                        <p className="px-4 py-6 text-sm text-muted-foreground">
                            Could not load transcript. Try collapsing and
                            opening this row again.
                        </p>
                    )}
                    {loaded && loaded.kind === 'timestamped' && (
                        <TimestampedExpanded
                            video={video}
                            transcript={loaded}
                            selectedTicker={selectedTicker}
                            onSelect={handleChipSelect}
                            navList={navList}
                            pos={pos}
                            setPos={setPos}
                            current={current}
                            transcriptRef={transcriptRef}
                        />
                    )}
                    {loaded && loaded.kind === 'prose' && (
                        <p className="px-4 py-6 text-sm text-muted-foreground">
                            This YouTube video has no cited transcript yet.
                        </p>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function LoadingSkeleton() {
    return (
        <div className="space-y-3 px-4">
            <Skeleton className="h-7 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
        </div>
    );
}

interface TimestampedExpandedProps {
    video: Video;
    transcript: Extract<VideoTranscript, { kind: 'timestamped' }>;
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
    navList: VideoMention[];
    pos: number;
    setPos: (p: number) => void;
    current: VideoMention | null;
    transcriptRef: React.RefObject<HTMLDivElement | null>;
}

function TimestampedExpanded({
    video,
    transcript,
    selectedTicker,
    onSelect,
    navList,
    pos,
    setPos,
    current,
    transcriptRef,
}: TimestampedExpandedProps) {
    const duration = video.platformInfo.duration;

    return (
        <div className="space-y-2">
            <MentionChipRow
                mentions={video.mentionSummary}
                selectedTicker={selectedTicker}
                onSelect={onSelect}
            />

            <JumpBar
                current={current}
                pos={pos}
                total={navList.length}
                onPrev={() => setPos(Math.max(0, pos - 1))}
                onNext={() => setPos(Math.min(navList.length - 1, pos + 1))}
            />

            <MentionRail
                mentions={transcript.mentions}
                duration={duration}
                selectedTicker={selectedTicker}
                current={current}
                onJump={(idx) => {
                    const mention = transcript.mentions[idx];
                    const ticker = mention.ticker ?? mention.entity.name;
                    const filtered =
                        selectedTicker === null
                            ? transcript.mentions
                            : transcript.mentions.filter(
                                  (m) =>
                                      (m.ticker ?? m.entity.name) ===
                                      selectedTicker,
                              );
                    const newPos = filtered.indexOf(mention);

                    if (newPos === -1) {
                        // Selected ticker doesn't match — switch to this mention's ticker.
                        onSelect(ticker);
                    } else {
                        setPos(newPos);
                    }
                }}
            />

            <Transcript
                ref={transcriptRef}
                segments={transcript.segments}
                mentions={transcript.mentions}
                selectedTicker={selectedTicker}
                current={current}
                onTokenClick={(mentionIdx) => {
                    const mention = transcript.mentions[mentionIdx];
                    const ticker = mention.ticker ?? mention.entity.name;

                    if (selectedTicker === ticker) {
                        const filtered = transcript.mentions.filter(
                            (m) =>
                                (m.ticker ?? m.entity.name) === selectedTicker,
                        );
                        setPos(filtered.indexOf(mention));
                    } else {
                        onSelect(ticker);
                    }
                }}
            />
        </div>
    );
}

function JumpBar({
    current,
    pos,
    total,
    onPrev,
    onNext,
}: {
    current: VideoMention | null;
    pos: number;
    total: number;
    onPrev: () => void;
    onNext: () => void;
}) {
    const tickerLabel = current
        ? (current.ticker ?? current.entity.name)
        : '—';
    const timeLabel = current ? formatDuration(current.timestamp ?? 0) : '0:00';
    const swatch = current
        ? tickerColor(current.ticker ?? current.entity.name)
        : { fg: 'currentColor', bg: 'transparent' };

    return (
        <div className="flex items-center justify-between border-t border-b bg-muted/20 px-3 py-1.5 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
                <span>Jump to mention</span>
                {current && (
                    <span
                        className="inline-flex items-center gap-1.5 font-semibold"
                        style={{ color: swatch.fg }}
                    >
                        <span
                            className="size-1.5 rounded-full"
                            style={{ background: swatch.fg }}
                            aria-hidden
                        />
                        {tickerLabel} · {timeLabel}
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2">
                <span className="tabular-nums text-muted-foreground">
                    {total === 0 ? 0 : pos + 1} / {total}
                </span>
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={total === 0 || pos === 0}
                    className="rounded-md border bg-background p-1 disabled:opacity-40"
                    aria-label="Previous mention"
                >
                    <ChevronLeft className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={total === 0 || pos >= total - 1}
                    className="rounded-md border bg-background p-1 disabled:opacity-40"
                    aria-label="Next mention"
                >
                    <ChevronRight className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

function MentionRail({
    mentions,
    duration,
    selectedTicker,
    current,
    onJump,
}: {
    mentions: VideoMention[];
    duration: number;
    selectedTicker: string | null;
    current: VideoMention | null;
    onJump: (mentionIdx: number) => void;
}) {
    return (
        <div className="relative mx-3 h-6">
            <div className="absolute top-2.5 right-0 left-0 h-1 rounded-full bg-muted" />
            {mentions.map((m, idx) => {
                if (m.timestamp === null) {
return null;
}

                const tickerLabel = m.ticker ?? m.entity.name;
                const dim =
                    selectedTicker !== null && selectedTicker !== tickerLabel;
                const isCurrent = current === m;
                const swatch = tickerColor(tickerLabel);
                const size = isCurrent ? 12 : 8;
                const top = 11 - (size - 3) / 2;
                const left = (m.timestamp / duration) * 100;

                return (
                    <button
                        type="button"
                        key={idx}
                        onClick={() => onJump(idx)}
                        title={`${tickerLabel} · ${formatDuration(m.timestamp)}`}
                        className="absolute rounded-full"
                        style={{
                            top,
                            left: `${left}%`,
                            width: size,
                            height: size,
                            marginLeft: -size / 2,
                            background: swatch.fg,
                            opacity: dim ? 0.25 : 1,
                            boxShadow: isCurrent
                                ? `0 0 0 3px ${swatch.bg}, 0 0 0 4px ${swatch.fg}`
                                : '0 0 0 2px var(--background)',
                            zIndex: isCurrent ? 2 : 1,
                        }}
                    />
                );
            })}
            <span className="absolute top-4 left-0 text-[10px] text-muted-foreground">
                0:00
            </span>
            <span className="absolute top-4 right-0 text-[10px] text-muted-foreground">
                {formatDuration(duration)}
            </span>
        </div>
    );
}

interface TranscriptProps {
    segments: TranscriptSegment[];
    mentions: VideoMention[];
    selectedTicker: string | null;
    current: VideoMention | null;
    onTokenClick: (mentionIdx: number) => void;
}

const Transcript = ({
    ref,
    segments,
    mentions,
    selectedTicker,
    current,
    onTokenClick,
}: TranscriptProps & { ref: React.Ref<HTMLDivElement> }) => {
    const currentTs = current?.timestamp ?? null;

    return (
        <div
            ref={ref}
            className="mx-3 max-h-96 overflow-y-auto rounded-md border bg-background"
        >
            {segments.map((seg, idx) => {
                const isCurrent = currentTs !== null && seg.timestamp === currentTs;
                const swatch = current
                    ? tickerColor(current.ticker ?? current.entity.name)
                    : null;

                return (
                    <div
                        key={idx}
                        data-ts={seg.timestamp}
                        className={cn(
                            'flex gap-3 px-3 py-2 text-sm leading-relaxed',
                            isCurrent && 'bg-muted/40',
                        )}
                        style={
                            isCurrent && swatch
                                ? { boxShadow: `inset 3px 0 0 ${swatch.fg}` }
                                : undefined
                        }
                    >
                        <span className="w-10 shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                            {formatDuration(seg.timestamp)}
                        </span>
                        <span className="flex-1 text-foreground/90">
                            {seg.tokens.map((tok, ti) => {
                                if (tok.kind === 'text') {
                                    return <span key={ti}>{tok.text}</span>;
                                }

                                const mention =
                                    tok.mentionIndex !== undefined
                                        ? mentions[tok.mentionIndex]
                                        : null;

                                if (!mention) {
                                    return <span key={ti}>{tok.text}</span>;
                                }

                                const tickerLabel =
                                    mention.ticker ?? mention.entity.name;
                                const dim =
                                    selectedTicker !== null &&
                                    selectedTicker !== tickerLabel;
                                const sw = tickerColor(tickerLabel);
                                const isCurrentToken = mention === current;

                                return (
                                    <button
                                        key={ti}
                                        type="button"
                                        onClick={() =>
                                            tok.mentionIndex !== undefined &&
                                            onTokenClick(tok.mentionIndex)
                                        }
                                        className={cn(
                                            'mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors',
                                            dim && 'bg-muted text-muted-foreground',
                                        )}
                                        style={
                                            dim
                                                ? undefined
                                                : {
                                                      background: sw.bg,
                                                      color: sw.fg,
                                                      boxShadow:
                                                          isCurrentToken
                                                              ? `0 0 0 2px ${sw.fg}`
                                                              : undefined,
                                                  }
                                        }
                                    >
                                        <span
                                            className="size-1.5 rounded-full"
                                            style={{
                                                background:
                                                    SENTIMENT_HEX[
                                                        mention.sentiment
                                                    ],
                                            }}
                                            aria-hidden
                                        />
                                        {tok.text}
                                    </button>
                                );
                            })}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};
