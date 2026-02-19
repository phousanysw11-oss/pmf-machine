import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getProduct,
  updateProduct,
  getExperiments,
  getSignalsForProduct,
  getDecisionsByProduct,
  getLatestFinalVerdict,
  getProductFlows,
} from '@/lib/database';
import { Shield, Target, BookOpen, Layers, Home, Zap } from 'lucide-react';

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

function getKeyLearning(
  decisions: { ai_reason?: string; human_decision?: string }[],
  finalVerdict: { summary?: string } | null
): string {
  const killDecision = decisions.find((d) => d.human_decision === 'KILL');
  if (killDecision?.ai_reason) return String(killDecision.ai_reason);
  if (finalVerdict?.summary) return String(finalVerdict.summary);
  return 'We validated that this direction was not worth scaling. Use the foundations below for the next bet.';
}

function getReusableFoundations(flowRows: { flow_number: number; locked?: boolean; data?: Record<string, unknown> }[]): string[] {
  const labels: Record<number, string> = {
    1: 'Pain (Flow 1)',
    2: 'Customer (Flow 2)',
    3: 'Solution (Flow 3)',
    4: 'Price (Flow 4)',
    5: 'Channel (Flow 5)',
  };
  const out: string[] = [];
  for (const row of flowRows ?? []) {
    if (row.locked && labels[row.flow_number]) {
      out.push(labels[row.flow_number]);
    }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

export default async function ProductKilledPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const status = (product.status as string) ?? 'active';
  const decisions = await getDecisionsByProduct(params.id);
  const hasKillDecision = decisions.some(
    (d) => (d as { human_decision?: string }).human_decision === 'KILL'
  );
  const finalVerdict = await getLatestFinalVerdict(params.id);
  const hasNoPmf = (finalVerdict?.verdict as string) === 'NO_PMF';

  if (status !== 'killed' && !hasKillDecision && !hasNoPmf) {
    notFound();
  }

  if (status !== 'killed') {
    await updateProduct(params.id, { status: 'killed' });
  }

  const [experiments, signals, flowRows] = await Promise.all([
    getExperiments(params.id),
    getSignalsForProduct(params.id),
    getProductFlows(params.id),
  ]);

  const totalSpend = computeTotalSpend(signals as { experiment_id: string; metric_name?: string; value?: number; hours_elapsed?: number }[]);
  const projectedScaleCost = totalSpend * PROJECTED_SCALE_MULTIPLIER;
  const experimentsRun = experiments?.length ?? 0;

  const firstStarted = experiments?.length
    ? experiments.reduce((min, e) => {
        const t = (e.started_at as string) && new Date(e.started_at as string).getTime();
        return t && (!min || t < min) ? t : min;
      }, 0 as number | null)
    : null;
  const killedAt = (product.updated_at as string) && new Date(product.updated_at as string).getTime();
  const totalDays = firstStarted && killedAt
    ? Math.max(1, Math.round((killedAt - firstStarted) / (24 * 60 * 60 * 1000)))
    : 0;

  const keyLearning = getKeyLearning(
    decisions as { ai_reason?: string; human_decision?: string }[],
    finalVerdict
  );
  const reusable = getReusableFoundations(
    (flowRows ?? []) as { flow_number: number; locked?: boolean; data?: Record<string, unknown> }[]
  );

  const productName = (product.name as string) ?? 'Product';

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 p-8 shadow-lg">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-emerald-100">
              {productName}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 bg-red-950/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-red-300">
              <Shield className="h-3.5 w-3.5" />
              KILLED
            </span>
          </div>

          <p className="mb-8 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-center text-lg font-medium text-emerald-100">
            You saved $
            {projectedScaleCost >= 1000
              ? `${(projectedScaleCost / 1000).toFixed(1)}k`
              : Math.round(projectedScaleCost)}
            {' '}
            by killing fast.
          </p>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-200">
              <Target className="h-4 w-4" />
              Investment summary
            </h2>
            <ul className="space-y-1.5 text-slate-300">
              <li>Total spend: ${totalSpend.toFixed(2)}</li>
              <li>Total days: {totalDays}</li>
              <li>Experiments run: {experimentsRun}</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-200">
              <BookOpen className="h-4 w-4" />
              Key learning
            </h2>
            <p className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4 text-slate-200">
              {keyLearning}
            </p>
          </section>

          {reusable.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-200">
                <Layers className="h-4 w-4" />
                Reusable foundations
              </h2>
              <div className="flex flex-wrap gap-2">
                {reusable.map((label) => (
                  <span
                    key={label}
                    className="rounded-md border border-emerald-700/50 bg-emerald-900/20 px-3 py-1.5 text-sm text-emerald-200"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="flex flex-wrap gap-3 border-t border-emerald-900/50 pt-8">
            <Link
              href="/products/new"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-900/40 px-4 py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-800/50"
            >
              <Zap className="h-4 w-4" />
              Start fresh
            </Link>
            <Link
              href="/products/new?skipTo=flow3"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700/50"
            >
              Same pain, new solution
            </Link>
            <Link
              href="/products/new?skipTo=flow2"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700/50"
            >
              Same customer, new pain
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700/50"
            >
              <Home className="h-4 w-4" />
              Back to dashboard
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
