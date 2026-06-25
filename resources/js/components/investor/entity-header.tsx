import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatCompact, pluralize } from '@/lib/format';
import type { Entity } from '@/types/investor';

export function EntityHeader({
    entity,
    typeLabel,
    aside,
}: {
    entity: Entity;
    typeLabel: string;
    aside?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {entity.name}
                    </h1>
                    <Badge variant="secondary" className="capitalize">
                        {typeLabel}
                    </Badge>
                </div>
                <p className="max-w-2xl text-muted-foreground">{entity.hook}</p>
                <p className="text-sm text-muted-foreground">
                    {formatCompact(entity.mentionCount)}{' '}
                    {pluralize(entity.mentionCount, 'mention')} across{' '}
                    {formatCompact(entity.contentCount)}{' '}
                    {pluralize(entity.contentCount, 'video')}
                </p>
            </div>
            {aside && <div className="shrink-0">{aside}</div>}
        </div>
    );
}
