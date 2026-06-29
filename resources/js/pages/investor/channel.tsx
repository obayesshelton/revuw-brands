import { Head } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { ChatterFeed } from '@/components/investor/chatter/chatter-card';
import { EntityCardGrid } from '@/components/investor/entity/entity-card-grid';
import { SearchInput } from '@/components/investor/search-input';
import { StatGrid } from '@/components/investor/stat-grid';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInitials } from '@/hooks/use-initials';
import { filterVideos } from '@/lib/content';
import { formatCompact } from '@/lib/format';
import type { Channel, Video } from '@/types/investor';

interface ChannelProfileProps {
    channel: Channel;
    videos: Video[];
}

export default function ChannelProfile({
    channel,
    videos,
}: ChannelProfileProps) {
    const getInitials = useInitials();
    const [query, setQuery] = useState('');
    const shownVideos = filterVideos(videos, query);

    const stats = [
        {
            label: 'Subscribers',
            value: formatCompact(channel.platformInfo.subscriberCount),
        },
        {
            label: 'Videos',
            value: formatCompact(channel.platformInfo.videoCount),
        },
        {
            label: 'Total views',
            value: formatCompact(channel.platformInfo.viewCount),
        },
        { label: 'Country', value: channel.platformInfo.country },
    ];

    return (
        <>
            <Head title={channel.title} />

            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                <Avatar className="size-16">
                    <AvatarImage
                        src={channel.thumbnailUrl}
                        alt={channel.title}
                    />
                    <AvatarFallback className="text-lg">
                        {getInitials(channel.title)}
                    </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {channel.title}
                    </h1>
                    <a
                        href={channel.platformProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        {channel.handle}
                        <ExternalLink className="size-3.5" />
                    </a>
                    <div className="flex flex-wrap gap-1 pt-1">
                        {channel.persona && (
                            <Badge variant="secondary">{channel.persona}</Badge>
                        )}
                        {channel.topics.map((topic) => (
                            <Badge key={topic.id} variant="outline">
                                {topic.value}
                            </Badge>
                        ))}
                    </div>
                </div>
            </div>

            <StatGrid stats={stats} columns={4} className="mb-8" />

            <Tabs defaultValue="videos" className="gap-4">
                <TabsList>
                    <TabsTrigger value="videos">Videos</TabsTrigger>
                    <TabsTrigger value="entities">
                        Entities mentioned
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="videos" className="space-y-4">
                    <SearchInput
                        value={query}
                        onChange={setQuery}
                        placeholder="Search videos…"
                        className="sm:max-w-xs"
                    />
                    {shownVideos.length > 0 ? (
                        <ChatterFeed videos={shownVideos} />
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            No videos match “{query}”.
                        </p>
                    )}
                </TabsContent>
                <TabsContent value="entities">
                    <EntityCardGrid entities={channel.topEntities} />
                </TabsContent>
            </Tabs>
        </>
    );
}
