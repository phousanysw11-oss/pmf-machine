import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData, getExperiments, getExperiment, getSignalsByExperiment } from '@/lib/database';
import { Flow9Client } from './Flow9Client';

export default async function Flow9Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { experimentId?: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const [flow7Data, experiments] = await Promise.all([
    getFlowData(params.id, 7),
    getExperiments(params.id),
  ]);

  const flow7Json = (flow7Data?.data as Record<string, unknown>) ?? {};
  const experimentIdFromFlow7 = flow7Json.experiment_id as string | undefined;
  const experimentId =
    searchParams.experimentId ?? experimentIdFromFlow7 ?? experiments?.[0]?.id;

  if (!experimentId) {
    return (
      <div className="space-y-6 p-6">
        <Link
          href={`/products/${params.id}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          ← {product.name}
        </Link>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">No experiment to interpret</h1>
          <p className="mt-2 text-amber-800">
            Create and run an experiment in Flow 7 first, then return here to interpret results.
          </p>
          <Link
            href={`/products/${params.id}/flow7`}
            className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Go to Flow 7
          </Link>
        </div>
      </div>
    );
  }

  let experiment: Awaited<ReturnType<typeof getExperiment>>;
  try {
    experiment = await getExperiment(experimentId);
  } catch {
    notFound();
  }

  const signals = await getSignalsByExperiment(experimentId);
  const hasResultsData = signals.length > 0;

  const timeLimitHours = (experiment.time_limit_hours as number) ?? 0;
  const startedAt = experiment.started_at
    ? new Date(experiment.started_at as string).getTime()
    : 0;
  const now = Date.now();
  const timeLimitReached =
    timeLimitHours > 0 && startedAt > 0 && now - startedAt >= timeLimitHours * 60 * 60 * 1000;

  const hypothesis =
    (experiment.hypothesis as string) ?? (flow7Json.hypothesis as string) ?? '';

  return (
    <Flow9Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      experimentId={experimentId}
      experimentHypothesis={hypothesis}
      hasResultsData={hasResultsData}
      timeLimitReached={timeLimitReached}
    />
  );
}
