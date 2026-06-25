import type { Video } from '@/types/investor';

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
