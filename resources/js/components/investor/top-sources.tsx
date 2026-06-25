import { Link } from '@inertiajs/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useInitials } from '@/hooks/use-initials';
import { pluralize } from '@/lib/format';
import type { TopSource } from '@/types/investor';

export function TopSources({ sources }: { sources: TopSource[] }) {
    const getInitials = useInitials();

    if (sources.length === 0) {
        return null;
    }

    return (
        <ul className="space-y-1">
            {sources.map((source) => (
                <li key={source.id}>
                    <Link
                        href={`/channels/${source.handle}`}
                        className="flex items-center gap-3 rounded-md p-1.5 hover:bg-accent/60"
                    >
                        <Avatar className="size-8">
                            <AvatarImage
                                src={source.thumbnail}
                                alt={source.name}
                            />
                            <AvatarFallback>
                                {getInitials(source.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                                {source.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {source.mentionCount}{' '}
                                {pluralize(source.mentionCount, 'mention')}
                            </p>
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
