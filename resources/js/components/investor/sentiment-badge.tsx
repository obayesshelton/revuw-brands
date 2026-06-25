import { Badge } from '@/components/ui/badge';
import { sentimentConfig } from '@/lib/sentiment';
import { cn } from '@/lib/utils';
import type { Sentiment } from '@/types/investor';

export function SentimentBadge({
    sentiment,
    className,
}: {
    sentiment: Sentiment;
    className?: string;
}) {
    const config = sentimentConfig[sentiment];
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn('gap-1', config.className, className)}
        >
            <Icon className="size-3" />
            {config.label}
        </Badge>
    );
}
