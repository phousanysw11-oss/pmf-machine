import Link from 'next/link';
import { getKilledProducts, getSignalsForProduct, getDecisionsByProduct, getLatestFinalVerdict, getProductFlows } from '@/lib/database';
import { Shield, Layers, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PROJECTED_SCALE_MULTIPLIER = 10;

function computeTotalSpend(signals: { experiment_id: string; metric_name?: string; value?: number; hours_elapsed?: number }[]): number {
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

function getKeyLearningOneLine(
  decisions: { ai_reason?: string; human_decision?: string }[],
  finalVerdict: { summary?: string } | null
): string {
  const killDecision = decisions.find((d) => d.human_decision === 'KILL');
  if (killDecision?.ai_reason) {
    const s = String(killDecision.ai_reason);
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  }
  if (finalVerdict?.summary) {
    const s = String(finalVerdict.summary);
    return s.length > 120 ? s.slice(0, 117) + '...' : s;
  }
  return 'Validated that this direction was not worth scaling.';
}

function hasReusableFoundations(flowRows: { flow_number: number; locked?: boolean }[]): boolean {
  return (flowRows ?? []).filter((r) => r.locked && r.flow_number >= 1 && r.flow_number <= 5).length > 0;
}

function formatDate(updatedAt: string | null | undefined): string {
  if (!updatedAt) return '—';
  try {
    return new Date(updatedAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default async function KilledProductsListPage() {
  let killed: Awaited<ReturnType<typeof getKilledProducts>> = [];
  try {
    killed = await getKilledProducts();
  } catch {
    killed = [];
  }

  const withMeta = await Promise.all(
    (Array.isArray(killed) ? killed : []).map(async (product) => {
      const [signals, decisions, finalVerdict, flows] = await Promise.all([
        getSignalsForProduct(product.id),
        getDecisionsByProduct(product.id),
        getLatestFinalVerdict(product.id),
        getProductFlows(product.id),
      ]);
      const totalSpend = computeTotalSpend(
        signals as { experiment_id: string; metric_name?: string; value?: number; hours_elapsed?: number }[]
      );
      const saved = totalSpend * PROJECTED_SCALE_MULTIPLIER;
      const keyLearning = getKeyLearningOneLine(
        decisions as { ai_reason?: string; human_decision?: string }[],
        finalVerdict
      );
      const reusable = hasReusableFoundations(
        (flows ?? []) as { flow_number: number; locked?: boolean }[]
      );
      return {
        id: product.id,
        name: (product.name as string) ?? 'Product',
        updated_at: product.updated_at as string | undefined,
        totalSpend,
        saved,
        keyLearning,
        reusable,
      };
    })
  );

  const totalSaved = withMeta.reduce((sum, p) => sum + p.saved, 0);
  const n = withMeta.length;

  return (
    <div className="min-w-0 space-y-6 fade-in">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--text2)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <div
        className="rounded-xl border p-8"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
      >
        <p
          className="text-center text-3xl font-bold tracking-tight"
          style={{ color: 'var(--s3)', fontFamily: 'var(--font-outfit)' }}
        >
          ${totalSaved >= 1000 ? `${(totalSaved / 1000).toFixed(1)}k` : Math.round(totalSaved)}
        </p>
        <p
          className="mt-1 text-center text-sm font-medium uppercase tracking-wider"
          style={{ color: 'var(--text3)' }}
        >
          Estimated money saved
        </p>
        <p className="mt-6 text-center" style={{ color: 'var(--text2)' }}>
          Fast kills = fast learning. You&apos;ve killed {n} product{n === 1 ? '' : 's'} and saved ~$
          {totalSaved >= 1000 ? `${(totalSaved / 1000).toFixed(1)}k` : Math.round(totalSaved)}.
        </p>
      </div>

      <div className="space-y-4">
        {withMeta.map((p) => (
          <Link
            key={p.id}
            href={`/products/${p.id}/killed`}
            className="block rounded-xl border p-6 transition-all duration-150 hover:-translate-y-[2px]"
            style={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: 'var(--white)', fontFamily: 'var(--font-outfit)' }}
                  >
                    {p.name}
                  </h2>
                  <span
                    className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium uppercase"
                    style={{
                      borderColor: '#ef444422',
                      backgroundColor: '#ef444408',
                      color: '#d46666',
                      fontFamily: 'var(--font-outfit)',
                    }}
                  >
                    <Shield className="h-3 w-3" />
                    Killed
                  </span>
                  {p.reusable && (
                    <span
                      className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                      style={{
                        borderColor: '#22c55e22',
                        backgroundColor: '#22c55e08',
                        color: '#5cb87a',
                        fontFamily: 'var(--font-outfit)',
                      }}
                    >
                      <Layers className="h-3 w-3" />
                      Reusable
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm" style={{ color: 'var(--text3)' }}>
                  Killed {formatDate(p.updated_at)} · ${p.totalSpend.toFixed(2)} spend
                </p>
                <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'var(--text2)' }}>
                  {p.keyLearning}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {withMeta.length === 0 && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{
            backgroundColor: 'var(--card)',
            borderColor: 'var(--border)',
          }}
        >
          <p style={{ color: 'var(--text3)' }}>No killed products yet.</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--text2)' }}>
            When you kill a product (Flow 9 KILL or Flow 10 NO_PMF), it will appear here.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm font-medium transition-colors hover:opacity-80"
            style={{ color: 'var(--s3)' }}
          >
            Back to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
