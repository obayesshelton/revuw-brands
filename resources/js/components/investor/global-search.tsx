import { router, usePage } from '@inertiajs/react';
import { Search } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function GlobalSearch({ className }: { className?: string }) {
    const { brand } = usePage().props;
    const [query, setQuery] = useState('');

    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get('/screener', query.trim() ? { q: query.trim() } : {}, {
            preserveState: false,
        });
    };

    return (
        <form
            onSubmit={submit}
            className={cn('relative w-full', className)}
            role="search"
        >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${brand.copy.entityNounPlural}…`}
                className="pl-9"
                aria-label={`Search ${brand.copy.entityNounPlural}`}
            />
        </form>
    );
}
