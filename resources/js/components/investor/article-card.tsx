import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { Video } from '@/types/investor';

/**
 * A "Revuw Article" — the on-site rendering of a video's AI summary
 * (generatedTitle + tldr). We don't have a dedicated article page yet, so the
 * card opens the source video; swap the href to an on-site route when it lands.
 */
export function ArticleCard({ video }: { video: Video }) {
    return (
        <Card className="h-full gap-0 p-4 transition-colors hover:border-primary/40">
            <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col gap-2"
            >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{video.channel.title}</span>
                    <span>·</span>
                    <span>{formatDate(video.publishedAt)}</span>
                </div>
                <h3 className="font-semibold leading-snug">{video.generatedTitle}</h3>
                <p className="line-clamp-3 text-sm text-muted-foreground">{video.tldr}</p>
                <span className="mt-auto pt-2 text-xs text-muted-foreground">
                    {video.readDuration} min read
                </span>
            </a>
        </Card>
    );
}
