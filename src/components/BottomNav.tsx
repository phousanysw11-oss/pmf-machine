'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type Product = { id: string; name: string; status: string };

type BottomNavProps = {
  products: Product[];
};

export function BottomNav({ products }: BottomNavProps) {
  const pathname = usePathname();
  const killedCount = products.filter((p) => p.status === 'killed').length;

  const tabs = [
    { href: '/', label: 'Home', emoji: '🏠' },
    { href: '/', label: 'Product', emoji: '📦' },
    {
      href: '/products/killed',
      label: 'Archive',
      emoji: '💀',
      badge: killedCount > 0 ? killedCount : undefined,
    },
    { href: '/settings', label: 'Settings', emoji: '⚙️' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-[60px] items-center justify-around border-t border-[var(--border)] bg-[var(--surface)] md:hidden"
      aria-label="Bottom navigation"
    >
      {tabs.map(({ href, label, emoji, badge }) => {
        const active =
          pathname === href ||
          (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href + label}
            href={href}
            className={cn(
              'flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-150',
              active ? 'text-[var(--cyan)]' : 'text-[var(--text-muted)]'
            )}
          >
            <span className="relative text-xl">
              {emoji}
              {badge != null && badge > 0 && (
                <span
                  className="absolute -right-2 -top-1 flex h-4 min-w-[18px] items-center justify-center rounded-full bg-[var(--green)] px-1 text-[10px] font-bold text-black"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {badge}
                </span>
              )}
            </span>
            <span
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
