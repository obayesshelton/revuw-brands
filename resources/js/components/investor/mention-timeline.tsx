import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Heat, MentionTimelineBucket } from '@/types/investor';

const heatClass: Record<Heat, string> = {
    hot: 'bg-primary',
    warm: 'bg-primary/70',
    cool: 'bg-primary/40',
    neutral: 'bg-muted',
};

export function MentionTimeline({
    buckets,
}: {
    buckets: MentionTimelineBucket[];
}) {
    const max = Math.max(1, ...buckets.map((bucket) => bucket.videoCount));

    return (
        <div className="flex items-end gap-1.5 sm:gap-2">
            {buckets.map((bucket) => (
                <Tooltip key={bucket.id}>
                    <TooltipTrigger asChild>
                        <div className="flex flex-1 cursor-default flex-col items-center gap-1.5">
                            <div className="flex h-28 w-full items-end">
                                <div
                                    className={cn(
                                        'w-full rounded-t',
                                        heatClass[bucket.heat],
                                    )}
                                    style={{
                                        height: `${Math.max(4, (bucket.videoCount / max) * 100)}%`,
                                    }}
                                />
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {bucket.date.split(' ')[0]}
                            </span>
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-56">
                        <p className="font-medium">{bucket.date}</p>
                        <p className="text-xs">{bucket.summary}</p>
                        {bucket.keyCreators.length > 0 && (
                            <p className="mt-1 text-xs opacity-80">
                                {bucket.keyCreators.join(', ')}
                            </p>
                        )}
                    </TooltipContent>
                </Tooltip>
            ))}
        </div>
    );
}
