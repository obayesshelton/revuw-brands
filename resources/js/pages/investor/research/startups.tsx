import { usePage } from '@inertiajs/react';
import { EntityResearch } from '@/components/investor/entity/entity-research';
import type { EntityResearchData } from '@/components/investor/entity/entity-research';
import { Card, CardContent } from '@/components/ui/card';

export default function StartupsResearch(props: EntityResearchData) {
    const { brand } = usePage().props;
    const { entity } = props;
    const highlight = entity.headlineStat ?? entity.quickStats[0] ?? null;

    return (
        <EntityResearch
            {...props}
            typeLabel={brand.copy.entityNoun}
            featureBlock={
                <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-4">
                        {highlight && (
                            <div>
                                <p className="text-xs text-muted-foreground">
                                    {highlight.label}
                                </p>
                                <p className="text-3xl font-bold">
                                    {highlight.value}
                                </p>
                            </div>
                        )}
                        <p className="max-w-xs text-sm text-muted-foreground">
                            Private company — no public share price. Figures
                            reflect the latest known funding round.
                        </p>
                    </CardContent>
                </Card>
            }
        />
    );
}
