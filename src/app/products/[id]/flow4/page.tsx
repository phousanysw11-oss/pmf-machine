import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow4Client } from './Flow4Client';

export default async function Flow4Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data, flow3Data, flow4Data] = await Promise.all([
    getFlowData(params.id, 1),
    getFlowData(params.id, 2),
    getFlowData(params.id, 3),
    getFlowData(params.id, 4),
  ]);

  const flow1Locked = flow1Data?.locked ?? false;
  const flow2Locked = flow2Data?.locked ?? false;
  const flow3Locked = flow3Data?.locked ?? false;

  if (!flow1Locked || !flow2Locked || !flow3Locked) {
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
            Complete Flows 1–3 first
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 4 (Willingness to Pay) requires locked pain, customer profile,
            and solution differentiation from Flows 1, 2, and 3.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!flow1Locked && (
              <Link
                href={`/products/${params.id}/flow1`}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 1: Pain Rephrasing
              </Link>
            )}
            {!flow2Locked && (
              <Link
                href={`/products/${params.id}/flow2`}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 2: Customer Clarity
              </Link>
            )}
            {!flow3Locked && (
              <Link
                href={`/products/${params.id}/flow3`}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Flow 3: Solution Differentiation
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
  const flow4Json = (flow4Data?.data as Record<string, unknown>) ?? null;

  const painText = (flow1Json.pain_text as string) ?? '';
  const customerProfile =
    (flow2Json.customer_profile as Record<string, unknown>) ?? null;
  const solutionDescription =
    (flow3Json.defense_text as string) ?? '';
  const flow4Locked = flow4Data?.locked ?? false;

  return (
    <Flow4Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      painText={painText}
      customerProfile={customerProfile}
      solutionDescription={solutionDescription}
      initialData={flow4Json}
      isLocked={flow4Locked}
    />
  );
}
