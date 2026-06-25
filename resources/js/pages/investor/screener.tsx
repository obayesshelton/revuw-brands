import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MentionSparkline } from '@/components/investor/mention-sparkline';
import { PriceTag } from '@/components/investor/price-tag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCompact, pluralize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    EntitySummary,
    Paginated,
    ScreenerFilters,
} from '@/types/investor';

interface ScreenerProps {
    result: Paginated<EntitySummary>;
    filters: ScreenerFilters;
}

type SortKey = ScreenerFilters['sort'];

export default function Screener({ result, filters }: ScreenerProps) {
    const { brand } = usePage().props;
    const plural = brand.copy.entityNounPlural;
    const [query, setQuery] = useState(filters.q);
    const firstRender = useRef(true);

    const apply = (changes: Partial<ScreenerFilters>) => {
        const next = { ...filters, ...changes };

        router.get(
            '/screener',
            {
                q: next.q || undefined,
                minMentions: next.minMentions ?? undefined,
                sort: next.sort,
                dir: next.dir,
                page: changes.page ?? 1,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const toggleSort = (key: SortKey) => {
        if (filters.sort === key) {
            apply({ dir: filters.dir === 'asc' ? 'desc' : 'asc' });
        } else {
            apply({ sort: key, dir: key === 'name' ? 'asc' : 'desc' });
        }
    };

    // Debounce the search box -> URL.
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const handle = setTimeout(() => apply({ q: query, page: 1 }), 300);

        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const { page, lastPage, total } = result.meta;

    return (
        <>
            <Head title="Screener" />

            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight capitalize">
                    {plural} screener
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Filter and sort {plural} by mention volume and name.
                </p>
            </div>

            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative sm:max-w-xs sm:flex-1">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={`Search ${plural}…`}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        value={filters.minMentions ?? ''}
                        onChange={(event) =>
                            apply({
                                minMentions:
                                    event.target.value === ''
                                        ? null
                                        : Number(event.target.value),
                                page: 1,
                            })
                        }
                        placeholder="Min mentions"
                        className="w-36"
                    />
                </div>
            </div>

            <div className="rounded-xl border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableHead
                                label="Name"
                                sortKey="name"
                                filters={filters}
                                onSort={toggleSort}
                            />
                            <SortableHead
                                label="Mentions"
                                sortKey="mentionCount"
                                filters={filters}
                                onSort={toggleSort}
                                className="text-right"
                            />
                            <SortableHead
                                label="Videos"
                                sortKey="contentCount"
                                filters={filters}
                                onSort={toggleSort}
                                className="hidden text-right sm:table-cell"
                            />
                            <TableHead className="hidden text-right md:table-cell">
                                Trend
                            </TableHead>
                            <TableHead className="text-right">
                                {brand.hasPrice ? 'Price' : 'Valuation'}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {result.data.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="py-12 text-center text-muted-foreground"
                                >
                                    No {plural} match your filters.
                                </TableCell>
                            </TableRow>
                        ) : (
                            result.data.map((entity) => (
                                <TableRow key={entity.id}>
                                    <TableCell>
                                        <Link
                                            href={`/entities/${entity.slug}`}
                                            className="font-medium hover:text-primary"
                                        >
                                            {entity.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCompact(entity.mentionCount)}
                                    </TableCell>
                                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                                        {formatCompact(entity.contentCount)}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        <div className="flex justify-end">
                                            <MentionSparkline
                                                data={entity.monthlyMentions}
                                                width={80}
                                                height={24}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {entity.ticker ? (
                                            <PriceTag
                                                ticker={entity.ticker}
                                                className="justify-end"
                                            />
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                {entity.headlineStat?.value ??
                                                    '—'}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {total} {pluralize(total, brand.copy.entityNoun)}
                </p>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page <= 1}
                        onClick={() => apply({ page: page - 1 })}
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
                        onClick={() => apply({ page: page + 1 })}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </>
    );
}

function SortableHead({
    label,
    sortKey,
    filters,
    onSort,
    className,
}: {
    label: string;
    sortKey: SortKey;
    filters: ScreenerFilters;
    onSort: (key: SortKey) => void;
    className?: string;
}) {
    const active = filters.sort === sortKey;
    const Icon = !active
        ? ArrowUpDown
        : filters.dir === 'asc'
          ? ArrowUp
          : ArrowDown;

    return (
        <TableHead className={className}>
            <button
                type="button"
                onClick={() => onSort(sortKey)}
                className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground',
                    className?.includes('text-right') && 'flex-row-reverse',
                    active ? 'text-foreground' : 'text-muted-foreground',
                )}
            >
                {label}
                <Icon className="size-3.5" />
            </button>
        </TableHead>
    );
}
