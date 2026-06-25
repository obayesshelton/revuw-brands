import { ChannelCard } from '@/components/investor/channel-card';
import type { ChannelSummary } from '@/types/investor';

export function ChannelCardGrid({ channels }: { channels: ChannelSummary[] }) {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
            ))}
        </div>
    );
}
