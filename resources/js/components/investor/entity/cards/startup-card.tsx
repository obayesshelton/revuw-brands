import { EntityCardShell } from '@/components/investor/entity/entity-card-shell';
import type { EntitySummary } from '@/types/investor';

export default function StartupCard({ entity }: { entity: EntitySummary }) {
    return (
        <EntityCardShell entity={entity}>
            {entity.headlineStat && (
                <span className="inline-flex items-baseline gap-1.5 text-sm">
                    <span className="text-xs text-muted-foreground">
                        {entity.headlineStat.label}
                    </span>
                    <span className="font-semibold">
                        {entity.headlineStat.value}
                    </span>
                </span>
            )}
        </EntityCardShell>
    );
}
