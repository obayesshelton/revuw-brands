import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { MentionSparkline } from '@/components/investor/mention-sparkline';
import { Card } from '@/components/ui/card';
import { formatCompact, pluralize } from '@/lib/format';
import type { EntitySummary } from '@/types/investor';

/**
 * Shared card chrome for every entity type. Type-specific cards
 * (StockCard / StartupCard) render their distinguishing slot as children.
 */
export function EntityCardShell({
    entity,
    children,
}: {
    entity: EntitySummary;
    children?: ReactNode;
}) {
    return (
        <Card className="gap-0 p-4 transition-colors hover:border-primary/40">
            <Link
                href={`/entities/${entity.slug}`}
                className="flex flex-col gap-3"
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate font-semibold">{entity.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {formatCompact(entity.mentionCount)}{' '}
                            {pluralize(entity.mentionCount, 'mention')}
                        </p>
                    </div>
                    <MentionSparkline data={entity.monthlyMentions} />
                </div>
                <div className="flex min-h-6 items-center">{children}</div>
            </Link>
        </Card>
    );
}
