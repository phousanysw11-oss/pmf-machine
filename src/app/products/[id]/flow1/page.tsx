import { notFound } from 'next/navigation';
import { getProduct, getFlowData } from '@/lib/database';
import { Flow1Client } from './Flow1Client';

export default async function Flow1Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const flowData = await getFlowData(params.id, 1);
  const isLocked = flowData?.locked ?? false;
  const data = (flowData?.data as Record<string, unknown>) ?? null;

  return (
    <Flow1Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      initialData={data}
      isLocked={!!isLocked}
    />
  );
}
