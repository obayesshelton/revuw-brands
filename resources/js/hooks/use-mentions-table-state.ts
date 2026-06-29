import { useCallback, useState } from 'react';
import type { ChatterSource } from '@/types/investor';

export type SortKey = 'newest' | 'reach' | 'bullish';
export type SourceFilter = ChatterSource | 'all';

export interface MentionsTableState {
    source: SourceFilter;
    sort: SortKey;
    group: boolean;
    q: string;
    hidden: string[];
}

export interface MentionsTableStateInit {
    source?: SourceFilter;
    sort?: SortKey;
    group?: boolean;
    q?: string;
    hidden?: string[];
}

const VALID_SORT: ReadonlySet<SortKey> = new Set<SortKey>([
    'newest',
    'reach',
    'bullish',
]);
const VALID_SOURCE: ReadonlySet<SourceFilter> = new Set<SourceFilter>([
    'all',
    'youtube',
    'eod_news',
    'reddit',
    'revuw',
]);

function readUrl(
    prefix: string,
    defaults: MentionsTableState,
): MentionsTableState {
    if (typeof window === 'undefined') {
        return defaults;
    }

    const params = new URLSearchParams(window.location.search);
    const source = params.get(`${prefix}_src`);
    const sort = params.get(`${prefix}_sort`);
    const group = params.get(`${prefix}_grp`);
    const q = params.get(`${prefix}_q`);
    const hidden = params.get(`${prefix}_hide`);

    return {
        source:
            source !== null && VALID_SOURCE.has(source as SourceFilter)
                ? (source as SourceFilter)
                : defaults.source,
        sort:
            sort !== null && VALID_SORT.has(sort as SortKey)
                ? (sort as SortKey)
                : defaults.sort,
        group: group !== null ? group === '1' : defaults.group,
        q: q ?? defaults.q,
        hidden:
            hidden !== null
                ? hidden.split(',').filter(Boolean)
                : defaults.hidden,
    };
}

/**
 * Write only non-default keys back to the URL so a clean view stays a clean
 * URL. Uses history.replaceState so the address bar updates without an
 * Inertia round-trip — filtering happens in-memory in the component.
 */
function writeUrl(
    prefix: string,
    state: MentionsTableState,
    defaults: MentionsTableState,
): void {
    if (typeof window === 'undefined') {
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const put = (key: string, value: string, isDefault: boolean): void => {
        if (isDefault) {
            params.delete(key);
        } else {
            params.set(key, value);
        }
    };

    put(`${prefix}_src`, state.source, state.source === defaults.source);
    put(`${prefix}_sort`, state.sort, state.sort === defaults.sort);
    put(
        `${prefix}_grp`,
        state.group ? '1' : '0',
        state.group === defaults.group,
    );
    put(`${prefix}_q`, state.q, state.q === defaults.q);
    put(
        `${prefix}_hide`,
        state.hidden.join(','),
        state.hidden.length === defaults.hidden.length &&
            state.hidden.every((k, i) => k === defaults.hidden[i]),
    );

    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', next);
}

/**
 * URL-backed state for a MentionsTable. The hook holds the UI state in React
 * and mirrors it into the URL via history.replaceState so a configured view
 * is always shareable — no server round-trip on filter changes. Multiple
 * tables on a page can coexist by passing distinct `prefix` values (e.g.
 * "m" and "sm"), the same trick Laravel pagination uses to namespace `page=`.
 */
export function useMentionsTableState(
    prefix = 'm',
    init: MentionsTableStateInit = {},
): {
    state: MentionsTableState;
    set: (patch: Partial<MentionsTableState>) => void;
} {
    const defaults: MentionsTableState = {
        source: init.source ?? 'all',
        sort: init.sort ?? 'newest',
        group: init.group ?? false,
        q: init.q ?? '',
        hidden: init.hidden ?? [],
    };

    const [state, setState] = useState<MentionsTableState>(() =>
        readUrl(prefix, defaults),
    );

    const set = useCallback(
        (patch: Partial<MentionsTableState>) => {
            setState((prev) => {
                const next = { ...prev, ...patch };
                writeUrl(prefix, next, defaults);

                return next;
            });
        },
        // defaults is rebuilt every render but its values come from `init`;
        // wrapping it would force the caller to memo. Re-running the callback
        // when defaults change is cheap and correct.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [prefix, defaults.source, defaults.sort, defaults.group, defaults.q],
    );

    return { state, set };
}
