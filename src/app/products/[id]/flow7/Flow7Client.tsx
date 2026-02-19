'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { FlowContainer } from '@/components/flows/FlowContainer';
import type { Uncertainty } from '@/lib/uncertainty';

type FlowState =
  | 'GATE_CHECK'
  | 'UNCERTAINTY_DISPLAY'
  | 'AI_DESIGN'
  | 'EXECUTION_CHECK'
  | 'CONFIRM'
  | 'ACTIVE';

type SetupStep = {
  step_number: number;
  action: string;
  time_estimate: string;
  requires: string;
  done_when: string;
};

type ExperimentSpec = {
  hypothesis: string;
  null_hypothesis: string;
  setup_steps: SetupStep[];
  primary_metric: {
    name: string;
    how_to_measure: string;
    target: string;
    unit: string;
  };
  secondary_metrics?: Array<{ name: string; how_to_measure: string; target: string }>;
  kill_condition: { trigger: string; timepoint: string; action: string };
  time_limit_hours: number;
  budget_limit_usd: number;
  success_criteria: string;
  failure_criteria: string;
  ambiguous_criteria: string;
};

type Flow7ClientProps = {
  productId: string;
  productName: string;
  uncertainties: Uncertainty[];
  painText: string;
  customerSummary: string;
  solutionDescription: string;
  priceUsd: number;
  channelName: string;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow7Client({
  productId,
  productName,
  uncertainties,
  painText,
  customerSummary,
  solutionDescription,
  priceUsd,
  channelName,
  initialData,
  isLocked,
}: Flow7ClientProps) {
  const router = useRouter();
  const hasActiveExperiment = !!(initialData?.experiment_id as string);
  const [state, setState] = useState<FlowState>(
    hasActiveExperiment || isLocked ? 'ACTIVE' : (initialData?.state as FlowState) ?? 'UNCERTAINTY_DISPLAY'
  );
  const [selectedUncertainty, setSelectedUncertainty] = useState<Uncertainty | null>(
    uncertainties[0] ?? null
  );
  const [spec, setSpec] = useState<ExperimentSpec | null>(
    (initialData?.experiment_spec as ExperimentSpec) ?? null
  );
  const [executionAnswer, setExecutionAnswer] = useState<'as_written' | 'with_adjustments' | 'cant_execute' | 'wrong_uncertainty' | null>(null);
  const [blockingReason, setBlockingReason] = useState('');
  const [simplerSpec, setSimplerSpec] = useState<ExperimentSpec | null>(null);
  const [experimentId, setExperimentId] = useState<string | null>(
    (initialData?.experiment_id as string) ?? null
  );
  const [startedAt, setStartedAt] = useState<string | null>(
    (initialData?.started_at as string) ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 7,
            data: {
              ...initialData,
              ...data,
              state,
            },
          }),
        });
      } catch {
        // Non-blocking
      }
    },
    [productId, initialData, state]
  );

  const fetchExperimentDesign = useCallback(
    async (uncertainty: Uncertainty, simpler = false, previousSpec?: ExperimentSpec) => {
      setState('AI_DESIGN');
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/ai/flow7', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uncertainty,
            painText,
            customerSummary,
            solutionDescription,
            priceUsd,
            channelName,
            ...(simpler && {
              simplerVersion: true,
              blockingReason: blockingReason.trim(),
              previousSpec: previousSpec ?? spec,
            }),
          }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error ?? 'Failed to design experiment');

        if (simpler) {
          setSimplerSpec(data);
        } else {
          setSpec(data);
          setSimplerSpec(null);
        }
        await saveDraft({
          experiment_spec: data,
          selected_uncertainty: uncertainty,
        });
        setState('AI_DESIGN');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to design experiment');
        setState('UNCERTAINTY_DISPLAY');
      } finally {
        setLoading(false);
      }
    },
    [
      painText,
      customerSummary,
      solutionDescription,
      priceUsd,
      channelName,
      blockingReason,
      spec,
      saveDraft,
      selectedUncertainty,
    ]
  );

  const handleAcceptTop = () => {
    const top = uncertainties?.[0];
    if (!top) {
      setError('No uncertainties found. Please complete Flows 1-5 first.');
      return;
    }
    setSelectedUncertainty(top);
    fetchExperimentDesign(top);
  };

  const handlePickDifferent = (uncertainty: Uncertainty) => {
    setSelectedUncertainty(uncertainty);
    fetchExperimentDesign(uncertainty);
  };

  const handleExecutionAnswer = (answer: typeof executionAnswer) => {
    setExecutionAnswer(answer);
    if (answer === 'as_written' || answer === 'with_adjustments') {
      setState('CONFIRM');
      saveDraft({ execution_check: answer });
    } else if (answer === 'wrong_uncertainty') {
      setState('UNCERTAINTY_DISPLAY');
      setSpec(null);
    }
  };

  const handleCantExecuteSubmit = async () => {
    if (!blockingReason.trim() || !spec) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow7', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uncertainty: selectedUncertainty,
          painText,
          customerSummary,
          solutionDescription,
          priceUsd,
          channelName,
          simplerVersion: true,
          blockingReason: blockingReason.trim(),
          previousSpec: spec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setSimplerSpec(data);
      setState('AI_DESIGN');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate simpler experiment');
    } finally {
      setLoading(false);
    }
  };

  const handleUseMinimumViable = () => {
    setSpec({
      hypothesis: 'Customers will articulate the pain when asked directly.',
      null_hypothesis: 'Customers do not recognize this as a problem.',
      setup_steps: [
        {
          step_number: 1,
          action: 'Message 5 people who match your customer profile. Ask: "Have you ever had [pain in their words]? What did you do about it?"',
          time_estimate: '30 min',
          requires: 'Phone, list of 5 people',
          done_when: 'You have 5 responses (any format).',
        },
      ],
      primary_metric: {
        name: 'Pain acknowledgment',
        how_to_measure: 'Count how many say yes and describe the problem.',
        target: 'At least 3 of 5',
        unit: 'people',
      },
      kill_condition: { trigger: '0 of 5 acknowledge', timepoint: 'After 5 responses', action: 'Stop. Rethink pain.' },
      time_limit_hours: 72,
      budget_limit_usd: 0,
      success_criteria: '3+ say they have this problem.',
      failure_criteria: '0-1 acknowledge.',
      ambiguous_criteria: '2 acknowledge.',
    });
    setSimplerSpec(null);
    setState('CONFIRM');
  };

  const handleStartExperiment = async () => {
    const toSave = simplerSpec ?? spec;
    if (!toSave) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          hypothesis: toSave.hypothesis,
          null_hypothesis: toSave.null_hypothesis,
          setup_steps: toSave.setup_steps,
          primary_metric: toSave.primary_metric,
          kill_condition: toSave.kill_condition,
          time_limit_hours: toSave.time_limit_hours,
          budget_limit_usd: toSave.budget_limit_usd,
          success_criteria: toSave.success_criteria,
          failure_criteria: toSave.failure_criteria,
          ambiguous_criteria: toSave.ambiguous_criteria,
          secondary_metrics: toSave.secondary_metrics,
          startNow: true,
          uncertainty_type: selectedUncertainty?.type,
          uncertainty_question: selectedUncertainty?.question,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to start');
      setExperimentId(data.id);
      setStartedAt(data.started_at ?? new Date().toISOString());
      showToast('Experiment started ✓');
      await saveDraft({
        experiment_id: data.id,
        started_at: data.started_at,
        state: 'ACTIVE',
      });
      setState('ACTIVE');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start experiment');
    } finally {
      setLoading(false);
    }
  };

  const displaySpec = simplerSpec ?? spec;

  if (isLocked || state === 'ACTIVE') {
    const expId = experimentId ?? (initialData?.experiment_id as string);
    const startAt = startedAt ?? (initialData?.started_at as string);
    const expSpec = (initialData?.experiment_spec as ExperimentSpec) ?? spec;

    return (
      <FlowContainer
        flowNumber={7}
        flowTitle="Flow 7: Experiment Generator"
        flowDescription="Design one experiment to test your biggest uncertainty."
        productId={productId}
        productName={productName}
        isLocked={false}
        stateIndicator="ACTIVE"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
            <Play className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Experiment running</p>
              {startAt && (
                <p className="text-sm text-slate-600">
                  Started: {new Date(startAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          {expSpec && (
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium text-slate-900">{expSpec.hypothesis}</p>
              <p className="mt-2 text-sm text-slate-600">
                Time limit: {expSpec.time_limit_hours}h · Budget: $
                {expSpec.budget_limit_usd}
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/products/${productId}/flow8`}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ background: 'var(--cyan)' }}
            >
              Continue to Flow 8 →
            </Link>
            <Link
              href={expId ? `/products/${productId}/flow6?experimentId=${expId}` : '#'}
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Record Results (Flow 6)
            </Link>
          </div>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={7}
      flowTitle="Flow 7: Experiment Generator"
      flowDescription="Design one experiment to test your biggest uncertainty."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'UNCERTAINTY_DISPLAY' && (
          <div className="space-y-6">
            <p className="font-medium text-slate-900">Your biggest unknowns:</p>
            {uncertainties && uncertainties.length > 0 ? (
              <>
                <ol className="list-decimal space-y-2 pl-5">
                  {uncertainties.map((u, i) => (
                    <li key={i} className="text-slate-700">
                      <span className="font-medium">#{i + 1}: {u.question}</span>
                      <span className="ml-2 text-sm text-slate-500">(weight {u.weight})</span>
                    </li>
                  ))}
                </ol>
                <p className="text-sm text-slate-600">
                  The experiment will target #{uncertainties[0]?.question ? '1' : 'the top uncertainty'}.
                </p>
              </>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-amber-800">
                  No uncertainties found. All flows appear to be high confidence. A default validation experiment will be created.
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleAcceptTop}
                disabled={!uncertainties || uncertainties.length === 0}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ACCEPT TOP
              </button>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">PICK DIFFERENT:</label>
                <select
                  onChange={(e) => {
                    const idx = Number(e.target.value);
                    if (idx >= 0 && uncertainties[idx]) {
                      handlePickDifferent(uncertainties[idx]);
                    }
                  }}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                >
                  <option value={-1}>Select uncertainty</option>
                  {uncertainties.map((u, i) => (
                    <option key={i} value={i}>
                      #{i + 1} {u.question}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {state === 'AI_DESIGN' && (
          <div className="space-y-6">
            {loading ? (
              <LoadingSpinner message="Designing your experiment..." />
            ) : error && !displaySpec ? (
              <ApiErrorMessage onTryAgain={() => selectedUncertainty && fetchExperimentDesign(selectedUncertainty)} />
            ) : displaySpec ? (
              <>
                {simplerSpec && (
                  <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-800">
                    Simpler version (based on your blocker).
                  </p>
                )}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Hypothesis</p>
                    <p className="mt-1 text-slate-900">{displaySpec.hypothesis}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Null hypothesis</p>
                    <p className="mt-1 text-slate-900">{displaySpec.null_hypothesis}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Setup steps</p>
                    <ul className="mt-1 list-decimal space-y-2 pl-5">
                      {displaySpec.setup_steps.map((step, i) => (
                        <li key={i} className="text-slate-700">
                          <span className="font-medium">{step.action}</span>
                          <span className="ml-2 text-xs text-slate-500">
                            ({step.time_estimate})
                          </span>
                          {step.done_when && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              Done when: {step.done_when}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Primary metric</p>
                    <p className="mt-1 font-medium text-slate-900">{displaySpec.primary_metric.name}</p>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {displaySpec.primary_metric.how_to_measure}
                    </p>
                    <p className="text-sm text-slate-600">
                      Target: {displaySpec.primary_metric.target} {displaySpec.primary_metric.unit}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Kill condition</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {displaySpec.kill_condition.trigger} at {displaySpec.kill_condition.timepoint} →{' '}
                      {displaySpec.kill_condition.action}
                    </p>
                  </div>
                  <div className="flex gap-4 text-sm text-slate-600">
                    <span>Time limit: {displaySpec.time_limit_hours}h</span>
                    <span>Budget: ${displaySpec.budget_limit_usd}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                    <div className="rounded bg-emerald-50 p-2 text-emerald-800">
                      <p className="font-medium">Success</p>
                      <p>{displaySpec.success_criteria}</p>
                    </div>
                    <div className="rounded bg-red-50 p-2 text-red-800">
                      <p className="font-medium">Failure</p>
                      <p>{displaySpec.failure_criteria}</p>
                    </div>
                    <div className="rounded bg-amber-50 p-2 text-amber-800">
                      <p className="font-medium">Ambiguous</p>
                      <p>{displaySpec.ambiguous_criteria}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setState('EXECUTION_CHECK');
                      saveDraft({});
                    }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Next: Execution check
                  </button>
                  {simplerSpec && (
                    <button
                      onClick={() => {
                        setSimplerSpec(null);
                        setState('UNCERTAINTY_DISPLAY');
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Back to uncertainties
                    </button>
                  )}
                </div>
                {error && <ApiErrorMessage onTryAgain={() => selectedUncertainty && fetchExperimentDesign(selectedUncertainty)} />}
              </>
            ) : null}
          </div>
        )}

        {state === 'EXECUTION_CHECK' && spec && (
          <div className="space-y-6">
            <p className="font-medium text-slate-900">
              Can you execute this experiment as written?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleExecutionAnswer('as_written')}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                YES AS WRITTEN
              </button>
              <button
                onClick={() => handleExecutionAnswer('with_adjustments')}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                YES WITH ADJUSTMENTS
              </button>
              <button
                onClick={() => handleExecutionAnswer('cant_execute')}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                CAN&apos;T EXECUTE
              </button>
              <button
                onClick={() => handleExecutionAnswer('wrong_uncertainty')}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                WRONG UNCERTAINTY
              </button>
            </div>

            {executionAnswer === 'cant_execute' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-amber-900">What&apos;s blocking you?</p>
                <textarea
                  value={blockingReason}
                  onChange={(e) => setBlockingReason(e.target.value)}
                  placeholder="e.g. I don't have TikTok Ads Manager access..."
                  rows={3}
                  className="mt-2 block w-full rounded-lg border border-amber-300 px-3 py-2 text-slate-900"
                />
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleCantExecuteSubmit}
                    disabled={!blockingReason.trim() || loading}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {loading ? 'Designing…' : 'Design simpler version'}
                  </button>
                  <button
                    onClick={handleUseMinimumViable}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Use minimum viable (conversation test, $0)
                  </button>
                </div>
                {error && <ApiErrorMessage onTryAgain={handleCantExecuteSubmit} />}
              </div>
            )}
          </div>
        )}

        {state === 'CONFIRM' && displaySpec && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Final experiment</p>
              <p className="mt-2 text-slate-700">{displaySpec.hypothesis}</p>
              <p className="mt-2 text-sm text-slate-600">
                {displaySpec.time_limit_hours}h · ${displaySpec.budget_limit_usd} budget
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleStartExperiment}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Starting…' : 'START'}
              </button>
              <button
                onClick={() => setState('EXECUTION_CHECK')}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                ADJUST
              </button>
              <Link
                href={`/products/${productId}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CANCEL
              </Link>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleStartExperiment} />}
          </div>
        )}
      </div>
    </FlowContainer>
  );
}
