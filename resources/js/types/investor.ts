export type EntityType = 'stocks' | 'startups';
export type Sentiment = 'positive' | 'negative' | 'neutral';
export type Heat = 'hot' | 'warm' | 'cool' | 'neutral';
export type PriceRange = '1m' | '3m' | '6m' | '1y' | '5y';

export interface Citation {
    title: string;
    uri: string;
}

export interface Tldr {
    paragraph: string;
    keyTakeaways: string[];
    platformConsensus: string | null;
    citations: Citation[];
    generatedAt: string;
}

export interface MonthlyMention {
    month: string; // 'YYYY-MM'
    count: number;
}

export interface QuickStat {
    label: string;
    value: string;
}

/** Lightweight shape used in card grids and lists. */
export interface EntitySummary {
    id: string;
    name: string;
    slug: string;
    type: EntityType;
    mentionCount: number;
    contentCount: number;
    monthlyMentions: MonthlyMention[];
    ticker: string | null; // null => no public share price (startups)
    headlineStat: QuickStat | null; // shown when there is no price
}

/** Full entity profile used on the research page. */
export interface Entity extends EntitySummary {
    description: string;
    hook: string;
    quickStats: QuickStat[];
    citations: Citation[];
    tldr: Tldr | null;
}

export interface MentionTimelineBucket {
    id: string; // 'YYYY-MM'
    date: string; // 'Mar 2026'
    heat: Heat;
    summary: string;
    videoCount: number;
    creatorCount: number;
    keyCreators: string[];
}

export interface TopSource {
    id: string;
    name: string;
    handle: string;
    thumbnail: string;
    mentionCount: number;
}

export interface Category {
    id: string;
    value: string;
    slug: string;
    type: string;
}

export interface ChannelPlatformInfo {
    description: string;
    subscriberCount: number;
    videoCount: number;
    viewCount: number;
    country: string;
    publishedAt: string;
}

/** Minimal entity reference (e.g. clickable badges on a channel card). */
export type EntityRef = Pick<EntitySummary, 'name' | 'slug' | 'type'>;

export interface ChannelSummary {
    id: string;
    title: string;
    handle: string;
    thumbnailUrl: string;
    subscriberCount: number;
    contentsCount: number;
    topEntities: EntityRef[];
}

export interface Channel extends ChannelSummary {
    platformProfileUrl: string;
    platformInfo: ChannelPlatformInfo;
    topEntities: EntitySummary[];
    persona: string | null;
    topics: Category[];
}

export interface VideoCitation {
    claim: string;
    timestamp: number;
    directQuote: string;
}

export interface VideoPlatformInfo {
    duration: number;
    viewCount: number;
    likeCount: number;
    commentCount: number;
}

export interface VideoChannel {
    title: string;
    handle: string;
    thumbnailUrl: string;
}

export interface Video {
    id: string;
    platformContentUuid: string;
    title: string;
    generatedTitle: string;
    url: string; // YouTube watch URL
    articleUrl: string; // on-site "Revuw Article"
    summary: string; // markdown
    tldr: string;
    thumbnail: string;
    publishedAt: string;
    readDuration: number; // minutes
    citations: VideoCitation[];
    platformInfo: VideoPlatformInfo;
    entitySentiment: Sentiment | null;
    entityTimestampStart: number | null; // seconds into the video
    channel: VideoChannel;
}

/** EODHD real-time quote shape (15-20 min delayed). */
export interface PriceQuote {
    code: string;
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    previousClose: number;
    change: number;
    change_p: number;
}

/** EODHD end-of-day historical candle shape. */
export interface PriceCandle {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    adjusted_close: number;
    volume: number;
}

export interface ScreenerFilters {
    q: string;
    minMentions: number | null;
    maxMentions: number | null;
    sort: 'mentionCount' | 'name' | 'contentCount';
    dir: 'asc' | 'desc';
    page: number;
    perPage: number;
}

export interface PaginationMeta {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
}

export interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}
