import { EntityCardShell } from '@/components/investor/entity/entity-card-shell';
import { PriceTag } from '@/components/investor/price-tag';
import type { EntitySummary } from '@/types/investor';

export default function StockCard({ entity }: { entity: EntitySummary }) {
    return (
        <EntityCardShell entity={entity}>
            {entity.ticker ? (
                <PriceTag ticker={entity.ticker} />
            ) : (
                entity.headlineStat && (
                    <span className="text-sm text-muted-foreground">
                        {entity.headlineStat.value}
                    </span>
                )
            )}
        </EntityCardShell>
    );
}
