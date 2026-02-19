'use client';

import { BottomNav } from './BottomNav';

type Product = {
  id: string;
  name: string;
  status: string;
};

type LayoutWrapperProps = {
  children: React.ReactNode;
  products: Product[];
};

export function LayoutWrapper({ children, products }: LayoutWrapperProps) {
  return (
    <div className="flex min-h-screen min-w-0 bg-[var(--bg)]">
      <main className="min-w-0 flex-1 overflow-auto overflow-x-hidden pb-[72px] md:pb-6">
        <div className="mx-auto w-full min-w-0 max-w-[640px] px-4 py-6">
          {children}
        </div>
      </main>
      <BottomNav products={products} />
    </div>
  );
}
