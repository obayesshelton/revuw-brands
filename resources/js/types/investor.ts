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

/** Where a piece of chatter came from. Initial release: youtube + eod_news. */
export type ChatterSource = 'youtube' | 'eod_news' | 'reddit' | 'revuw';

/**
 * Lightweight per-entity summary shipped inline with each Video in list
 * payloads — just enough to render the collapsed-row chip strip without
 * loading the full transcript.
 */
export interface VideoMentionSummary {
    entity: EntityRef;
    ticker: string | null;
    count: number;
    sentiment: Sentiment; // majority across this item's mentions
}

/**
 * Heavy per-mention data — only loaded via /api/videos/{id}/transcript.
 * `timestamp` is null for sources with no timeline (EOD news).
 */
export interface VideoMention {
    entity: EntityRef;
    ticker: string | null;
    timestamp: number | null;
    sentiment: Sentiment;
    snippet: string;
}

export interface TranscriptToken {
    kind: 'text' | 'mention';
    text: string;
    mentionIndex?: number; // index into VideoTranscript.mentions
}

export interface TranscriptSegment {
    timestamp: number;
    tokens: TranscriptToken[];
}

/**
 * Discriminated by `kind` so the frontend reads what arrived, not what it
 * expected from the source: a captionless YouTube video can degrade to
 * `prose`, a structured news wire could surface as `timestamped`.
 */
export type VideoTranscript =
    | {
          kind: 'timestamped';
          videoId: string;
          mentions: VideoMention[];
          segments: TranscriptSegment[];
      }
    | {
          kind: 'prose';
          videoId: string;
          mentions: VideoMention[];
          body: string; // markdown
      };

export interface Video {
    id: string;
    source: ChatterSource;
    platformContentUuid: string;
    title: string;
    generatedTitle: string;
    url: string; // platform watch / article URL
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
    mentionSummary: VideoMentionSummary[];
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

/** Trimmed EODHD fundamentals `General` block — what the stock header needs. */
export interface PriceFundamentals {
    code: string;
    ticker: string;
    name: string;
    exchange: string;
    exchangeCode: string;
    currencyCode: string;
    currencySymbol: string;
    country: string;
    logoUrl: string | null;
    updatedAt: string;
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


export interface MentionChannel {
    id: string;
    name: string;
    handle: string;
    thumbnail: string;
}

/**
 * Source-agnostic mention. A YouTube video, a Reddit post, or a Revuw article
 * all flatten into this shape so the global MentionsTable can render them
 * uniformly. `entity` is null in single-entity contexts (entity profile) and
 * populated in cross-entity contexts (homepage, screener). `entityFundamentals`
 * is opt-in EOD context surfaced on the screener for stock-specific columns.
 */
export interface Mention {
    id: string;
    source: ChatterSource;
    title: string;
    url: string;
    publishedAt: string;
    channel: MentionChannel;
    entity: EntityRef | null;
    /**
     * The mentioned entity's ticker, when it has one (stocks brand). Carried
     * here — not derived from `entity` — so the price column can fetch
     * without a lookup, and so news items that tag multiple symbols can each
     * stamp the right one per row.
     */
    ticker: string | null;
    sentiment: Sentiment | null;
    reach: number;
    entityFundamentals?: PriceFundamentals | null;
}
