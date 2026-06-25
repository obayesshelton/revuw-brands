import { usePage } from '@inertiajs/react';

export function BrandLogo() {
    const { brand } = usePage().props;
    const mark =
        brand.name
            .replace(/^revuw\s*/i, '')
            .charAt(0)
            .toUpperCase() || 'R';

    return (
        <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                {mark}
            </span>
            <span className="text-base font-semibold tracking-tight">
                {brand.name}
            </span>
        </span>
    );
}
