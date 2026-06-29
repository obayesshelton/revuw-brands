import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SENTIMENT_TEXT_CLASS } from '@/lib/colors';
import type { Sentiment } from '@/types/investor';

type SentimentConfig = {
    label: string;
    className: string;
    icon: LucideIcon;
};

export const sentimentConfig: Record<Sentiment, SentimentConfig> = {
    positive: {
        label: 'Positive',
        className: SENTIMENT_TEXT_CLASS.positive,
        icon: TrendingUp,
    },
    neutral: {
        label: 'Neutral',
        className: SENTIMENT_TEXT_CLASS.neutral,
        icon: Minus,
    },
    negative: {
        label: 'Negative',
        className: SENTIMENT_TEXT_CLASS.negative,
        icon: TrendingDown,
    },
};
