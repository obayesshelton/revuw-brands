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
