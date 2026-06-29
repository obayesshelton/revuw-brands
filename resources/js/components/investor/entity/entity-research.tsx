import { Head } from '@inertiajs/react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChatterFeed } from '@/components/investor/chatter/chatter-card';
import { EntityHeader } from '@/components/investor/entity-header';
import { MentionsTable } from '@/components/investor/mentions-table';
import {
    channelColumn,
    postedColumn,
    priceColumn,
    reachColumn,
    sentimentColumn,
    sourceColumn,
    titleColumn,
} from '@/components/investor/mentions-table-columns';
import { videoToMention } from '@/lib/content';
import type { Entity, MentionTimelineBucket, Video } from '@/types/investor';

export interface EntityResearchData {
    entity: Entity;
    timeline: MentionTimelineBucket[];
    videos: Video[];
}

/**
 * Shared research body. The per-type pages (research/stocks, research/startups)
 * inject their distinguishing pieces via `header` (full override) or
 * `headerAside` (right-slot on the default header) and `featureBlock`.
 */
export function EntityResearch({
    entity,
    videos,
    typeLabel,
    header,
    headerAside,
    featureBlock,
}: EntityResearchData & {
    typeLabel: string;
    header?: ReactNode;
    headerAside?: ReactNode;
    featureBlock?: ReactNode;
}) {
    const entityRef = useMemo(
        () => ({ name: entity.name, slug: entity.slug, type: entity.type }),
        [entity.name, entity.slug, entity.type],
    );
    const mentions = useMemo(
        () => videos.map((v) => videoToMention(v, entityRef, entity.ticker)),
        [videos, entityRef, entity.ticker],
    );

    return (
        <>
            <Head title={entity.name} />

            {header ?? (
                <EntityHeader
                    entity={entity}
                    typeLabel={typeLabel}
                    aside={headerAside}
                />
            )}

            <div className="mt-8 space-y-6">
                {featureBlock}

                {videos.length > 0 && (
                    <ChatterFeed
                        videos={videos}
                        activeTicker={entity.ticker ?? undefined}
                    />
                )}

                <MentionsTable
                    mentions={mentions}
                    columns={[
                        sourceColumn,
                        titleColumn,
                        channelColumn,
                        ...(entity.ticker ? [priceColumn] : []),
                        postedColumn,
                        sentimentColumn,
                        reachColumn,
                    ]}
                    title={`Mentions of ${entity.name}`}
                    description="Every video and post that mentioned this entity, newest first."
                />
            </div>
        </>
    );
}
