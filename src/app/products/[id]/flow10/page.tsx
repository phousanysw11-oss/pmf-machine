import { notFound } from 'next/navigation';
import { getProduct, getDecisionsByProduct } from '@/lib/database';
import { Flow10Client } from './Flow10Client';

export default async function Flow10Page({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const decisions = await getDecisionsByProduct(params.id);
  const hasGoVerdict = decisions.some(
    (d) => (d as { human_decision?: string }).human_decision === 'GO'
  );

  return (
    <Flow10Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      hasGoVerdict={hasGoVerdict}
    />
  );
}
