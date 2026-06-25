import { entityCard } from '@/components/investor/entity/registry';
import type { EntitySummary } from '@/types/investor';

export function EntityCardGrid({ entities }: { entities: EntitySummary[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entities.map((entity) => {
                const Card = entityCard(entity.type);

                return <Card key={entity.id} entity={entity} />;
            })}
        </div>
    );
}
