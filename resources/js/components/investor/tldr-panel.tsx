import { Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Tldr } from '@/types/investor';

export function TldrPanel({ tldr }: { tldr: Tldr }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="size-4 text-primary" />
                    AI summary
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    {tldr.paragraph}
                </p>

                {tldr.keyTakeaways.length > 0 && (
                    <ul className="space-y-1.5">
                        {tldr.keyTakeaways.map((takeaway) => (
                            <li key={takeaway} className="flex gap-2 text-sm">
                                <span className="text-primary">•</span>
                                <span>{takeaway}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {tldr.platformConsensus && (
                    <p className="text-sm">
                        <span className="text-muted-foreground">
                            Consensus:{' '}
                        </span>
                        <span className="font-medium">
                            {tldr.platformConsensus}
                        </span>
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
