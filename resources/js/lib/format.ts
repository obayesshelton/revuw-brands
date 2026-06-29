export function formatCompact(value: number): string {
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
}

export function formatCurrency(value: number, currency = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatSignedPercent(value: number): string {
    const sign = value > 0 ? '+' : '';

    return `${sign}${value.toFixed(2)}%`;
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/** 'YYYY-MM' -> 'Mar' */
export function formatMonthShort(month: string): string {
    const [year, m] = month.split('-').map(Number);

    return new Date(year, m - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
    });
}

/** Unix seconds -> 'Jun 26, 3:42 PM'. EODHD quotes return seconds since epoch. */
export function formatUnixDateTime(unixSeconds: number): string {
    return new Date(unixSeconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

/** ISO date -> '2h ago' / '3d ago' / 'Mar 4'. Falls back to absolute date past 30 days. */
export function formatTimeAgo(iso: string): string {
    const past = new Date(iso).getTime();
    const diffSec = Math.max(0, (Date.now() - past) / 1000);

    if (diffSec < 60) {
return 'just now';
}

    if (diffSec < 3600) {
return `${Math.floor(diffSec / 60)}m ago`;
}

    if (diffSec < 86400) {
return `${Math.floor(diffSec / 3600)}h ago`;
}

    if (diffSec < 86400 * 30) {
return `${Math.floor(diffSec / 86400)}d ago`;
}

    return formatDate(iso);
}

/** seconds -> 'm:ss' */
export function formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);

    return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

export function pluralize(
    count: number,
    singular: string,
    plural?: string,
): string {
    return count === 1 ? singular : (plural ?? `${singular}s`);
}
