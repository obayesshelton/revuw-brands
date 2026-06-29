import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { SENTIMENT_HEX, SOURCE_HEX, SOURCE_LABEL } from '@/lib/colors';
import { formatCompact, formatTimeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Video, VideoMentionSummary } from '@/types/investor';

interface ChatterRowProps {
    video: Video;
    leadingVisual: ReactNode;
    sourceIcon: ReactNode;
    isOpen: boolean;
    onToggle: () => void;
    onChipClick: (ticker: string) => void;
    activeTicker: string | null;
}

/**
 * Shared collapsed-row primitive: thumbnail + source icon + title + chips +
 * chevron. The row itself is the toggle (div + onClick) so child elements
 * like chip pills and entity links can stay interactive — nesting a button
 * inside a button is invalid HTML.
 */
export function ChatterRow({
    video,
    leadingVisual,
    sourceIcon,
    isOpen,
    onToggle,
    onChipClick,
    activeTicker,
}: ChatterRowProps) {
    return (
        <div
            role="button"
            tabIndex={0}
            aria-expanded={isOpen}
            onClick={onToggle}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onToggle();
                }
            }}
            className={cn(
                'flex w-full cursor-pointer items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/40',
                isOpen && 'bg-muted/30',
            )}
        >
            {leadingVisual}

            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase"
                        style={{ color: SOURCE_HEX[video.source] }}
                    >
                        {sourceIcon}
                        {SOURCE_LABEL[video.source]}
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                    <ChannelLabel video={video} />
                    <span className="text-muted-foreground/50">·</span>
                    <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(video.publishedAt)}
                    </span>
                </div>
                <h3 className="line-clamp-1 text-sm font-semibold">
                    {video.generatedTitle || video.title}
                </h3>
                {video.mentionSummary.length > 0 && (
                    <ChipStrip
                        mentions={video.mentionSummary}
                        activeTicker={activeTicker}
                        onChipClick={onChipClick}
                    />
                )}
            </div>

            <ChevronDown
                className={cn(
                    'size-4 shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180',
                )}
                aria-hidden
            />
        </div>
    );
}

function ChannelLabel({ video }: { video: Video }) {
    const getInitials = useInitials();

    return (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar className="size-4">
                <AvatarImage
                    src={video.channel.thumbnailUrl}
                    alt={video.channel.title}
                />
                <AvatarFallback className="text-[7px]">
                    {getInitials(video.channel.title)}
                </AvatarFallback>
            </Avatar>
            <span className="truncate">{video.channel.title}</span>
        </span>
    );
}

function ChipStrip({
    mentions,
    activeTicker,
    onChipClick,
}: {
    mentions: VideoMentionSummary[];
    activeTicker: string | null;
    onChipClick: (ticker: string) => void;
}) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            {mentions.map((m) => {
                const label = m.ticker ?? m.entity.name;
                const isActive = activeTicker === label;

                return (
                    <span
                        key={m.entity.slug}
                        onClick={(e) => {
                            e.stopPropagation();
                            onChipClick(label);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                onChipClick(label);
                            }
                        }}
                        className={cn(
                            'inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium transition-colors hover:border-foreground/40',
                            isActive && 'border-foreground bg-foreground/5',
                        )}
                    >
                        <span
                            className="size-1.5 rounded-full"
                            style={{ background: SENTIMENT_HEX[m.sentiment] }}
                            aria-hidden
                        />
                        <EntityLink slug={m.entity.slug}>{label}</EntityLink>
                        <span className="text-muted-foreground/70">
                            · {formatCompact(m.count)}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}

function EntityLink({ slug, children }: { slug: string; children: ReactNode }) {
    return (
        <Link
            href={`/entities/${slug}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline"
        >
            {children}
        </Link>
    );
}
