import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow3Client } from './Flow3Client';

export default async function Flow3Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data, flow3Data] = await Promise.all([
    getFlowData(params.id, 1),
    getFlowData(params.id, 2),
    getFlowData(params.id, 3),
  ]);

  const flow1Locked = flow1Data?.locked ?? false;
  const flow2Locked = flow2Data?.locked ?? false;

  if (!flow1Locked || !flow2Locked) {
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
            Complete Flows 1 and 2 first
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 3 (Solution Differentiation) requires a locked pain statement and
            customer profile from Flows 1 and 2.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {!flow1Locked && (
              <Link
                href={`/products/${params.id}/flow1`}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Go to Flow 1: Pain Rephrasing
              </Link>
            )}
            {!flow2Locked && (
              <Link
                href={`/products/${params.id}/flow2`}
                className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Go to Flow 2: Customer Clarity
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const flow1DataJson = (flow1Data?.data as Record<string, unknown>) ?? {};
  const flow2DataJson = (flow2Data?.data as Record<string, unknown>) ?? {};
  const painText = (flow1DataJson.pain_text as string) ?? '';
  const customerProfile = (flow2DataJson.customer_profile as Record<string, unknown>) ?? null;
  const flow3InitialData = (flow3Data?.data as Record<string, unknown>) ?? null;
  const flow3Locked = flow3Data?.locked ?? false;

  return (
    <Flow3Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      painText={painText}
      customerProfile={customerProfile}
      initialData={flow3InitialData}
      isLocked={flow3Locked}
    />
  );
}
