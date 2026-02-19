'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { useToast } from '@/components/ui/Toast';

type FlowState =
  | 'GATE_CHECK'
  | 'COMPUTATION'
  | 'BREAKDOWN'
  | 'AI_SUMMARY'
  | 'DECISION'
  | 'LOCKED';

type FoundationBreakdown = {
  pain: { score: number; max: number; label: string };
  customer: { score: number; max: number; label: string };
  solution: { score: number; max: number; label: string };
  price: { score: number; max: number; label: string };
  channel: { score: number; max: number; label: string };
  total: number;
  max: number;
};

type ExperimentBreakdown = {
  primary_metric: { score: number; max: number; label: string };
  gates: { score: number; max: number; label: string; passCount?: number };
  signal_quality: { score: number; max: number; label: string };
  integrity: { score: number; max: number; label: string };
  total: number;
  max: number;
};

type ConsistencyBreakdown = {
  cpa_stability: { score: number; max: number; label: string };
  net_margin: { score: number; max: number; label: string };
  cancel_rate: { score: number; max: number; label: string };
  repeat_buyers: { score: number; max: number; label: string };
  sean_ellis: { score: number; max: number; label: string; skipped?: boolean };
  total: number;
  max: number;
};

type ScoringResult = {
  pmf_score: number;
  verdict: 'PMF_CONFIRMED' | 'PMF_PARTIAL' | 'NO_PMF';
  hard_kill_applied: string | null;
  foundation: FoundationBreakdown;
  experiment: ExperimentBreakdown;
  consistency: ConsistencyBreakdown;
  total_penalty: number;
  total_modifiers: number;
  penalty_sources: { flow: number; penalty: number }[];
  modifier_sources: { reason: string; value: number }[];
};

type AISummary = {
  one_line_summary: string;
  strengths: string[];
  risks: string[];
  score_explanation: string;
  recommended_next: string;
  gap_analysis: string | null;
};

type Flow10ClientProps = {
  productId: string;
  productName: string;
  hasGoVerdict: boolean;
};

