import { SentimentBadge } from '@/components/investor/sentiment-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { useInitials } from '@/hooks/use-initials';
import { formatCompact, formatDate, formatDuration } from '@/lib/format';
import type { Video } from '@/types/investor';

export function VideoList({
    videos,
    showSentiment = false,
}: {
    videos: Video[];
    showSentiment?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <div className="space-y-3">
            {videos.map((video) => (
                <Card key={video.id} className="gap-0 p-3">
                    <a
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3"
                    >
                        <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-md bg-muted sm:w-44">
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
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <h3 className="line-clamp-2 text-sm leading-snug font-semibold">
                                {video.title}
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <Avatar className="size-5">
                                    <AvatarImage
                                        src={video.channel.thumbnailUrl}
                                        alt={video.channel.title}
                                    />
                                    <AvatarFallback className="text-[8px]">
                                        {getInitials(video.channel.title)}
                                    </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-xs text-muted-foreground">
                                    {video.channel.title}
                                </span>
                            </div>
                            <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                    {formatCompact(
                                        video.platformInfo.viewCount,
                                    )}{' '}
                                    views
                                </span>
                                <span>{formatDate(video.publishedAt)}</span>
                                {showSentiment && video.entitySentiment && (
                                    <SentimentBadge
                                        sentiment={video.entitySentiment}
                                    />
                                )}
                            </div>
                        </div>
                    </a>
                </Card>
            ))}
        </div>
    );
}
