import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Sentiment } from '@/types/investor';

type SentimentConfig = {
    label: string;
    className: string;
    icon: LucideIcon;
};

export const sentimentConfig: Record<Sentiment, SentimentConfig> = {
    positive: {
        label: 'Positive',
        className: 'text-emerald-600 dark:text-emerald-400',
        icon: TrendingUp,
    },
    neutral: {
        label: 'Neutral',
        className: 'text-muted-foreground',
        icon: Minus,
    },
    negative: {
        label: 'Negative',
        className: 'text-red-600 dark:text-red-400',
        icon: TrendingDown,
    },
};
