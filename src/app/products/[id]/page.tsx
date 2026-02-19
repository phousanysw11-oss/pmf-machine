import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getProductFlows, getLatestFinalVerdict } from '@/lib/database';
import { ProductPhaseCards } from '@/components/ProductPhaseCards';

const FLOW_LABELS: Record<number, string> = {
  1: 'Pain',
  2: 'Customer',
  3: 'Solution',
  4: 'Price',
  5: 'Channel',
  6: 'Signals',
  7: 'Experiment',
  8: 'Ad Copy',
  9: 'Results',
  10: 'Verdict',
};

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flows, verdict] = await Promise.all([
    getProductFlows(params.id),
    getLatestFinalVerdict(params.id),
  ]);

  const flowMap = new Map((flows ?? []).map((f) => [f.flow_number, f]));
  const flowStatuses = Array.from({ length: 10 }, (_, i) => {
    const flowNum = i + 1;
    const row = flowMap.get(flowNum);
    const locked = row?.locked ?? false;
    return { flowNum, locked };
  });

  const lockedCount = flowStatuses.filter((f) => f.locked).length;
  const currentFlow = lockedCount < 10 ? lockedCount + 1 : 10;
  const pmfScore = verdict?.pmf_score ?? null;

  return (
    <div className="min-w-0 space-y-4 fade-up">
      {/* Back + product name */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="min-h-[44px] text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          ← Back
        </Link>
        <h1
          className="truncate text-right text-[18px] font-bold text-[var(--text)]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {product.name as string}
        </h1>
      </div>

      <ProductPhaseCards
        productId={params.id}
        flowStatuses={flowStatuses}
        currentFlow={currentFlow}
        flowLabels={FLOW_LABELS}
      />

      {/* PMF Score card */}
      <div
        className="rounded-2xl border border-[var(--border)] p-5"
        style={{ background: 'var(--card)' }}
      >
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          🏆 PMF SCORE
        </p>
        <p className="text-[28px] font-bold tabular-nums text-[var(--text)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          {pmfScore != null ? `${pmfScore}/100` : '--/100'}
        </p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          {pmfScore != null
            ? 'Your verdict is ready.'
            : 'Complete all flows to unlock your verdict.'}
        </p>
      </div>
    </div>
  );
}
