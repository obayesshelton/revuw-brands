import type { VideoTranscript } from '@/types/investor';

/**
 * Thin client for the async transcript endpoint. The chatter card lazy-loads
 * this on first expand and caches the result in component state — collapsing
 * and re-opening the same row costs nothing on the network.
 */
export async function fetchVideoTranscript(
    videoId: string,
): Promise<VideoTranscript | null> {
    const response = await fetch(
        `/api/videos/${encodeURIComponent(videoId)}/transcript`,
        { headers: { Accept: 'application/json' } },
    );

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Transcript fetch failed: ${response.status}`);
    }

    return (await response.json()) as VideoTranscript;
}
