import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { rankUncertainties } from '@/lib/uncertainty';
import type { FlowDataRecord } from '@/lib/uncertainty';
import { Flow7Client } from './Flow7Client';

function formatCustomerSummary(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'target customer';
  const p = profile as Record<string, unknown>;
  if (p.source === 'custom' && typeof p.custom_text === 'string') {
    return p.custom_text;
  }
  if (p.source === 'ai' && p.who) return String(p.who);
  return 'target customer';
}

export default async function Flow7Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data, flow3Data, flow4Data, flow5Data, flow7Data] =
    await Promise.all([
      getFlowData(params.id, 1),
      getFlowData(params.id, 2),
      getFlowData(params.id, 3),
      getFlowData(params.id, 4),
      getFlowData(params.id, 5),
      getFlowData(params.id, 7),
    ]);

  const flow1Locked = flow1Data?.locked ?? false;
  const flow2Locked = flow2Data?.locked ?? false;
  const flow3Locked = flow3Data?.locked ?? false;
  const flow4Locked = flow4Data?.locked ?? false;
  const flow5Locked = flow5Data?.locked ?? false;

  if (!flow1Locked || !flow2Locked || !flow3Locked || !flow4Locked || !flow5Locked) {
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
            Complete Flows 1–5 first
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 7 (Experiment Generator) requires all foundations locked (Flows
            1–5).
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
            {!flow5Locked && (
              <Link
                href={`/products/${params.id}/flow5`}
                className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 5
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const flowData: FlowDataRecord[] = [
    { flow_number: 1, data: (flow1Data?.data as Record<string, unknown>) ?? {}, locked: flow1Data?.locked, penalties: flow1Data?.penalties },
    { flow_number: 2, data: (flow2Data?.data as Record<string, unknown>) ?? {}, locked: flow2Data?.locked, penalties: flow2Data?.penalties },
    { flow_number: 3, data: (flow3Data?.data as Record<string, unknown>) ?? {}, locked: flow3Data?.locked, penalties: flow3Data?.penalties },
    { flow_number: 4, data: (flow4Data?.data as Record<string, unknown>) ?? {}, locked: flow4Data?.locked, penalties: flow4Data?.penalties },
    { flow_number: 5, data: (flow5Data?.data as Record<string, unknown>) ?? {}, locked: flow5Data?.locked, penalties: flow5Data?.penalties },
  ];

  const uncertainties = rankUncertainties(flowData);

  const flow1Json = (flow1Data?.data as Record<string, unknown>) ?? {};
  const flow2Json = (flow2Data?.data as Record<string, unknown>) ?? {};
  const flow3Json = (flow3Data?.data as Record<string, unknown>) ?? {};
  const flow4Json = (flow4Data?.data as Record<string, unknown>) ?? {};
  const flow5Json = (flow5Data?.data as Record<string, unknown>) ?? {};
  const flow7Json = (flow7Data?.data as Record<string, unknown>) ?? null;

  const painText = (flow1Json.pain_text as string) ?? '';
  const customerSummary = formatCustomerSummary(flow2Json.customer_profile);
  const solutionDescription = (flow3Json.defense_text as string) ?? '';
  const priceUsd = Number(flow4Json.committed_price_usd) || 0;
  const channelName = (flow5Json.primary_channel as string) ?? '';

  const hasActiveExperiment = !!(flow7Json?.experiment_id as string);

  return (
    <Flow7Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      uncertainties={uncertainties}
      painText={painText}
      customerSummary={customerSummary}
      solutionDescription={solutionDescription}
      priceUsd={priceUsd}
      channelName={channelName}
      initialData={flow7Json}
      isLocked={hasActiveExperiment}
    />
  );
}