export function Flow10Client({
  productId,
  productName,
  hasGoVerdict,
}: Flow10ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    hasGoVerdict ? 'COMPUTATION' : 'GATE_CHECK'
  );
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedBreakdown, setExpandedBreakdown] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [locked, setLocked] = useState(false);
  const { showToast } = useToast();

  const runScoring = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow10', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Scoring failed');
      setResult(data);
      setAiSummary(data.ai_summary ?? null);
      setState('BREAKDOWN');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute score');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const summaryPayload =
        aiSummary &&
        `${aiSummary.one_line_summary}\n\n${aiSummary.recommended_next}${
          aiSummary.gap_analysis ? `\n\nGap: ${aiSummary.gap_analysis}` : ''
        }`;
      await fetch('/api/final-verdicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          verdict: result.verdict,
          confidence:
            result.verdict === 'PMF_CONFIRMED'
              ? 'HIGH'
              : result.verdict === 'PMF_PARTIAL'
                ? 'MEDIUM'
                : 'LOW',
          pmf_score: result.pmf_score,
          foundation_score: result.foundation.total,
          experiment_score: result.experiment.total,
          consistency_score: result.consistency.total,
          total_penalty: result.total_penalty,
          total_modifiers: result.total_modifiers,
          summary: summaryPayload,
        }),
      });
      showToast('Final verdict saved ✓');
      setLocked(true);
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save final verdict');
    } finally {
      setLoading(false);
    }
  };

  const verdictColor =
    result?.verdict === 'PMF_CONFIRMED'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : result?.verdict === 'PMF_PARTIAL'
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-red-700 bg-red-50 border-red-200';

  if (state === 'GATE_CHECK' && !hasGoVerdict) {
    return (
      <FlowContainer
        flowNumber={10}
        flowTitle="Flow 10: Final PMF Verdict"
        flowDescription="Capstone — aggregate everything into a 0–100 PMF score."
        productId={productId}
        productName={productName}
        isLocked={false}
        stateIndicator="GATE_CHECK"
      >
        <div className="p-6 space-y-6">
          <p className="font-medium text-amber-900">At least one GO verdict required</p>
          <p className="text-slate-600">
            Complete at least one experiment and get a GO verdict in Flow 9 before
            computing the final PMF score.
          </p>
          <Link
            href={`/products/${productId}/flow9`}
            className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Go to Flow 9 — Interpret Results
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={10}
      flowTitle="Flow 10: Final PMF Verdict"
      flowDescription="Capstone — aggregate everything into a 0–100 PMF score."
      productId={productId}
      productName={productName}
      isLocked={locked}
      stateIndicator={state}
    >
      <div className="p-6 space-y-8">
        {state === 'COMPUTATION' && (
          <>
            {loading ? (
              <LoadingSpinner message="Computing PMF score..." />
            ) : (
              <>
            <p className="text-slate-600">
              Run the scoring engine to compute your PMF score from all flows,
              experiments, and decisions.
            </p>
            <button
              onClick={runScoring}
              disabled={loading}
              className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Compute PMF Score
            </button>
            {error && <ApiErrorMessage onTryAgain={runScoring} />}
              </>
            )}
          </>
        )}

        {(state === 'BREAKDOWN' || state === 'AI_SUMMARY' || state === 'DECISION' || state === 'LOCKED') &&
          result && (
            <>
              {/* LAYER 1: PMF SCORE FIRST */}
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                {/* Big animated PMF gauge */}
                <div
                  className="relative flex h-40 w-40 items-center justify-center rounded-full border-8 mb-6"
                  style={{
                    borderColor: result.verdict === 'PMF_CONFIRMED' 
                      ? '#22c55e' 
                      : result.verdict === 'PMF_PARTIAL' 
                        ? '#f59e0b' 
                        : '#ef4444',
                    background: `conic-gradient(${result.verdict === 'PMF_CONFIRMED' ? '#22c55e' : result.verdict === 'PMF_PARTIAL' ? '#f59e0b' : '#ef4444'} ${(result.pmf_score / 100) * 360}deg, var(--border) 0deg)`,
                    animation: 'fadeUp 0.6s ease-out',
                  }}
                >
                  <div 
                    className="absolute inset-2 flex items-center justify-center rounded-full"
                    style={{
                      background: 'var(--bg)',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '48px',
                        fontWeight: 800,
                        color: 'var(--text)',
                      }}
                    >
                      {result.pmf_score}
                    </span>
                  </div>
                </div>

                {/* Verdict badge */}
                <div
                  className="rounded-[20px] px-8 py-3 mb-4 border-2"
                  style={{
                    background: result.verdict === 'PMF_CONFIRMED'
                      ? 'rgba(34, 197, 94, 0.1)'
                      : result.verdict === 'PMF_PARTIAL'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    borderColor: result.verdict === 'PMF_CONFIRMED'
                      ? '#22c55e'
                      : result.verdict === 'PMF_PARTIAL'
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: '20px',
                      fontWeight: 700,
                      color: result.verdict === 'PMF_CONFIRMED'
                        ? '#22c55e'
                        : result.verdict === 'PMF_PARTIAL'
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {result.verdict.replace(/_/g, ' ')}
                  </span>
                </div>

                {result.hard_kill_applied && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: '#ef4444',
                      marginBottom: '24px',
                    }}
                  >
                    ⚠️ Hard kill: {result.hard_kill_applied}
                  </p>
                )}

                {/* PRIMARY BUTTON */}
                {state === 'BREAKDOWN' && (
                  <button
                    onClick={() => setState('AI_SUMMARY')}
                    className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base"
                    style={{
                      background: result.verdict === 'PMF_CONFIRMED' 
                        ? '#22c55e' 
                        : result.verdict === 'PMF_PARTIAL' 
                          ? '#f59e0b' 
                          : '#ef4444',
                      color: result.verdict === 'PMF_PARTIAL' ? '#000' : '#fff',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    Next: AI Summary
                  </button>
                )}

                {state === 'AI_SUMMARY' && (
                  <button
                    onClick={() => setState('DECISION')}
                    className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base"
                    style={{
                      background: result.verdict === 'PMF_CONFIRMED' 
                        ? '#22c55e' 
                        : result.verdict === 'PMF_PARTIAL' 
                          ? '#f59e0b' 
                          : '#ef4444',
                      color: result.verdict === 'PMF_PARTIAL' ? '#000' : '#fff',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    Next: Decision
                  </button>
                )}

                {state === 'DECISION' && (
                  <button
                    onClick={handleAccept}
                    disabled={loading}
                    className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base disabled:opacity-50"
                    style={{
                      background: result.verdict === 'PMF_CONFIRMED' 
                        ? '#22c55e' 
                        : result.verdict === 'PMF_PARTIAL' 
                          ? '#f59e0b' 
                          : '#ef4444',
                      color: result.verdict === 'PMF_PARTIAL' ? '#000' : '#fff',
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    {loading ? 'Saving...' : '✅ Accept Verdict'}
                  </button>
                )}

                {/* SECONDARY — expand breakdown */}
                <button
                  onClick={() => setShowBreakdown(!showBreakdown)}
                  className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium"
                  style={{
                    background: 'transparent',
                    borderColor: 'var(--border)',
                    borderWidth: '1.5px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  🔍 {showBreakdown ? 'Hide breakdown' : 'Show breakdown'}
                </button>

                {/* LAYER 2: BREAKDOWN (Expandable) */}
                {showBreakdown && (
                  <div
                    className="w-full max-w-[600px] mt-6 fade-up text-left"
                    style={{
                      animation: 'fadeUp 0.4s ease-out',
                    }}
                  >
                    <div className="space-y-2">
                      {['foundation', 'experiment', 'consistency', 'penalties', 'modifiers'].map(
                        (key) => {
                          const isOpen = expandedBreakdown === key;
                          const label =
                            key === 'foundation'
                              ? `Foundation [${result.foundation.total}/${result.foundation.max}]`
                              : key === 'experiment'
                                ? `Experiment [${result.experiment.total}/${result.experiment.max}]`
                                : key === 'consistency'
                                  ? `Consistency [${result.consistency.total}/${result.consistency.max}]`
                                  : key === 'penalties'
                                    ? `Penalties [${result.total_penalty}]`
                                    : `Modifiers [+${result.total_modifiers}]`;
                          return (
                            <div
                              key={key}
                              style={{
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedBreakdown(isOpen ? null : key)
                                }
                                className="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
                                style={{
                                  color: 'var(--text)',
                                  fontFamily: 'Space Grotesk, sans-serif',
                                }}
                              >
                                {label}
                                {isOpen ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              {isOpen && (
                                <div
                                  className="border-t px-4 py-3 text-sm"
                                  style={{
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {key === 'foundation' && (
                                    <ul className="list-inside space-y-1">
                                      <li>Pain: {result.foundation.pain.score}/10 — {result.foundation.pain.label}</li>
                                      <li>Customer: {result.foundation.customer.score}/10 — {result.foundation.customer.label}</li>
                                      <li>Solution: {result.foundation.solution.score}/10 — {result.foundation.solution.label}</li>
                                      <li>Price: {result.foundation.price.score}/5 — {result.foundation.price.label}</li>
                                      <li>Channel: {result.foundation.channel.score}/5 — {result.foundation.channel.label}</li>
                                    </ul>
                                  )}
                                  {key === 'experiment' && (
                                    <ul className="list-inside space-y-1">
                                      <li>Primary metric: {result.experiment.primary_metric.score}/10 — {result.experiment.primary_metric.label}</li>
                                      <li>Gates: {result.experiment.gates.score}/10 — {result.experiment.gates.label}</li>
                                      <li>Signal quality: {result.experiment.signal_quality.score}/5 — {result.experiment.signal_quality.label}</li>
                                      <li>Integrity: {result.experiment.integrity.score}/5 — {result.experiment.integrity.label}</li>
                                    </ul>
                                  )}
                                  {key === 'consistency' && (
                                    <ul className="list-inside space-y-1">
                                      <li>CPA stability: {result.consistency.cpa_stability.score}/8 — {result.consistency.cpa_stability.label}</li>
                                      <li>Net margin: {result.consistency.net_margin.score}/8 — {result.consistency.net_margin.label}</li>
                                      <li>Cancel rate: {result.consistency.cancel_rate.score}/5 — {result.consistency.cancel_rate.label}</li>
                                      <li>Repeat buyers: {result.consistency.repeat_buyers.score}/5 — {result.consistency.repeat_buyers.label}</li>
                                      <li>Sean Ellis: {result.consistency.sean_ellis.score}/4 — {result.consistency.sean_ellis.label}</li>
                                    </ul>
                                  )}
                                  {key === 'penalties' && (
                                    <ul className="list-inside space-y-1">
                                      {result.penalty_sources.length === 0
                                        ? 'None'
                                        : result.penalty_sources.map((s, i) => (
                                            <li key={i}>
                                              Flow {s.flow}: {s.penalty}
                                            </li>
                                          ))}
                                    </ul>
                                  )}
                                  {key === 'modifiers' && (
                                    <ul className="list-inside space-y-1">
                                      {result.modifier_sources.length === 0
                                        ? 'None'
                                        : result.modifier_sources.map((s, i) => (
                                            <li key={i}>
                                              {s.reason}: +{s.value}
                                            </li>
                                          ))}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Summary - shown after BREAKDOWN state */}
              {state !== 'BREAKDOWN' && aiSummary && showBreakdown && (
                <div
                  className="w-full max-w-[600px] mt-6 fade-up"
                  style={{
                    animation: 'fadeUp 0.4s ease-out',
                  }}
                >
                  <div
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '16px',
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: 'Space Grotesk, sans-serif',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: 'var(--cyan)',
                        marginBottom: '12px',
                        letterSpacing: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      💡 AI Summary
                    </h3>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginBottom: '8px',
                      }}
                    >
                      {aiSummary.one_line_summary}
                    </p>
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.7,
                        marginBottom: '12px',
                      }}
                    >
                      {aiSummary.score_explanation}
                    </p>
                    {aiSummary.strengths.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <p
                          style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Strengths
                        </p>
                        <ul className="list-inside list-disc space-y-1">
                          {aiSummary.strengths.map((s, i) => (
                            <li
                              key={i}
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '14px',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aiSummary.risks.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <p
                          style={{
                            fontFamily: 'Space Grotesk, sans-serif',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                          }}
                        >
                          Risks
                        </p>
                        <ul className="list-inside list-disc space-y-1">
                          {aiSummary.risks.map((r, i) => (
                            <li
                              key={i}
                              style={{
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '14px',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--text)',
                        marginTop: '12px',
                      }}
                    >
                      Recommended next: {aiSummary.recommended_next}
                    </p>
                    {aiSummary.gap_analysis && (
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          marginTop: '8px',
                        }}
                      >
                        Gap analysis: {aiSummary.gap_analysis}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {state === 'DECISION' && error && (
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: '#ef4444',
                    marginTop: '16px',
                  }}
                >
                  {error}
                </p>
              )}

              {state === 'LOCKED' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
                    <p className="font-medium text-emerald-900">Final verdict saved</p>
                  </div>
                  {result.verdict === 'PMF_CONFIRMED' && (
                    <Link
                      href={`/products/${productId}`}
                      className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Proceed to Scale
                    </Link>
                  )}
                  {result.verdict === 'PMF_PARTIAL' && (
                    <>
                      {aiSummary?.gap_analysis && (
                        <p className="text-sm text-amber-800">Gap: {aiSummary.gap_analysis}</p>
                      )}
                      <Link
                        href={`/products/${productId}/flow7`}
                        className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                      >
                        Fix and Re-prove
                      </Link>
                    </>
                  )}
                  {result.verdict === 'NO_PMF' && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700">Learnings captured in the breakdown above.</p>
                      <Link
                        href={`/products/${productId}/killed`}
                        className="inline-flex rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                      >
                        Kill or Pivot
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
      </div>
    </FlowContainer>
  );
}
