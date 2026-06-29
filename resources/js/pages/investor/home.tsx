import { Head, Link, usePage } from '@inertiajs/react';
import { ChannelCardGrid } from '@/components/investor/channel-card-grid';
import { ChatterFeed } from '@/components/investor/chatter/chatter-card';
import { EntityCardGrid } from '@/components/investor/entity/entity-card-grid';
import { GlobalSearch } from '@/components/investor/global-search';
import { SectionHeading } from '@/components/investor/section-heading';
import { Button } from '@/components/ui/button';
import type { ChannelSummary, EntitySummary, Video } from '@/types/investor';

interface HomeProps {
    trendingEntities: EntitySummary[];
    trendingChannels: ChannelSummary[];
    latestVideos: Video[];
}

export default function Home({
    trendingEntities,
    trendingChannels,
    latestVideos,
}: HomeProps) {
    const { brand } = usePage().props;
    const plural = brand.copy.entityNounPlural;

    return (
        <>
            <Head title="Home" />

            <section className="mb-12 rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-8 sm:p-10">
                <p className="text-sm font-medium text-primary">{brand.name}</p>
                <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                    {brand.copy.tagline}
                </h1>
                <p className="mt-3 max-w-xl text-muted-foreground">
                    Track every mention of {plural} across YouTube — who's
                    talking, what they're saying, and how the conversation is
                    shifting.
                </p>
                <div className="mt-6 max-w-md">
                    <GlobalSearch />
                </div>
            </section>

            <section className="mb-12">
                <SectionHeading
                    title="Trending Entities"
                    description={`The ${plural} getting the most attention right now.`}
                    action={
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/screener">View all</Link>
                        </Button>
                    }
                />
                <EntityCardGrid entities={trendingEntities} />
            </section>

            {latestVideos.length > 0 && (
                <section>
                    <SectionHeading
                        title="Latest chatter"
                        description={`Fresh coverage mentioning the ${plural} we track — across YouTube and the wires.`}
                    />
                    <ChatterFeed videos={latestVideos} />
                </section>
            )}

            <section className="mt-12">
                <SectionHeading
                    title="Trending Channels"
                    description="The channels driving the most coverage."
                    action={
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/channels">View all</Link>
                        </Button>
                    }
                />
                <ChannelCardGrid channels={trendingChannels} />
            </section>
        </>
    );
}
