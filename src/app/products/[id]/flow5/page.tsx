import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow5Client } from './Flow5Client';

function formatCustomerSummary(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'target customer';
  const p = profile as Record<string, unknown>;
  if (p.source === 'custom' && typeof p.custom_text === 'string') {
    return p.custom_text;
  }
  if (p.source === 'ai' && p.who) return String(p.who);
  return 'target customer';
}

export default async function Flow5Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data, flow3Data, flow4Data, flow5Data] =
    await Promise.all([
      getFlowData(params.id, 1),
      getFlowData(params.id, 2),
      getFlowData(params.id, 3),
      getFlowData(params.id, 4),
      getFlowData(params.id, 5),
    ]);

  const flow1Locked = flow1Data?.locked ?? false;
  const flow2Locked = flow2Data?.locked ?? false;
  const flow3Locked = flow3Data?.locked ?? false;
  const flow4Locked = flow4Data?.locked ?? false;

  if (!flow1Locked || !flow2Locked || !flow3Locked || !flow4Locked) {
    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/products/${params.id}`}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
          >
            ← {product.name}
          </Link>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">
            Complete Flows 1–4 first
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 5 (Channel Reality Check) requires locked pain, customer,
            solution, and price from Flows 1–4.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!flow1Locked && (
              <Link
                href={`/products/${params.id}/flow1`}
                className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 1
              </Link>
            )}
            {!flow2Locked && (
              <Link
                href={`/products/${params.id}/flow2`}
                className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 2
              </Link>
            )}
            {!flow3Locked && (
              <Link
                href={`/products/${params.id}/flow3`}
                className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 3
              </Link>
            )}
            {!flow4Locked && (
              <Link
                href={`/products/${params.id}/flow4`}
                className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 4
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const flow1Json = (flow1Data?.data as Record<string, unknown>) ?? {};
  const flow2Json = (flow2Data?.data as Record<string, unknown>) ?? {};
  const flow3Json = (flow3Data?.data as Record<string, unknown>) ?? {};
  const flow4Json = (flow4Data?.data as Record<string, unknown>) ?? {};
  const flow5Json = (flow5Data?.data as Record<string, unknown>) ?? null;

  const painText = (flow1Json.pain_text as string) ?? '';
  const customerProfile = flow2Json.customer_profile;
  const customerSummary = formatCustomerSummary(customerProfile);
  const solutionDescription = (flow3Json.defense_text as string) ?? '';
  const priceUsd = Number(flow4Json.committed_price_usd) || 0;
  const maxCostUsd = Number(flow4Json.max_cost_for_go) || 0;

  const flowsWithPenalties = [
    flow1Data,
    flow2Data,
    flow3Data,
    flow4Data,
    flow5Data,
  ].filter(Boolean) as { penalties?: number }[];
  const upstreamPenalty = flowsWithPenalties
    .slice(0, 4)
    .reduce((sum, f) => sum + (Number(f?.penalties) || 0), 0);

  const flow5Locked = flow5Data?.locked ?? false;

  return (
    <Flow5Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      painText={painText}
      customerSummary={customerSummary}
      solutionDescription={solutionDescription}
      priceUsd={priceUsd}
      maxCostUsd={maxCostUsd}
      upstreamPenalty={upstreamPenalty}
      initialData={flow5Json}
      isLocked={flow5Locked}
    />
  );
}
