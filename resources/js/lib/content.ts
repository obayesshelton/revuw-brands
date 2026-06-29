import type { EntityRef, Mention, Video } from '@/types/investor';

/** Client-side filter shared by the video and Revuw Article lists. */
export function filterVideos(videos: Video[], query: string): Video[] {
    const q = query.trim().toLowerCase();

    if (q === '') {
        return videos;
    }

    return videos.filter(
        (video) =>
            video.title.toLowerCase().includes(q) ||
            video.generatedTitle.toLowerCase().includes(q) ||
            video.channel.title.toLowerCase().includes(q),
    );
}

/**
 * Map a YouTube Video into the source-agnostic Mention shape used by
 * MentionsTable. Pass `entity` when the caller knows which entity the video
 * mentions (always the case on entity profile pages); leave undefined when
 * the backend embeds the entity reference on the video itself.
 *
 * The channel id falls back to the handle: the Video shape strips channelId,
 * but handles are unique and stable, so they work as a grouping key.
 */
export function videoToMention(
    video: Video,
    entity?: EntityRef | null,
    ticker?: string | null,
): Mention {
    return {
        id: video.id,
        source: video.source,
        title: video.title,
        url: video.url,
        publishedAt: video.publishedAt,
        channel: {
            id: video.channel.handle,
            name: video.channel.title,
            handle: video.channel.handle,
            thumbnail: video.channel.thumbnailUrl,
        },
        entity: entity ?? null,
        ticker:
            ticker ??
            video.mentionSummary.find((m) => m.entity.slug === entity?.slug)
                ?.ticker ??
            null,
        sentiment: video.entitySentiment,
        reach: video.platformInfo.viewCount,
    };
}
