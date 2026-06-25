import { Link } from '@inertiajs/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useInitials } from '@/hooks/use-initials';
import { formatCompact, pluralize } from '@/lib/format';
import type { ChannelSummary } from '@/types/investor';

export function ChannelCard({ channel }: { channel: ChannelSummary }) {
    const getInitials = useInitials();

    return (
        <Card className="gap-3 p-4 transition-colors hover:border-primary/40">
            <Link
                href={`/channels/${channel.handle}`}
                className="flex items-center gap-3"
            >
                <Avatar className="size-10">
                    <AvatarImage
                        src={channel.thumbnailUrl}
                        alt={channel.title}
                    />
                    <AvatarFallback>
                        {getInitials(channel.title)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="truncate font-semibold">{channel.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatCompact(channel.subscriberCount)} subscribers ·{' '}
                        {formatCompact(channel.contentsCount)}{' '}
                        {pluralize(channel.contentsCount, 'video')}
                    </p>
                </div>
            </Link>

            {channel.topEntities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {channel.topEntities.map((entity) => (
                        <Badge
                            key={entity.slug}
                            asChild
                            variant="secondary"
                            className="font-normal hover:bg-secondary/70"
                        >
                            <Link href={`/entities/${entity.slug}`}>
                                {entity.name}
                            </Link>
                        </Badge>
                    ))}
                </div>
            )}
        </Card>
    );
}
