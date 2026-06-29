import { ChevronRight, Columns3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { SearchInput } from '@/components/investor/search-input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useInitials } from '@/hooks/use-initials';
import type { SortKey } from '@/hooks/use-mentions-table-state';
import { useMentionsTableState } from '@/hooks/use-mentions-table-state';
import { SENTIMENT_HEX, SOURCE_HEX } from '@/lib/colors';
import { SOURCE_LABEL } from '@/lib/colors';
import { cn } from '@/lib/utils';
import type { Mention, ChatterSource } from '@/types/investor';
import type { MentionColumn } from './mentions-table-columns';

export interface MentionsTableProps {
    mentions: Mention[];
    columns: MentionColumn[];
    title?: ReactNode;
    description?: ReactNode;
    /**
     * Prefix for URL query keys, so multiple tables can coexist on a page.
     * "m" by default; the screener uses "sm".
     */
    paramPrefix?: string;
    defaultSort?: SortKey;
    defaultGroup?: boolean;
    /**
     * Which source chips to render in the toolbar. Defaults to all known
     * sources; a chip is auto-disabled when its source has zero rows.
     */
    sources?: ChatterSource[];
    /** Optional empty-state message override. */
    emptyMessage?: string;
}

const ALL_SOURCES: ChatterSource[] = ['youtube', 'eod_news', 'reddit', 'revuw'];

export function MentionsTable({
    mentions,
    columns,
    title,
    description,
    paramPrefix = 'm',
    defaultSort = 'newest',
    defaultGroup = false,
    sources = ALL_SOURCES,
    emptyMessage = 'No mentions match your filters.',
}: MentionsTableProps) {
    const { state, set } = useMentionsTableState(paramPrefix, {
        sort: defaultSort,
        group: defaultGroup,
    });

    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const [searchInput, setSearchInput] = useState(state.q);

    useEffect(() => {
        if (searchInput === state.q) {
            return;
        }

        const handle = setTimeout(() => set({ q: searchInput }), 250);

        return () => clearTimeout(handle);
    }, [searchInput, state.q, set]);

    const sourceCounts = useMemo(() => {
        const counts: Partial<Record<ChatterSource, number>> = {};

        for (const m of mentions) {
            counts[m.source] = (counts[m.source] ?? 0) + 1;
        }

        return counts;
    }, [mentions]);

    const filtered = useMemo(() => {
        const q = state.q.trim().toLowerCase();

        return mentions.filter((m) => {
            if (state.source !== 'all' && m.source !== state.source) {
                return false;
            }

            if (q === '') {
                return true;
            }

            return (
                m.title.toLowerCase().includes(q) ||
                m.channel.name.toLowerCase().includes(q) ||
                (m.entity?.name.toLowerCase().includes(q) ?? false)
            );
        });
    }, [mentions, state.source, state.q]);

    const sorted = useMemo(() => {
        const arr = filtered.slice();

        if (state.sort === 'newest') {
            arr.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        } else if (state.sort === 'reach') {
            arr.sort((a, b) => b.reach - a.reach);
        } else {
            arr.sort(
                (a, b) =>
                    sentimentOrdinal(b.sentiment) -
                    sentimentOrdinal(a.sentiment),
            );
        }

        return arr;
    }, [filtered, state.sort]);

    const visibleColumns = useMemo(() => {
        const visible = columns.filter((c) => !state.hidden.includes(c.key));

        // Channel column duplicates the group header when grouping is on.
        return state.group
            ? visible.filter((c) => c.key !== 'channel')
            : visible;
    }, [columns, state.hidden, state.group]);

    const groups = useMemo(() => {
        if (!state.group) {
            return null;
        }

        const map = new Map<string, Mention[]>();

        for (const m of sorted) {
            const existing = map.get(m.channel.id);

            if (existing) {
                existing.push(m);
            } else {
                map.set(m.channel.id, [m]);
            }
        }

        return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
    }, [sorted, state.group]);

    const gridTemplate = visibleColumns
        .map((c) => c.width ?? 'minmax(0, 1fr)')
        .join(' ');

    const optionalColumns = columns.filter((c) => c.optional);

    return (
        <div className="overflow-hidden rounded-xl border bg-card">
            <Toolbar
                title={title}
                description={description}
                count={filtered.length}
                state={state}
                set={set}
                sources={sources}
                sourceCounts={sourceCounts}
                searchInput={searchInput}
                onSearchChange={setSearchInput}
                optionalColumns={optionalColumns}
            />

            {/* Column header */}
            <div
                className="grid gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase"
                style={{ gridTemplateColumns: gridTemplate }}
                role="row"
            >
                {visibleColumns.map((c) => (
                    <div
                        key={c.key}
                        className={cn(
                            'min-w-0',
                            c.align === 'right' && 'text-right',
                            c.headClassName,
                        )}
                        role="columnheader"
                    >
                        {c.label}
                    </div>
                ))}
            </div>

            {/* Rows */}
            <div role="rowgroup">
                {sorted.length === 0 ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                        {emptyMessage}
                    </div>
                ) : groups ? (
                    groups.map(([channelId, list]) => {
                        const isCollapsed = collapsed[channelId] ?? false;

                        return (
                            <GroupBlock
                                key={channelId}
                                channelId={channelId}
                                mentions={list}
                                columns={visibleColumns}
                                gridTemplate={gridTemplate}
                                collapsed={isCollapsed}
                                onToggle={() =>
                                    setCollapsed((c) => ({
                                        ...c,
                                        [channelId]: !c[channelId],
                                    }))
                                }
                            />
                        );
                    })
                ) : (
                    sorted.map((m) => (
                        <Row
                            key={m.id}
                            mention={m}
                            columns={visibleColumns}
                            gridTemplate={gridTemplate}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function Toolbar({
    title,
    description,
    count,
    state,
    set,
    sources,
    sourceCounts,
    searchInput,
    onSearchChange,
    optionalColumns,
}: {
    title: ReactNode;
    description: ReactNode;
    count: number;
    state: ReturnType<typeof useMentionsTableState>['state'];
    set: ReturnType<typeof useMentionsTableState>['set'];
    sources: ChatterSource[];
    sourceCounts: Partial<Record<ChatterSource, number>>;
    searchInput: string;
    onSearchChange: (value: string) => void;
    optionalColumns: MentionColumn[];
}) {
    return (
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-end lg:justify-between">
            {(title || description) && (
                <div>
                    {title && (
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-semibold">{title}</h2>
                            <Badge
                                variant="secondary"
                                className="font-semibold"
                            >
                                {count}
                            </Badge>
                        </div>
                    )}
                    {description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                    <SourceChip
                        active={state.source === 'all'}
                        onClick={() => set({ source: 'all' })}
                        label="All"
                    />
                    {sources.map((src) => (
                        <SourceChip
                            key={src}
                            source={src}
                            active={state.source === src}
                            disabled={(sourceCounts[src] ?? 0) === 0}
                            onClick={() => set({ source: src })}
                            label={SOURCE_LABEL[src]}
                        />
                    ))}
                </div>

                <Select
                    value={state.sort}
                    onValueChange={(v) => set({ sort: v as SortKey })}
                >
                    <SelectTrigger size="sm" className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="reach">Most reach</SelectItem>
                        <SelectItem value="bullish">Most bullish</SelectItem>
                    </SelectContent>
                </Select>

                <div className="flex gap-0.5 rounded-md bg-muted p-0.5">
                    <GroupTab
                        active={!state.group}
                        onClick={() => set({ group: false })}
                        label="All"
                    />
                    <GroupTab
                        active={state.group}
                        onClick={() => set({ group: true })}
                        label="By source"
                    />
                </div>

                <SearchInput
                    value={searchInput}
                    onChange={onSearchChange}
                    placeholder="Search mentions…"
                    className="w-48"
                />

                {optionalColumns.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                aria-label="Toggle columns"
                            >
                                <Columns3 className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {optionalColumns.map((c) => {
                                const visible = !state.hidden.includes(c.key);

                                return (
                                    <DropdownMenuCheckboxItem
                                        key={c.key}
                                        checked={visible}
                                        onCheckedChange={(checked) => {
                                            const without = state.hidden.filter(
                                                (k) => k !== c.key,
                                            );
                                            set({
                                                hidden: checked
                                                    ? without
                                                    : [...without, c.key],
                                            });
                                        }}
                                    >
                                        {c.label}
                                    </DropdownMenuCheckboxItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}

function SourceChip({
    label,
    active,
    disabled,
    source,
    onClick,
}: {
    label: string;
    active: boolean;
    disabled?: boolean;
    source?: ChatterSource;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                disabled && 'cursor-not-allowed opacity-50 hover:bg-muted',
            )}
        >
            {source && (
                <span
                    className="size-1.5 rounded-full"
                    style={{ background: SOURCE_HEX[source] ?? '#94a3b8' }}
                />
            )}
            {label}
        </button>
    );
}

function GroupTab({
    label,
    active,
    onClick,
}: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-semibold transition-colors',
                active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
            )}
        >
            {label}
        </button>
    );
}

function Row({
    mention,
    columns,
    gridTemplate,
    indent,
}: {
    mention: Mention;
    columns: MentionColumn[];
    gridTemplate: string;
    indent?: boolean;
}) {
    return (
        <div
            role="row"
            className={cn(
                'grid gap-3 border-b px-4 py-3 last:border-b-0',
                indent && 'bg-muted/20 pl-10',
            )}
            style={{ gridTemplateColumns: gridTemplate }}
        >
            {columns.map((c) => (
                <div
                    key={c.key}
                    className={cn(
                        'min-w-0 self-center',
                        c.align === 'right' && 'text-right',
                        c.cellClassName,
                    )}
                    role="cell"
                >
                    {c.render(mention)}
                </div>
            ))}
        </div>
    );
}

function GroupBlock({
    channelId,
    mentions,
    columns,
    gridTemplate,
    collapsed,
    onToggle,
}: {
    channelId: string;
    mentions: Mention[];
    columns: MentionColumn[];
    gridTemplate: string;
    collapsed: boolean;
    onToggle: () => void;
}) {
    const getInitials = useInitials();
    const head = mentions[0];
    const bullPct = bullishPercent(mentions);
    const tone = bullishTone(bullPct);

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                aria-controls={`mentions-group-${channelId}`}
                className="flex w-full items-center gap-3 border-b bg-muted/30 px-4 py-2.5 text-left hover:bg-muted/50"
            >
                <ChevronRight
                    className={cn(
                        'size-4 shrink-0 text-muted-foreground transition-transform',
                        !collapsed && 'rotate-90',
                    )}
                />
                <Avatar className="size-7 shrink-0">
                    <AvatarImage
                        src={head.channel.thumbnail}
                        alt={head.channel.name}
                    />
                    <AvatarFallback className="text-[10px]">
                        {getInitials(head.channel.name)}
                    </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm font-semibold">
                    {head.channel.name}
                </span>
                <span
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                        background: `${SOURCE_HEX[head.source] ?? '#64748b'}22`,
                        color: SOURCE_HEX[head.source] ?? '#64748b',
                    }}
                >
                    {SOURCE_LABEL[head.source]}
                </span>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">
                    {mentions.length}{' '}
                    {mentions.length === 1 ? 'mention' : 'mentions'}
                </span>
                <div className="flex w-[150px] items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full"
                            style={{
                                width: `${Math.max(4, bullPct)}%`,
                                background: tone.color,
                            }}
                        />
                    </div>
                    <span
                        className="w-10 text-right text-xs font-semibold tabular-nums"
                        style={{ color: tone.color }}
                    >
                        {bullPct}%
                    </span>
                </div>
            </button>
            {!collapsed && (
                <div id={`mentions-group-${channelId}`} role="rowgroup">
                    {mentions.map((m) => (
                        <Row
                            key={m.id}
                            mention={m}
                            columns={columns}
                            gridTemplate={gridTemplate}
                            indent
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function sentimentOrdinal(s: Mention['sentiment']): number {
    if (s === 'positive') {
        return 2;
    }

    if (s === 'neutral') {
        return 1;
    }

    if (s === 'negative') {
        return 0;
    }

    return -1;
}

function bullishPercent(list: Mention[]): number {
    const rated = list.filter((m) => m.sentiment !== null);

    if (rated.length === 0) {
        return 0;
    }

    const positives = rated.filter((m) => m.sentiment === 'positive').length;

    return Math.round((positives / rated.length) * 100);
}

function bullishTone(pct: number): { color: string } {
    if (pct >= 60) {
        return { color: SENTIMENT_HEX.positive };
    }

    if (pct >= 30) {
        return { color: SENTIMENT_HEX.neutral };
    }

    return { color: SENTIMENT_HEX.negative };
}
