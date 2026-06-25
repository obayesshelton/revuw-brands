import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance } from '@/hooks/use-appearance';

const order: Appearance[] = ['light', 'dark', 'system'];

const icons = {
    light: Sun,
    dark: Moon,
    system: Monitor,
} as const;

export function AppearanceToggle() {
    const { appearance, updateAppearance } = useAppearance();
    const Icon = icons[appearance];

    const cycle = () => {
        const next = order[(order.indexOf(appearance) + 1) % order.length];
        updateAppearance(next);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={cycle}
            aria-label={`Appearance: ${appearance}`}
            title={`Appearance: ${appearance}`}
        >
            <Icon className="size-5" />
        </Button>
    );
}
