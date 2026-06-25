import { cn } from '@/lib/utils';
import type { QuickStat } from '@/types/investor';

const columnClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
} as const;

export function StatGrid({
    stats,
    columns = 2,
    className,
}: {
    stats: QuickStat[];
    columns?: 2 | 3 | 4;
    className?: string;
}) {
    if (stats.length === 0) {
        return null;
    }

    return (
        <dl
            className={cn(
                'grid grid-cols-1 gap-3',
                columnClass[columns],
                className,
            )}
        >
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="rounded-lg border bg-card px-4 py-3"
                >
                    <dt className="text-xs text-muted-foreground">
                        {stat.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{stat.value}</dd>
                </div>
            ))}
        </dl>
    );
}
