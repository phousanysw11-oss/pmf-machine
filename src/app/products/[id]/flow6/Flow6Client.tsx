'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import Link from 'next/link';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { isPermanentNoise } from '@/lib/signals';
import type { SignalItem } from '@/lib/signals';

type FlowState =
  | 'GATE_CHECK'
  | 'INPUT'
  | 'CLASSIFICATION'
  | 'REVIEW'
  | 'SUMMARY';

type AbsentSignal = {
  expected_metric: string;
  expected_by: string;
  likely_cause: string;
  severity: string;
};

type Flow6ClientProps = {
  productId: string;
  productName: string;
  experimentId: string;
  experimentHypothesis: string;
  initialData: Record<string, unknown> | null;
};

export function Flow6Client({
  productId,
  productName,
  experimentId,
  experimentHypothesis,
  initialData,
}: Flow6ClientProps) {
  const [state, setState] = useState<FlowState>(
    (initialData?.state as FlowState) ?? 'INPUT'
  );
  const [form, setForm] = useState(() => ({
    spend: String((initialData?.form as any)?.spend ?? ''),
    hours_elapsed: String((initialData?.form as any)?.hours_elapsed ?? ''),
    impressions: String((initialData?.form as any)?.impressions ?? ''),
    clicks: String((initialData?.form as any)?.clicks ?? ''),
    messages_received: String((initialData?.form as any)?.messages_received ?? ''),
    orders_placed: String((initialData?.form as any)?.orders_placed ?? ''),
    orders_delivered: String((initialData?.form as any)?.orders_delivered ?? ''),
    orders_canceled: String((initialData?.form as any)?.orders_canceled ?? ''),
  }));
  const [classifications, setClassifications] = useState<SignalItem[]>(
    (initialData?.classifications as SignalItem[]) ?? []
  );
  const [absentSignals, setAbsentSignals] = useState<AbsentSignal[]>(
    (initialData?.absent_signals as AbsentSignal[]) ?? []
  );
  const [overallAssessment, setOverallAssessment] = useState(
    String(initialData?.overall_assessment ?? '')
  );
  const [signalQualityScore, setSignalQualityScore] = useState(
    Number(initialData?.signal_quality_score ?? 0)
  );
  const [trajectoryPattern, setTrajectoryPattern] = useState<string | null>(
    (initialData?.trajectory_pattern as string) ?? null
  );
  const [computed, setComputed] = useState<Record<string, number | string>>(
    (initialData?.computed as Record<string, number | string>) ?? {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeMetric, setDisputeMetric] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [showAllSignals, setShowAllSignals] = useState(false);

  const vanityMetrics = ['impressions'];

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 6,
            data: {
              ...(initialData ?? {}),
              ...data,
              state,
              experiment_id: experimentId,
              experiment_hypothesis: experimentHypothesis,
            },
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [productId, experimentId, experimentHypothesis, initialData, state]
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow6', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId,
          spend: Number(form.spend) || 0,
          hours_elapsed: Number(form.hours_elapsed) || 0,
          impressions: Number(form.impressions) || 0,
          clicks: Number(form.clicks) || 0,
          messages_received: Number(form.messages_received) || 0,
          orders_placed: Number(form.orders_placed) || 0,
          orders_delivered: Number(form.orders_delivered) || 0,
          orders_canceled: Number(form.orders_canceled) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');

      setClassifications(data.classifications ?? []);
      setAbsentSignals(data.absent_signals ?? []);
      setOverallAssessment(data.overall_assessment ?? '');
      setSignalQualityScore(data.signal_quality_score ?? 0);
      setTrajectoryPattern(data.trajectory_pattern ?? null);
      setComputed(data.computed ?? {});
      setState('CLASSIFICATION');

      await saveDraft({
        form,
        classifications: data.classifications ?? [],
        absent_signals: data.absent_signals ?? [],
        overall_assessment: data.overall_assessment ?? '',
        signal_quality_score: data.signal_quality_score ?? 0,
        trajectory_pattern: data.trajectory_pattern ?? null,
        computed: data.computed ?? {},
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Persist step transitions so refresh doesn't lose progress
    if (!initialData) return;
    saveDraft({ state });
  }, [state, saveDraft, initialData]);

  const handleDispute = (metric: string) => {
    if (isPermanentNoise(metric) || vanityMetrics.includes(metric.toLowerCase())) {
      setBlockedMessage('This is always NOISE. Cannot be changed.');
      setDisputeMetric(metric);
    } else {
      setDisputeMetric(metric);
      setBlockedMessage(null);
    }
  };

  const byClassification = (c: string) =>
    classifications.filter((x) => x.classification === c);

  const noiseItems = byClassification('NOISE');
  const weakItems = byClassification('WEAK');
  const strongItems = byClassification('STRONG');
  const pmfItems = byClassification('PMF');

  return (
    <FlowContainer
      flowNumber={6}
      flowTitle="Flow 6: Signal vs Noise Interpreter"
      flowDescription="Classify experiment data as NOISE / WEAK / STRONG / PMF."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'INPUT' && (
          <div className="space-y-6">
            {loading && (
              <LoadingSpinner message="Classifying signals..." />
            )}
            {error && !loading && (
              <ApiErrorMessage onTryAgain={() => { setError(null); handleSubmit(); }} />
            )}
            {!loading && !error && (
              <>
            <p className="text-sm text-slate-600">
              Enter experiment data from your run. Vanity metrics are for
              context only.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Spend ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.spend}
                  onChange={(e) => setForm((f) => ({ ...f, spend: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Hours elapsed</span>
                <input
                  type="number"
                  min="0"
                  value={form.hours_elapsed}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hours_elapsed: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-500">
                  Impressions{' '}
                  <span className="text-xs">(for context only — not a buying signal)</span>
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.impressions}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, impressions: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Clicks</span>
                <input
                  type="number"
                  min="0"
                  value={form.clicks}
                  onChange={(e) => setForm((f) => ({ ...f, clicks: e.target.value }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Messages received</span>
                <input
                  type="number"
                  min="0"
                  value={form.messages_received}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, messages_received: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Orders placed</span>
                <input
                  type="number"
                  min="0"
                  value={form.orders_placed}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orders_placed: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Orders delivered</span>
                <input
                  type="number"
                  min="0"
                  value={form.orders_delivered}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orders_delivered: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Orders canceled</span>
                <input
                  type="number"
                  min="0"
                  value={form.orders_canceled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, orders_canceled: e.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Submit
            </button>
              </>
            )}
          </div>
        )}

        {state === 'CLASSIFICATION' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            {/* Big Signal Quality Score */}
            <div
              className="rounded-[20px] px-10 py-6 mb-4 border-2"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--cyan)',
              }}
            >
              <p
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  marginBottom: '8px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                Signal Quality Score
              </p>
              <span
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '64px',
                  fontWeight: 800,
                  color: 'var(--cyan)',
                }}
              >
                {signalQualityScore}
              </span>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '24px',
                  color: 'var(--text-muted)',
                  marginLeft: '8px',
                }}
              >
                /100
              </span>
            </div>

            {/* Classification summary */}
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                maxWidth: '320px',
                lineHeight: 1.5,
                marginBottom: '24px',
              }}
            >
              {strongItems.length} STRONG, {weakItems.length} WEAK, {noiseItems.length} NOISE
              {pmfItems.length > 0 && `, ${pmfItems.length} PMF`}
            </p>

            {/* PRIMARY BUTTON */}
            <button
              type="button"
              onClick={() => setState('REVIEW')}
              className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base"
              style={{
                background: 'var(--cyan)',
                color: '#000',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              ✅ Continue to Review
            </button>

            {/* SECONDARY — expand details */}
            <button
              onClick={() => setShowAllSignals(!showAllSignals)}
              className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium"
              style={{
                background: 'transparent',
                borderColor: 'var(--border)',
                borderWidth: '1.5px',
                color: 'var(--text-secondary)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              🔍 {showAllSignals ? 'Hide all signals' : 'Show all signals'}
            </button>

            {/* TERTIARY */}
            <button
              type="button"
              onClick={() => setState('INPUT')}
              className="bg-transparent border-none cursor-pointer text-sm underline mt-2"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              Enter more data
            </button>

            {/* LAYER 2: ALL SIGNALS */}
            {showAllSignals && (
              <div
                className="w-full max-w-[600px] mt-6 fade-up text-left"
                style={{
                  animation: 'fadeUp 0.4s ease-out',
                }}
              >
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      NOISE
                    </p>
                    <div className="space-y-1">
                      {noiseItems.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '13px',
                            color: 'var(--text-muted)',
                            textDecoration: 'line-through',
                          }}
                        >
                          {s.metric}: {String(s.value)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#f59e0b',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      WEAK
                    </p>
                    <div className="space-y-1">
                      {weakItems.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {s.metric}: {String(s.value)}
                          {s.reason && (
                            <p
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              {s.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#22c55e',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      STRONG
                    </p>
                    <div className="space-y-1">
                      {strongItems.map((s, i) => (
                        <div
                          key={i}
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {s.metric}: {String(s.value)}
                          {s.reason && (
                            <p
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '11px',
                                color: 'var(--text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              {s.reason}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#f59e0b',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      PMF <Star className="inline h-3 w-3" />
                    </p>
                    <div className="space-y-1">
                      {pmfItems.length === 0 ? (
                        <p
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '13px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          —
                        </p>
                      ) : (
                        pmfItems.map((s, i) => (
                          <div
                            key={i}
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '13px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {s.metric}: {String(s.value)}
                            {s.reason && (
                              <p
                                style={{
                                  fontFamily: 'Inter, sans-serif',
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  marginTop: '2px',
                                }}
                              >
                                {s.reason}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Computed metrics */}
                {Object.keys(computed).length > 0 && (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      Computed Metrics
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {Object.entries(computed).map(([k, v]) => (
                        <span
                          key={k}
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI interpretation */}
                {overallAssessment && (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '12px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--cyan)',
                        marginBottom: '8px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      💡 AI Interpretation
                    </h3>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                      }}
                    >
                      {overallAssessment}
                    </p>
                  </div>
                )}

                {/* Absent signals */}
                {absentSignals.length > 0 && (
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#f59e0b',
                        marginBottom: '12px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      ⚠️ Absent Signals
                    </h3>
                    <ul className="space-y-2">
                      {absentSignals.map((a, i) => (
                        <li
                          key={i}
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <strong>{a.expected_metric}</strong> — {a.likely_cause} ({a.severity})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {state === 'REVIEW' && (
          <div className="space-y-6">
            <p className="font-medium text-slate-900">
              Do you agree with these classifications?
            </p>
            <div className="flex flex-wrap gap-2">
              {classifications.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDispute(s.metric)}
                  className={`rounded px-3 py-1.5 text-sm ${
                    s.classification === 'NOISE'
                      ? 'bg-slate-200 text-slate-600'
                      : s.classification === 'WEAK'
                        ? 'bg-amber-100 text-amber-800'
                        : s.classification === 'STRONG'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-200 text-amber-900'
                  }`}
                >
                  {s.metric} → {s.classification}
                </button>
              ))}
            </div>
            {blockedMessage && disputeMetric && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="font-medium text-red-800">BLOCKED</p>
                <p className="mt-1 text-red-700">{blockedMessage}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setState('SUMMARY')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                I agree — View summary
              </button>
              <button
                type="button"
                onClick={() => setState('CLASSIFICATION')}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {state === 'SUMMARY' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Signal quality score
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {signalQualityScore}
                <span className="text-lg font-normal text-slate-500">/100</span>
              </p>
            </div>
            {trajectoryPattern && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  Trajectory pattern
                </p>
                <p className="mt-1 text-slate-800">{trajectoryPattern}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                Overall assessment
              </p>
              <p className="mt-2 text-slate-800">{overallAssessment}</p>
            </div>
            <p className="text-sm text-slate-600">
              You can re-enter data at 24h, 48h, 72h checkpoints to build the
              signal picture over time.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/products/${productId}/flow9?experimentId=${experimentId}`}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--cyan)' }}
              >
                Continue to Flow 9 →
              </Link>
              <Link
                href={`/products/${productId}/flow6?experimentId=${experimentId}`}
                className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Enter another checkpoint
              </Link>
            </div>
          </div>
        )}
      </div>
    </FlowContainer>
  );
}
