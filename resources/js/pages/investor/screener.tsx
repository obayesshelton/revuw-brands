import { Head, usePage } from '@inertiajs/react';
import { MentionsTable } from '@/components/investor/mentions-table';
import {
    channelColumn,
    countryColumn,
    currencyColumn,
    entityColumn,
    exchangeColumn,
    postedColumn,
    priceColumn,
    reachColumn,
    sentimentColumn,
    sourceColumn,
    titleColumn,
} from '@/components/investor/mentions-table-columns';
import type { Mention } from '@/types/investor';

interface ScreenerProps {
    recentMentions: Mention[];
}

export default function Screener({ recentMentions }: ScreenerProps) {
    const { brand } = usePage().props;
    const plural = brand.copy.entityNounPlural;

    return (
        <>
            <Head title="Screener" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight capitalize">
                    {plural} screener
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Latest mentions across the {plural} we track — filter,
                    group, and search to find what matters.
                </p>
            </div>

            <MentionsTable
                mentions={recentMentions}
                paramPrefix="sm"
                columns={[
                    sourceColumn,
                    titleColumn,
                    entityColumn,
                    channelColumn,
                    ...(brand.hasPrice
                        ? [priceColumn, countryColumn, exchangeColumn, currencyColumn]
                        : []),
                    postedColumn,
                    sentimentColumn,
                    reachColumn,
                ]}
            />
        </>
    );
}
