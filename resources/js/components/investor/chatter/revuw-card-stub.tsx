import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
    Collapsible,
    CollapsibleContent,
} from '@/components/ui/collapsible';
import type { Video } from '@/types/investor';
import { ChatterRow } from './chatter-row';

export function RevuwCardStub({ video }: { video: Video }) {
    const [isOpen, setOpen] = useState(false);

    return (
        <Collapsible open={isOpen} onOpenChange={setOpen}>
            <ChatterRow
                video={video}
                leadingVisual={
                    <div className="size-10 shrink-0 rounded-md bg-muted" />
                }
                sourceIcon={<Sparkles className="size-3.5" aria-hidden />}
                isOpen={isOpen}
                onToggle={() => setOpen(!isOpen)}
                onChipClick={() => setOpen(true)}
                activeTicker={null}
            />
            <CollapsibleContent>
                <p className="border-t bg-card px-4 py-6 text-sm text-muted-foreground">
                    Revuw article view is coming soon.
                </p>
            </CollapsibleContent>
        </Collapsible>
    );
}
