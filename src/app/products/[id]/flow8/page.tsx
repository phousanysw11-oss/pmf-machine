import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow8Client } from './Flow8Client';

function formatCustomerSummary(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'target customer';
  const p = profile as Record<string, unknown>;
  if (p.source === 'custom' && typeof p.custom_text === 'string') return p.custom_text;
  if (p.source === 'ai' && p.who) return String(p.who);
  return 'target customer';
}

export default async function Flow8Page({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data, flow3Data, flow4Data, flow5Data, flow7Data, flow8Data] =
    await Promise.all([
      getFlowData(params.id, 1),
      getFlowData(params.id, 2),
      getFlowData(params.id, 3),
      getFlowData(params.id, 4),
      getFlowData(params.id, 5),
      getFlowData(params.id, 7),
      getFlowData(params.id, 8),
    ]);

  const flow1Json = (flow1Data?.data as Record<string, unknown>) ?? {};
  const flow2Json = (flow2Data?.data as Record<string, unknown>) ?? {};
  const flow3Json = (flow3Data?.data as Record<string, unknown>) ?? {};
  const flow4Json = (flow4Data?.data as Record<string, unknown>) ?? {};
  const flow5Json = (flow5Data?.data as Record<string, unknown>) ?? {};
  const flow7Json = (flow7Data?.data as Record<string, unknown>) ?? {};
  const flow8Json = (flow8Data?.data as Record<string, unknown>) ?? null;

  const locked1 = flow1Data?.locked ?? false;
  const locked2 = flow2Data?.locked ?? false;
  const locked3 = flow3Data?.locked ?? false;
  const locked4 = flow4Data?.locked ?? false;
  const locked5 = flow5Data?.locked ?? false;
  const foundationsOk = locked1 && locked2 && locked3 && locked4 && locked5;

  const experimentId = flow7Json.experiment_id as string | undefined;
  const hasActiveExperiment = !!experimentId;

  if (!foundationsOk) {
    return (
      <div className="space-y-6 p-6">
        <Link
          href={`/products/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          ← {product.name}
        </Link>
        <div
          className="rounded-xl border p-6"
          style={{
            borderColor: 'var(--amber)',
            background: 'rgba(251, 191, 36, 0.08)',
          }}
        >
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Complete Flows 1–5 first
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Flow 8 (Execution Assets) needs locked foundations (Flows 1–5).
          </p>
          <Link
            href={`/products/${params.id}`}
            className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--amber)' }}
          >
            Go to product overview
          </Link>
        </div>
      </div>
    );
  }

  if (!hasActiveExperiment) {
    return (
      <div className="space-y-6 p-6">
        <Link
          href={`/products/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text)]"
        >
          ← {product.name}
        </Link>
        <div
          className="rounded-xl border p-6"
          style={{
            borderColor: 'var(--amber)',
            background: 'rgba(251, 191, 36, 0.08)',
          }}
        >
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Start an experiment in Flow 7 first
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Flow 8 (Execution Assets) requires an active experiment. Create and launch one in Flow 7, then return here.
          </p>
          <Link
            href={`/products/${params.id}/flow7`}
            className="mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--amber)' }}
          >
            Go to Flow 7
          </Link>
        </div>
      </div>
    );
  }

  const painText = String(flow1Json.pain_text ?? '');
  const customerSummary = formatCustomerSummary(flow2Json.customer_profile);
  const solutionDescription = String(flow3Json.defense_text ?? '');
  const priceUsd = Number(flow4Json.committed_price_usd) || 0;
  const channelName = String(flow5Json.primary_channel ?? '');
  const experimentSpec = flow7Json.experiment_spec as Record<string, unknown> | undefined;
  const experimentHypothesis = String(experimentSpec?.hypothesis ?? '');

  return (
    <Flow8Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      painText={painText}
      customerSummary={customerSummary}
      solutionDescription={solutionDescription}
      priceUsd={priceUsd}
      channelName={channelName}
      experimentHypothesis={experimentHypothesis}
      experimentId={experimentId}
      hasActiveExperiment={hasActiveExperiment}
      initialData={flow8Json}
      isLocked={flow8Data?.locked ?? false}
    />
  );
}
