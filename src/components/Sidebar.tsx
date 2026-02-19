'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  PackageX,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Product = {
  id: string;
  name: string;
  status: string;
};

type SidebarProps = {
  products: Product[];
  killedProducts?: Product[];
  onMenuToggle?: () => void;
  isMobileOpen?: boolean;
};

export function Sidebar({
  products,
  killedProducts = [],
  onMenuToggle,
  isMobileOpen = false,
}: SidebarProps) {
  const pathname = usePathname();
  const [killedOpen, setKilledOpen] = useState(false);

  const activeProducts = products.filter((p) => p.status !== 'killed');
  const killed = killedProducts.length
    ? killedProducts
    : products.filter((p) => p.status === 'killed');

  const navLink = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      onClick={onMenuToggle}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        pathname === href
          ? 'bg-slate-700/50 text-white'
          : 'text-slate-300 hover:bg-slate-700/30 hover:text-white'
      )}
    >
      {icon}
      {label}
    </Link>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col bg-zinc-900">
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <Package className="h-6 w-6 text-emerald-500" />
          PMF Machine
        </Link>
        {onMenuToggle && (
          <button
            onClick={onMenuToggle}
            className="rounded p-1 text-slate-400 hover:bg-zinc-800 hover:text-white lg:hidden"
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navLink('/', 'Dashboard', <LayoutDashboard className="h-5 w-5 shrink-0" />)}

        <div className="pt-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Products
          </p>
          <div className="space-y-0.5">
            {activeProducts.length === 0 ? (
              <p className="px-3 text-sm text-slate-500">No active products</p>
            ) : (
              activeProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={onMenuToggle}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname === `/products/${product.id}`
                      ? 'bg-slate-700/50 text-white'
                      : 'text-slate-300 hover:bg-slate-700/30 hover:text-white'
                  )}
                >
                  <Package className="h-4 w-4 shrink-0" />
                  <span className="truncate">{product.name}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        {killed.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setKilledOpen(!killedOpen)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-700/30 hover:text-slate-300"
            >
              <span className="flex items-center gap-3">
                <PackageX className="h-4 w-4 shrink-0" />
                Killed Products ({killed.length})
              </span>
              {killedOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            {killedOpen && (
              <div className="mt-1 space-y-0.5 pl-4">
                <Link
                  href="/products/killed"
                  onClick={onMenuToggle}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname === '/products/killed'
                      ? 'bg-slate-700/50 text-white'
                      : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                  )}
                >
                  View all killed
                </Link>
                {killed.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}/killed`}
                    onClick={onMenuToggle}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                      pathname === `/products/${product.id}/killed`
                        ? 'bg-slate-700/50 text-white'
                        : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-300'
                    )}
                  >
                    <span className="truncate">{product.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="border-t border-zinc-800 p-3">
        {navLink('/settings', 'Settings', <Settings className="h-5 w-5 shrink-0" />)}
      </div>
    </div>
  );

  if (onMenuToggle) {
    return (
      <>
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform lg:relative lg:translate-x-0',
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          {sidebarContent}
        </aside>
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={onMenuToggle}
            aria-hidden="true"
          />
        )}
      </>
    );
  }

  return (
    <aside className="hidden w-64 shrink-0 lg:block">
      {sidebarContent}
    </aside>
  );
}
