import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getProduct, getFlowData, getExperiment } from '@/lib/database';
import { Flow6Client } from './Flow6Client';

export default async function Flow6Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { experimentId?: string };
}) {
  const product = await getProduct(params.id).catch(() => null);
  if (!product) notFound();

  const flow7Data = await getFlowData(params.id, 7);
  const flow6Data = await getFlowData(params.id, 6);

  const experimentId =
    (typeof searchParams?.experimentId === 'string' && searchParams.experimentId.trim()
      ? searchParams.experimentId.trim()
      : null) ??
    ((flow7Data?.data as Record<string, unknown>)?.experiment_id as string | undefined);

  if (!experimentId) {
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
            Active experiment required
          </h1>
          <p className="mt-2 text-amber-800">
            Flow 6 (Signal vs Noise) interprets data from an experiment. Start an
            experiment in Flow 7 first.
          </p>
          <Link
            href={`/products/${params.id}/flow7`}
            className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Go to Flow 7: Experiment Generator
          </Link>
        </div>
      </div>
    );
  }

  let experiment: { status?: string; hypothesis?: string } | null = null;
  try {
    experiment = await getExperiment(experimentId);
  } catch {
    experiment = null;
  }

  if (!experiment || experiment.status !== 'active') {
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
            No active experiment
          </h1>
          <p className="mt-2 text-amber-800">
            Start or resume an experiment in Flow 7 to use the Signal Interpreter.
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

  const flow6Json = (flow6Data?.data as Record<string, unknown>) ?? null;

  return (
    <Flow6Client
      productId={params.id}
      productName={(product.name as string) ?? 'Product'}
      experimentId={experimentId}
      experimentHypothesis={(experiment.hypothesis as string) ?? ''}
      initialData={flow6Json}
    />
  );
}
