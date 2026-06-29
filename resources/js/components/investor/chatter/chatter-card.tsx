import { useMemo, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SOURCE_LABEL } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { ChatterSource, Video } from '@/types/investor';
import { EodNewsCard } from './eod-news-card';
import { RedditCardStub } from './reddit-card-stub';
import { RevuwCardStub } from './revuw-card-stub';
import { YouTubeCard } from './youtube-card';

interface ChatterCardProps {
    video: Video;
    /**
     * The current page's stock ticker, when on a stock-specific page. The
     * card uses this to pre-select the matching chip when the user expands
     * the row. Pass `undefined` on the homepage and other aggregate views —
     * the default `All` chip stays active.
     */
    activeTicker?: string;
}

/**
 * Source-aware dispatcher. Each chatter source renders as a row in the same
 * list; only the expanded body differs — YouTube gets the rail + timestamped
 * transcript, EOD news gets an article viewer.
 */
export function ChatterCard({ video, activeTicker }: ChatterCardProps) {
    switch (video.source) {
        case 'youtube':
            return <YouTubeCard video={video} activeTicker={activeTicker} />;
        case 'eod_news':
            return <EodNewsCard video={video} activeTicker={activeTicker} />;
        case 'reddit':
            return <RedditCardStub video={video} />;
        case 'revuw':
            return <RevuwCardStub video={video} />;
    }
}

type SourceFilter = ChatterSource | 'all';

// Order of the source filter chips. Reddit + Revuw are disabled (no live
// data yet) but listed so users can see what's on the roadmap.
const FILTERS: Array<{ value: SourceFilter; disabled: boolean }> = [
    { value: 'all', disabled: false },
    { value: 'youtube', disabled: false },
    { value: 'eod_news', disabled: false },
    { value: 'reddit', disabled: true },
    { value: 'revuw', disabled: true },
];

/**
 * Flat divide-y stream of chatter cards with an inline source filter. Used
 * by home, entity-research and channel pages — the page passes the videos
 * to render; the filter is client-side.
 */
export function ChatterFeed({
    videos,
    activeTicker,
}: {
    videos: Video[];
    activeTicker?: string;
}) {
    const [source, setSource] = useState<SourceFilter>('all');

    const counts = useMemo(() => {
        const map: Partial<Record<ChatterSource, number>> = {};
        for (const v of videos) {
            map[v.source] = (map[v.source] ?? 0) + 1;
        }

        return map;
    }, [videos]);

    const filtered = useMemo(
        () => (source === 'all' ? videos : videos.filter((v) => v.source === source)),
        [videos, source],
    );

    return (
        <div className="space-y-3">
            <ToggleGroup
                type="single"
                value={source}
                onValueChange={(v) => v && setSource(v as SourceFilter)}
                variant="outline"
                className="flex-wrap justify-start"
            >
                {FILTERS.map(({ value, disabled }) => {
                    const count =
                        value === 'all'
                            ? videos.length
                            : (counts[value] ?? 0);

                    return (
                        <ToggleGroupItem
                            key={value}
                            value={value}
                            disabled={disabled || (value !== 'all' && count === 0)}
                            className={cn(
                                'gap-1.5 text-xs',
                                disabled && 'opacity-40',
                            )}
                            aria-label={
                                value === 'all'
                                    ? 'All sources'
                                    : SOURCE_LABEL[value]
                            }
                        >
                            <span>
                                {value === 'all' ? 'All' : SOURCE_LABEL[value]}
                            </span>
                            <span className="text-muted-foreground">
                                {count}
                            </span>
                            {disabled && (
                                <span className="text-[9px] tracking-wide text-muted-foreground uppercase">
                                    soon
                                </span>
                            )}
                        </ToggleGroupItem>
                    );
                })}
            </ToggleGroup>

            {filtered.length === 0 ? (
                <p className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                    No {source === 'all' ? '' : `${SOURCE_LABEL[source as ChatterSource]} `}
                    chatter to show.
                </p>
            ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                    <div className="divide-y">
                        {filtered.map((video) => (
                            <ChatterCard
                                key={video.id}
                                video={video}
                                activeTicker={activeTicker}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
