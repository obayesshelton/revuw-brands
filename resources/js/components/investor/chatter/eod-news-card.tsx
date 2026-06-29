import { Newspaper } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Collapsible,
    CollapsibleContent,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useInitials } from '@/hooks/use-initials';
import { SENTIMENT_HEX, tickerColor } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { fetchVideoTranscript } from '@/lib/videos';
import type { Video, VideoMention, VideoTranscript } from '@/types/investor';
import { ChatterRow } from './chatter-row';
import { MentionChipRow } from './mention-chip-row';

interface EodNewsCardProps {
    video: Video;
    activeTicker?: string;
}

type TranscriptState = VideoTranscript | null | 'loading' | 'error';

export function EodNewsCard({ video, activeTicker }: EodNewsCardProps) {
    const [isOpen, setOpen] = useState(false);
    const [transcript, setTranscript] = useState<TranscriptState>(null);
    const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

    const expand = useCallback(
        (ticker?: string | null) => {
            const next = ticker !== undefined ? ticker : selectedTicker;
            setOpen(true);

            if (next !== undefined) {
setSelectedTicker(next);
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

        const preselect =
            activeTicker &&
            video.mentionSummary.some(
                (m) => (m.ticker ?? m.entity.name) === activeTicker,
            )
                ? activeTicker
                : null;
        expand(preselect);
    }, [isOpen, expand, activeTicker, video.mentionSummary]);

    const handleSelect = useCallback((ticker: string | null) => {
        setSelectedTicker((cur) => (cur === ticker ? null : ticker));
    }, []);

    const loaded =
        transcript !== null &&
        transcript !== 'loading' &&
        transcript !== 'error'
            ? transcript
            : null;

    return (
        <Collapsible open={isOpen} onOpenChange={setOpen}>
            <ChatterRow
                video={video}
                leadingVisual={<PublisherLogo video={video} />}
                sourceIcon={<Newspaper className="size-3.5" aria-hidden />}
                isOpen={isOpen}
                onToggle={handleToggle}
                onChipClick={(ticker) => expand(ticker)}
                activeTicker={selectedTicker}
            />

            <CollapsibleContent>
                <div className="border-t bg-card pt-3 pb-4">
                    {transcript === 'loading' && <LoadingSkeleton />}
                    {transcript === 'error' && (
                        <p className="px-4 py-6 text-sm text-muted-foreground">
                            Could not load article. Try collapsing and opening
                            this row again.
                        </p>
                    )}
                    {loaded && loaded.kind === 'prose' && (
                        <ProseExpanded
                            video={video}
                            transcript={loaded}
                            selectedTicker={selectedTicker}
                            onSelect={handleSelect}
                        />
                    )}
                    {loaded && loaded.kind === 'timestamped' && (
                        <p className="px-4 py-6 text-sm text-muted-foreground">
                            Timestamped transcript view is not implemented for
                            this source yet.
                        </p>
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function PublisherLogo({ video }: { video: Video }) {
    const getInitials = useInitials();

    return (
        <Avatar className="size-10 shrink-0 rounded-md">
            <AvatarImage
                src={video.channel.thumbnailUrl}
                alt={video.channel.title}
                className="object-cover"
            />
            <AvatarFallback className="rounded-md text-xs">
                {getInitials(video.channel.title)}
            </AvatarFallback>
        </Avatar>
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

interface ProseExpandedProps {
    video: Video;
    transcript: Extract<VideoTranscript, { kind: 'prose' }>;
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
}

function ProseExpanded({
    video,
    transcript,
    selectedTicker,
    onSelect,
}: ProseExpandedProps) {
    return (
        <div className="space-y-3">
            <MentionChipRow
                mentions={video.mentionSummary}
                selectedTicker={selectedTicker}
                onSelect={onSelect}
            />

            <div className="grid grid-cols-1 gap-3 px-3 md:grid-cols-[1fr_180px]">
                <ProseBody
                    body={transcript.body}
                    mentions={transcript.mentions}
                    selectedTicker={selectedTicker}
                    onSelect={onSelect}
                />
                <MentionSidebar
                    mentions={transcript.mentions}
                    selectedTicker={selectedTicker}
                    onSelect={onSelect}
                />
            </div>
        </div>
    );
}

/**
 * Lightweight markdown renderer for EOD news bodies — handles `## heading`
 * and paragraph blocks separated by blank lines. Scans the prose for tracked
 * entity names + tickers and inlines them as clickable mention pills,
 * mirroring the YouTube transcript token style.
 */
function ProseBody({
    body,
    mentions,
    selectedTicker,
    onSelect,
}: {
    body: string;
    mentions: VideoMention[];
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
}) {
    const blocks = body
        .split(/\n\n+/)
        .map((b) => b.trim())
        .filter(Boolean);

    const renderText = (text: string) => (
        <HighlightedText
            text={text}
            mentions={mentions}
            selectedTicker={selectedTicker}
            onSelect={onSelect}
        />
    );

    return (
        <article className="prose prose-sm max-w-none dark:prose-invert">
            {blocks.map((block, idx) => {
                if (block.startsWith('## ')) {
                    return (
                        <h2 key={idx} className="mt-0 text-base font-semibold">
                            {renderText(block.slice(3))}
                        </h2>
                    );
                }

                return (
                    <p key={idx} className="text-sm leading-relaxed">
                        {renderText(block)}
                    </p>
                );
            })}
        </article>
    );
}

type BodyToken =
    | { kind: 'text'; text: string }
    | { kind: 'mention'; text: string; mentionIndex: number }
    | { kind: 'untracked'; text: string; ticker: string };

function HighlightedText({
    text,
    mentions,
    selectedTicker,
    onSelect,
}: {
    text: string;
    mentions: VideoMention[];
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
}) {
    const tokens = tokenizeBody(text, mentions);

    return (
        <>
            {tokens.map((tok, idx) => {
                if (tok.kind === 'text') {
                    return <span key={idx}>{tok.text}</span>;
                }
                if (tok.kind === 'untracked') {
                    return (
                        <span
                            key={idx}
                            title={`${tok.ticker} — not tracked`}
                            className="mx-0.5 inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground"
                        >
                            {tok.text}
                        </span>
                    );
                }

                const mention = mentions[tok.mentionIndex];
                if (!mention) return <span key={idx}>{tok.text}</span>;

                const tickerLabel = mention.ticker ?? mention.entity.name;
                const dim =
                    selectedTicker !== null && selectedTicker !== tickerLabel;
                const sw = tickerColor(tickerLabel);

                return (
                    <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                            e.preventDefault();
                            onSelect(
                                selectedTicker === tickerLabel
                                    ? null
                                    : tickerLabel,
                            );
                        }}
                        className={cn(
                            'mx-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold transition-colors',
                            dim && 'bg-muted text-muted-foreground',
                        )}
                        style={
                            dim
                                ? undefined
                                : { background: sw.bg, color: sw.fg }
                        }
                    >
                        <span
                            className="size-1.5 rounded-full"
                            style={{
                                background: SENTIMENT_HEX[mention.sentiment],
                            }}
                            aria-hidden
                        />
                        {tok.text}
                    </button>
                );
            })}
        </>
    );
}

// Matches "(NASDAQ: XXX)" / "(NYSE: XXX)" / "(NASDAQGS: XXX)" etc — the
// stock-ticker disclosure form most wire articles use. Captures the ticker
// in group 1 for fallback display.
const EXCHANGE_TICKER_RE =
    /\((?:NASDAQ(?:GS|GM|CM)?|NYSE(?:MKT|ARCA)?|AMEX|OTC):\s*([A-Z][A-Z0-9.-]{0,7})\)/g;

function tokenizeBody(text: string, mentions: VideoMention[]): BodyToken[] {
    // First pass: tracked-mention pills (full color, clickable).
    const firstPass = tokenizeWithMentions(text, mentions);

    // Second pass: expand each remaining text token by pulling out any
    // generic exchange-prefixed ticker that the tracked pass didn't claim.
    const result: BodyToken[] = [];
    const trackedTickers = new Set(
        mentions
            .map((m) => (m.ticker ? m.ticker.split('.')[0] : null))
            .filter((t): t is string => Boolean(t)),
    );

    for (const tok of firstPass) {
        if (tok.kind !== 'text') {
            result.push(tok);
            continue;
        }

        EXCHANGE_TICKER_RE.lastIndex = 0;
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = EXCHANGE_TICKER_RE.exec(tok.text)) !== null) {
            const [whole, ticker] = match;

            // Skip if this ticker is already tracked — the bare name should
            // have been caught upstream; don't double-pill.
            if (trackedTickers.has(ticker)) {
                continue;
            }

            if (match.index > cursor) {
                result.push({
                    kind: 'text',
                    text: tok.text.slice(cursor, match.index),
                });
            }
            result.push({ kind: 'untracked', text: whole, ticker });
            cursor = match.index + whole.length;
        }

        if (cursor < tok.text.length) {
            result.push({ kind: 'text', text: tok.text.slice(cursor) });
        }
    }

    return result;
}

/**
 * Scan `text` for occurrences of each mention's entity name, bare ticker,
 * or exchange-prefixed forms (e.g. "AMD", "(NASDAQ: AMD)", "Arm Holdings"),
 * returning a flat token list ready to render.
 *
 * Patterns are tried longest-first so "Arm Holdings" beats "Arm", and
 * "(NASDAQ: AMD)" beats the bare "AMD" inside it. Word boundaries are
 * enforced manually so short tickers don't match inside longer words
 * (e.g. "AMD" inside "AMD's" matches; "AMD" inside "Hammond" does not).
 */
function tokenizeWithMentions(
    text: string,
    mentions: VideoMention[],
): BodyToken[] {
    if (mentions.length === 0 || text === '') {
        return [{ kind: 'text', text }];
    }

    const patterns: Array<{ token: string; mentionIndex: number }> = [];

    for (let i = 0; i < mentions.length; i++) {
        const m = mentions[i];
        const bareTicker = m.ticker
            ? m.ticker.split('.')[0]
            : null;

        if (m.entity.name) {
            patterns.push({ token: m.entity.name, mentionIndex: i });
        }
        if (bareTicker) {
            // Order matters for the longest-match rule below.
            patterns.push({
                token: `(NASDAQ: ${bareTicker})`,
                mentionIndex: i,
            });
            patterns.push({
                token: `(NYSE: ${bareTicker})`,
                mentionIndex: i,
            });
            patterns.push({
                token: `NASDAQ: ${bareTicker}`,
                mentionIndex: i,
            });
            patterns.push({
                token: `NYSE: ${bareTicker}`,
                mentionIndex: i,
            });
            patterns.push({ token: bareTicker, mentionIndex: i });
        }
    }

    // Dedupe identical tokens (e.g. when name and ticker are the same, "AMD")
    // and sort longest-first so multi-word phrases win.
    const seen = new Set<string>();
    const sortedPatterns = patterns
        .filter((p) => {
            if (seen.has(p.token)) return false;
            seen.add(p.token);
            return true;
        })
        .sort((a, b) => b.token.length - a.token.length);

    const isWordChar = (ch: string | undefined) =>
        ch !== undefined && /[\w]/.test(ch);

    const result: BodyToken[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        let best: { idx: number; pattern: (typeof sortedPatterns)[number] } | null = null;

        for (const p of sortedPatterns) {
            const idx = text.indexOf(p.token, cursor);
            if (idx === -1) continue;

            // Word-boundary check — only relevant for bare tokens, but harmless
            // for the parenthesized forms (which already start/end with `(`/`)`).
            const before = idx > 0 ? text[idx - 1] : undefined;
            const after = text[idx + p.token.length];
            const startsWithWord = /[\w]/.test(p.token[0] ?? '');
            const endsWithWord = /[\w]/.test(p.token[p.token.length - 1] ?? '');
            if (startsWithWord && isWordChar(before)) continue;
            if (endsWithWord && isWordChar(after)) continue;

            if (best === null || idx < best.idx) {
                best = { idx, pattern: p };
                // Earliest position wins; among equal positions, sort order
                // (longest-first) already handled.
                if (best.idx === cursor) break;
            }
        }

        if (best === null) {
            result.push({ kind: 'text', text: text.slice(cursor) });
            break;
        }

        if (best.idx > cursor) {
            result.push({
                kind: 'text',
                text: text.slice(cursor, best.idx),
            });
        }
        result.push({
            kind: 'mention',
            text: best.pattern.token,
            mentionIndex: best.pattern.mentionIndex,
        });
        cursor = best.idx + best.pattern.token.length;
    }

    return result;
}

function MentionSidebar({
    mentions,
    selectedTicker,
    onSelect,
}: {
    mentions: VideoMention[];
    selectedTicker: string | null;
    onSelect: (ticker: string | null) => void;
}) {
    // Group by ticker so we list each entity once with its sample snippet.
    const groups = new Map<string, { mention: VideoMention; count: number }>();

    for (const m of mentions) {
        const key = m.ticker ?? m.entity.name;
        const existing = groups.get(key);

        if (existing) {
            existing.count++;
        } else {
            groups.set(key, { mention: m, count: 1 });
        }
    }

    return (
        <aside className="space-y-2 border-l pl-3 md:border-l">
            <h4 className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                Mentioned
            </h4>
            <ul className="space-y-1.5">
                {[...groups.entries()].map(([ticker, { mention, count }]) => {
                    const dim =
                        selectedTicker !== null && selectedTicker !== ticker;
                    const swatch = tickerColor(ticker);

                    return (
                        <li key={ticker}>
                            <button
                                type="button"
                                onClick={() =>
                                    onSelect(
                                        selectedTicker === ticker
                                            ? null
                                            : ticker,
                                    )
                                }
                                className={cn(
                                    'w-full rounded-md border px-2 py-1.5 text-left transition-colors hover:border-foreground/40',
                                    dim && 'opacity-50',
                                )}
                                style={
                                    selectedTicker === ticker
                                        ? { background: swatch.bg }
                                        : undefined
                                }
                            >
                                <div className="flex items-center gap-1.5 text-xs font-semibold">
                                    <span
                                        className="size-1.5 rounded-full"
                                        style={{
                                            background:
                                                SENTIMENT_HEX[mention.sentiment],
                                        }}
                                        aria-hidden
                                    />
                                    <span style={{ color: swatch.fg }}>
                                        {ticker}
                                    </span>
                                    <span className="ml-auto text-muted-foreground">
                                        ×{count}
                                    </span>
                                </div>
                                <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                                    {mention.snippet}
                                </p>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}
