import type { ReactNode } from 'react';
import { BrandHeader } from '@/components/investor/brand-header';
import { PageContainer } from '@/components/investor/page-container';

export default function InvestorLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <BrandHeader />
            <main className="flex-1">
                <PageContainer>{children}</PageContainer>
            </main>
        </div>
    );
}
