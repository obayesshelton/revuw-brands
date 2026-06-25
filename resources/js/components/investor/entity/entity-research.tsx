import { Head } from '@inertiajs/react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ArticleCard } from '@/components/investor/article-card';
import { EntityHeader } from '@/components/investor/entity-header';
import { MentionTimeline } from '@/components/investor/mention-timeline';
import { SearchInput } from '@/components/investor/search-input';
import { StatGrid } from '@/components/investor/stat-grid';
import { TldrPanel } from '@/components/investor/tldr-panel';
import { TopSources } from '@/components/investor/top-sources';
import { VideoList } from '@/components/investor/video-list';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { filterVideos } from '@/lib/content';
import type {
    Entity,
    MentionTimelineBucket,
    TopSource,
    Video,
} from '@/types/investor';

export interface EntityResearchData {
    entity: Entity;
    timeline: MentionTimelineBucket[];
    topSources: TopSource[];
    videos: Video[];
}

/**
 * Shared research body. The per-type pages (research/stocks, research/startups)
 * inject their distinguishing pieces via `headerAside` and `featureBlock`.
 */
export function EntityResearch({
    entity,
    timeline,
    topSources,
    videos,
    typeLabel,
    headerAside,
    featureBlock,
}: EntityResearchData & {
    typeLabel: string;
    headerAside?: ReactNode;
    featureBlock?: ReactNode;
}) {
    const [query, setQuery] = useState('');
    const shown = filterVideos(videos, query);

    return (
        <>
            <Head title={entity.name} />

            <EntityHeader
                entity={entity}
                typeLabel={typeLabel}
                aside={headerAside}
            />

            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                    {featureBlock}

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                Mention timeline
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MentionTimeline buckets={timeline} />
                        </CardContent>
                    </Card>

                    <Tabs defaultValue="videos" className="gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <TabsList>
                                <TabsTrigger value="videos">
                                    YouTube videos
                                </TabsTrigger>
                                <TabsTrigger value="articles">
                                    Revuw Articles
                                </TabsTrigger>
                            </TabsList>
                            <SearchInput
                                value={query}
                                onChange={setQuery}
                                placeholder="Search videos & articles…"
                                className="sm:w-64"
                            />
                        </div>

                        <TabsContent value="videos">
                            {shown.length > 0 ? (
                                <VideoList videos={shown} showSentiment />
                            ) : (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No videos match “{query}”.
                                </p>
                            )}
                        </TabsContent>
                        <TabsContent value="articles">
                            {shown.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {shown.map((video) => (
                                        <ArticleCard
                                            key={video.id}
                                            video={video}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    No articles match “{query}”.
                                </p>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                <aside className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">About</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                {entity.description}
                            </p>
                            <StatGrid stats={entity.quickStats} columns={2} />
                        </CardContent>
                    </Card>

                    {entity.tldr && <TldrPanel tldr={entity.tldr} />}

                    {topSources.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Top sources
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TopSources sources={topSources} />
                            </CardContent>
                        </Card>
                    )}
                </aside>
            </div>
        </>
    );
}
