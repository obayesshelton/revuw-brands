import { usePage } from '@inertiajs/react';
import { ChatterStockChart } from '@/components/investor/chatter-stock-chart';
import { EntityResearch } from '@/components/investor/entity/entity-research';
import type { EntityResearchData } from '@/components/investor/entity/entity-research';
import { LeadLagCorrelogram } from '@/components/investor/lead-lag-correlogram';
import { SentimentDivergenceStrip } from '@/components/investor/sentiment-divergence-strip';
import { StockHeader } from '@/components/investor/stock-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function StocksResearch(props: EntityResearchData) {
    const { brand } = usePage().props;
    const { entity, videos } = props;

    return (
        <EntityResearch
            {...props}
            typeLabel={brand.copy.entityNoun}
            header={
                <StockHeader
                    entity={entity}
                    typeLabel={brand.copy.entityNoun}
                />
            }
            featureBlock={
                entity.ticker ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Price & chatter
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ChatterStockChart
                                    ticker={entity.ticker}
                                    videos={videos}
                                    showPrice={false}
                                />
                            </CardContent>
                        </Card>
                        <LeadLagCorrelogram
                            ticker={entity.ticker}
                            videos={videos}
                        />
                        <SentimentDivergenceStrip
                            ticker={entity.ticker}
                            videos={videos}
                        />
                    </>
                ) : undefined
            }
        />
    );
}
