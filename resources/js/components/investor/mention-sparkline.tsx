import type { MonthlyMention } from '@/types/investor';

/**
 * Tiny dependency-free SVG sparkline for a card's monthly mention history.
 * Hand-rolled (rather than recharts) so grids of cards stay cheap.
 */
export function MentionSparkline({
    data,
    width = 96,
    height = 32,
    className,
}: {
    data: MonthlyMention[];
    width?: number;
    height?: number;
    className?: string;
}) {
    if (data.length === 0) {
        return null;
    }

    const counts = data.map((point) => point.count);
    const max = Math.max(1, ...counts);
    const step = data.length > 1 ? width / (data.length - 1) : width;

    const points = counts.map((count, index) => {
        const x = index * step;
        const y = height - (count / max) * (height - 2) - 1;

        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const line = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`)
        .join(' ');
    const area = `${line} L${width},${height} L0,${height} Z`;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className={className}
            preserveAspectRatio="none"
            aria-hidden="true"
        >
            <path d={area} className="fill-primary/10" />
            <path
                d={line}
                className="fill-none stroke-primary"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}
