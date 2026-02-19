import type { Metadata } from 'next';
import { getProducts } from '@/lib/database';
import { LayoutWrapper } from '@/components/LayoutWrapper';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'PMF Machine',
  description: 'Find what sells. Kill what doesn’t.',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let products: { id: string; name: string; status: string }[] = [];

  try {
    const data = await getProducts();
    products = (data ?? []).map((p) => ({
      id: p.id,
      name: p.name ?? 'Unnamed',
      status: (p.status as string) ?? 'active',
    }));
  } catch {
    // Silently fall back to empty products if DB not ready
  }

  return (
    <html lang="en">
      <body className="antialiased">
        <ToastProvider>
          <LayoutWrapper products={products}>{children}</LayoutWrapper>
        </ToastProvider>
      </body>
    </html>
  );
}
