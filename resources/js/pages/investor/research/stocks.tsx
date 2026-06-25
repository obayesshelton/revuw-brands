import { usePage } from '@inertiajs/react';
import { EntityResearch } from '@/components/investor/entity/entity-research';
import type { EntityResearchData } from '@/components/investor/entity/entity-research';
import { PriceChart } from '@/components/investor/price-chart';
import { PriceTag } from '@/components/investor/price-tag';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StocksResearch(props: EntityResearchData) {
    const { brand } = usePage().props;
    const { entity } = props;

    return (
        <EntityResearch
            {...props}
            typeLabel={brand.copy.entityNoun}
            headerAside={
                entity.ticker ? (
                    <PriceTag ticker={entity.ticker} size="lg" />
                ) : undefined
            }
            featureBlock={
                entity.ticker ? (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Share price
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <PriceChart ticker={entity.ticker} />
                        </CardContent>
                    </Card>
                ) : undefined
            }
        />
    );
}
