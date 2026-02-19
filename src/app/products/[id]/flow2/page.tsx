import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow2Client } from './Flow2Client';

export default async function Flow2Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow1Data, flow2Data] = await Promise.all([
    getFlowData(params.id, 1),
    getFlowData(params.id, 2),
  ]);

  const flow1Locked = flow1Data?.locked ?? false;
  const flow1DataJson = (flow1Data?.data as Record<string, unknown>) ?? {};
  const painText = (flow1DataJson.pain_text as string) ?? '';

  if (!flow1Locked) {
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
            Complete Flow 1 first
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 2 (Customer Clarity) requires a locked pain statement from Flow 1.
            Complete and lock Flow 1 before identifying your target customer.
          </p>
          <Link
            href={`/products/${params.id}/flow1`}
            className="mt-4 inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Go to Flow 1: Pain Rephrasing
          </Link>
        </div>
      </div>
    );
  }

  const flow2InitialData = (flow2Data?.data as Record<string, unknown>) ?? null;
  const flow2Locked = flow2Data?.locked ?? false;

  return (
    <Flow2Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      painText={painText}
      initialData={flow2InitialData}
      isLocked={flow2Locked}
    />
  );
}
