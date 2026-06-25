import { Head, router } from '@inertiajs/react';
import { Search, Tv } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChannelCardGrid } from '@/components/investor/channel-card-grid';
import { EmptyState } from '@/components/investor/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { pluralize } from '@/lib/format';
import type { ChannelSummary, Paginated } from '@/types/investor';

interface ChannelsProps {
    result: Paginated<ChannelSummary>;
    filters: { q: string };
}

export default function Channels({ result, filters }: ChannelsProps) {
    const [query, setQuery] = useState(filters.q);
    const firstRender = useRef(true);

    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const handle = setTimeout(() => {
            router.get(
                '/channels',
                { q: query.trim() || undefined },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);

        return () => clearTimeout(handle);
    }, [query]);

    const { page, lastPage, total } = result.meta;

    const goTo = (target: number) =>
        router.get(
            '/channels',
            { q: filters.q || undefined, page: target },
            { preserveState: true, preserveScroll: true, replace: true },
        );

    return (
        <>
            <Head title="Channels" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">Channels</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Search the YouTube channels we track.
                </p>
            </div>

            <div className="relative mb-6 max-w-md">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search channels…"
                    className="pl-9"
                />
            </div>

            {result.data.length === 0 ? (
                <EmptyState
                    icon={Tv}
                    title="No channels found"
                    description="Try a different search term."
                />
            ) : (
                <>
                    <ChannelCardGrid channels={result.data} />

                    <div className="mt-6 flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                            {total} {pluralize(total, 'channel')}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => goTo(page - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Page {page} of {lastPage}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= lastPage}
                                onClick={() => goTo(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
