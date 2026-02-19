import Link from 'next/link';
import {
  getProducts,
  getLatestFinalVerdict,
  getProductFlows,
  getKilledProducts,
  getSignalsForProduct,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

const PROJECTED_SCALE_MULTIPLIER = 10;

function getCurrentFlowStep(flows: { flow_number: number; locked: boolean }[]): number {
  const locked = flows.filter((f) => f.locked).sort((a, b) => a.flow_number - b.flow_number);
  if (locked.length === 0) return 1;
  const maxLocked = locked[locked.length - 1]?.flow_number ?? 0;
  return Math.min(maxLocked + 1, 10);
}

function computeTotalSpend(
  signals: { experiment_id?: string; metric_name?: string; value?: number; hours_elapsed?: number }[]
): number {
  const byExperiment = new Map<string, { hours: number; spend: number }>();
  for (const s of signals) {
    if ((s.metric_name ?? '').toLowerCase() !== 'spend') continue;
    const exp = s.experiment_id ?? '';
    const hours = Number(s.hours_elapsed) ?? 0;
    const spend = Number(s.value) ?? 0;
    const cur = byExperiment.get(exp);
    if (!cur || hours > cur.hours) {
      byExperiment.set(exp, { hours, spend });
    }
  }
  return Array.from(byExperiment.values()).reduce((sum, x) => sum + x.spend, 0);
}

export default async function DashboardPage() {
  let products: Awaited<ReturnType<typeof getProducts>> = [];
  let killed: Awaited<ReturnType<typeof getKilledProducts>> = [];
  try {
    const [p, k] = await Promise.all([
      getProducts(),
      getKilledProducts(),
    ]);
    products = p ?? [];
    killed = k ?? [];
  } catch {
    products = [];
    killed = [];
  }

  const productsWithMeta = await Promise.all(
    (Array.isArray(products) ? products : []).map(async (product) => {
      const [verdict, flows] = await Promise.all([
        getLatestFinalVerdict(product.id),
        getProductFlows(product.id),
      ]);
      const currentFlow = flows?.length ? getCurrentFlowStep(flows) : 1;
      const lockedCount = (flows ?? []).filter((f) => f.locked).length;
      const progressPct = Math.round((lockedCount / 10) * 100);
      return {
        id: product.id,
        name: (product.name as string) ?? 'Unnamed',
        status: (product.status as string) ?? 'active',
        currentFlow,
        lockedCount,
        progressPct,
        pmfScore: verdict?.pmf_score ?? null,
      };
    })
  );

  const activeProducts = productsWithMeta.filter((p) => p.status !== 'killed');
  const killedProducts = productsWithMeta.filter((p) => p.status === 'killed');

  let totalSaved = 0;
  const killedWithSignals = await Promise.all(
    (Array.isArray(killed) ? killed : []).map(async (p) => {
      const signals = await getSignalsForProduct(p.id);
      const spend = computeTotalSpend(
        (signals ?? []) as { experiment_id?: string; metric_name?: string; value?: number; hours_elapsed?: number }[]
      );
      const saved = spend * PROJECTED_SCALE_MULTIPLIER;
      totalSaved += saved;
      return { id: p.id, name: (p.name as string) ?? 'Product', saved };
    })
  );

  const overallProgress =
    activeProducts.length > 0
      ? Math.round(
          activeProducts.reduce((sum, p) => sum + p.progressPct, 0) / activeProducts.length
        )
      : 0;

  return (
    <div className="min-w-0 space-y-6 fade-up">
      {/* Hero */}
      <div className="text-center">
        <h1
          className="text-[32px] font-bold leading-tight tracking-tight"
          style={{
            background: 'var(--gradient-brand)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          ⚡ PMF Machine
        </h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Find what sells. Kill what doesn&apos;t.
        </p>
      </div>

      {/* Progress card — glass */}
      <div
        className="rounded-2xl border border-[var(--border)] p-5"
        style={{
          background: 'rgba(28, 28, 34, 0.8)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          🎯 Your Progress
        </p>
        <div className="space-y-3 text-[15px]">
          <p className="text-[var(--text)]">
            Products tested: <span className="font-semibold tabular-nums">{productsWithMeta.length}</span>
          </p>
          <p className="text-[var(--text)]">
            Products killed: <span className="font-semibold tabular-nums">{killedProducts.length}</span>{' '}
            <span className="text-[var(--green)]">✓</span>
          </p>
          <p className="text-[var(--text)]">
            Money saved: <span className="font-semibold tabular-nums text-[var(--green)]">${Math.round(totalSaved)}</span>
          </p>
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
            <div
              className="h-full rounded-full transition-all duration-600"
              style={{
                width: `${overallProgress}%`,
                background: 'var(--gradient-brand)',
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {overallProgress}% — Finding your winner...
          </p>
        </div>
      </div>

      {/* Big CTA */}
      <Link
        href="/products/new"
        className="block rounded-2xl border border-[var(--border-bright)] p-6 transition-all duration-150 hover:border-[var(--cyan)] hover:brightness-110 glow-cyan"
        style={{
          background: 'var(--gradient-brand)',
          fontFamily: 'Space Grotesk, sans-serif',
        }}
      >
        <p className="text-center text-[18px] font-bold text-black">
          + START NEW PRODUCT
        </p>
        <p className="mt-1 text-center text-[13px] text-black/80">
          Test a new idea in 30 minutes
        </p>
      </Link>

      {/* Active products */}
      {activeProducts.length > 0 && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Active Products
          </p>
          <div className="space-y-3">
            {activeProducts.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-150 hover:border-[var(--border-bright)] hover:bg-[var(--card-hover)]"
              >
                <span className="text-2xl">📦</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {product.name}
                  </p>
                  <p className="text-[13px] text-[var(--text-muted)]">
                    Flow {product.currentFlow} of 10 • Testing
                  </p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${product.progressPct}%`,
                        background: 'var(--gradient-brand)',
                      }}
                    />
                  </div>
                </div>
                <span className="text-[var(--text-muted)]">→</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Killed products */}
      {killedWithSignals.length > 0 && (
        <>
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Killed Products
          </p>
          <div className="space-y-2">
            {killedWithSignals.map((p) => (
              <Link
                key={p.id}
                href={`/products/${p.id}/killed`}
                className="block rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-150 hover:border-[var(--border-bright)]"
              >
                <span className="text-lg">💀</span>{' '}
                <span className="font-medium text-[var(--text)]">{p.name}</span>
                <span className="text-[var(--green)]"> • Saved ${Math.round(p.saved)}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {productsWithMeta.length === 0 && (
        <div
          className="rounded-2xl border-2 border-dashed border-[var(--border)] p-10 text-center"
          style={{ background: 'var(--card)' }}
        >
          <p className="text-4xl">🎯</p>
          <h2 className="mt-4 text-xl font-bold text-[var(--text)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Welcome to PMF Machine
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Start by adding your first product. One step at a time.
          </p>
          <Link
            href="/products/new"
            className="mt-6 inline-flex min-h-[52px] w-full max-w-sm items-center justify-center rounded-xl px-6 text-[15px] font-bold transition-all duration-150 hover:brightness-110"
            style={{
              background: 'var(--gradient-brand)',
              color: '#000',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            + START NEW PRODUCT
          </Link>
        </div>
      )}
    </div>
  );
}
