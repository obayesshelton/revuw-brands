import type { ComponentType } from 'react';
import StartupCard from '@/components/investor/entity/cards/startup-card';
import StockCard from '@/components/investor/entity/cards/stock-card';
import type { EntitySummary } from '@/types/investor';

type EntityCardComponent = ComponentType<{ entity: EntitySummary }>;

/**
 * Maps an entity type to its card. Add a brand/type by registering a card
 * here — no conditionals elsewhere. Falls back to the stock card.
 */
const ENTITY_CARDS: Record<string, EntityCardComponent> = {
    stocks: StockCard,
    startups: StartupCard,
};

export function entityCard(type: string): EntityCardComponent {
    return ENTITY_CARDS[type] ?? StockCard;
}
