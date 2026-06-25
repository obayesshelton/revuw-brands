import { Link, usePage } from '@inertiajs/react';
import { Menu } from 'lucide-react';
import { AppearanceToggle } from '@/components/investor/appearance-toggle';
import { BrandLogo } from '@/components/investor/brand-logo';
import { GlobalSearch } from '@/components/investor/global-search';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { UserMenuContent } from '@/components/user-menu-content';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';

function useNavItems() {
    const { brand } = usePage().props;
    const plural = brand.copy.entityNounPlural;

    return [
        { title: 'Home', href: '/' },
        {
            title: plural.charAt(0).toUpperCase() + plural.slice(1),
            href: '/screener',
        },
        { title: 'Channels', href: '/channels' },
    ];
}

export function BrandHeader() {
    const { auth } = usePage().props;
    const navItems = useNavItems();
    const { isCurrentUrl, isCurrentOrParentUrl } = useCurrentUrl();
    const getInitials = useInitials();

    const isActive = (href: string) =>
        href === '/' ? isCurrentUrl(href) : isCurrentOrParentUrl(href);

    return (
        <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
                {/* Mobile menu */}
                <div className="md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Open menu"
                            >
                                <Menu className="size-5" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64">
                            <SheetHeader>
                                <SheetTitle className="text-left">
                                    <BrandLogo />
                                </SheetTitle>
                            </SheetHeader>
                            <nav className="mt-6 flex flex-col gap-1 px-2">
                                {navItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={cn(
                                            'rounded-md px-3 py-2 text-sm font-medium',
                                            isActive(item.href)
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:bg-accent/60',
                                        )}
                                    >
                                        {item.title}
                                    </Link>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>

                <Link href="/" className="shrink-0">
                    <BrandLogo />
                </Link>

                {/* Desktop nav */}
                <nav className="hidden items-center gap-1 md:flex">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                                isActive(item.href)
                                    ? 'text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {item.title}
                        </Link>
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-2">
                    <GlobalSearch className="hidden w-56 sm:block lg:w-72" />
                    <AppearanceToggle />

                    {auth.user ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="size-9 rounded-full p-1"
                                >
                                    <Avatar className="size-8">
                                        <AvatarImage
                                            src={auth.user.avatar}
                                            alt={auth.user.name}
                                        />
                                        <AvatarFallback>
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="ghost" size="sm" asChild>
                            <Link href="/login">Log in</Link>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
