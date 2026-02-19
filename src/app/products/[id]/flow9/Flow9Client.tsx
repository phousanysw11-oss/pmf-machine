'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { useToast } from '@/components/ui/Toast';

type FlowState =
  | 'DATA_CHECK'
  | 'COMPUTATION'
  | 'VERDICT'
  | 'POST_DECISION'
  | 'LOCKED';

type GateResult = { name: string; pass: boolean; value: number | string; threshold: string };

type Flow9ClientProps = {
  productId: string;
  productName: string;
  experimentId: string;
  experimentHypothesis: string;
  hasResultsData: boolean;
  timeLimitReached: boolean;
};

const OVERRIDE_PENALTIES: Record<string, Record<string, number>> = {
  KILL: { GO: 10, FIX: 5 },
  FIX: { GO: 5 },
  GO: {},
};

export function Flow9Client({
  productId,
  productName,
  experimentId,
  experimentHypothesis,
  hasResultsData,
  timeLimitReached,
}: Flow9ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    !hasResultsData ? 'DATA_CHECK' : 'COMPUTATION'
  );
  const [interpretation, setInterpretation] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideDirection, setOverrideDirection] = useState<'GO' | 'FIX' | 'KILL' | ''>('');
  const [overrideReason, setOverrideReason] = useState('');
  const [lockedDecision, setLockedDecision] = useState<string | null>(null);
  const [postDecisionVerdict, setPostDecisionVerdict] = useState<string | null>(null);
  const { showToast } = useToast();

  const runInterpretation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experimentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setInterpretation(data);
      setState('VERDICT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to interpret results');
    } finally {
      setLoading(false);
    }
  };

  const handlePrimaryAction = async () => {
    const verdict = (interpretation?.recommendation as string) ?? 'FIX';
    setLoading(true);
    try {
      await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          experimentId,
          ai_recommendation: verdict,
          ai_reason: interpretation?.reason,
          human_decision: verdict,
          override_applied: false,
        }),
      });
      showToast('Decision saved ✓');
      setPostDecisionVerdict(verdict);
      setState('POST_DECISION');
      
      // Auto-navigate after 1.5s
      setTimeout(() => {
        if (verdict === 'GO') {
          router.push(`/products/${productId}/flow10`);
        } else if (verdict === 'FIX') {
          router.push(`/products/${productId}/flow7`);
        } else {
          router.push(`/products/${productId}/killed`);
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save decision');
    } finally {
      setLoading(false);
    }
  };

  const handleOverrideConfirm = async () => {
    if (!overrideDirection || overrideReason.trim().length < 30) return;
    const aiRec = (interpretation?.recommendation as string) ?? 'FIX';
    const penalty = OVERRIDE_PENALTIES[aiRec]?.[overrideDirection] ?? 0;
    setLoading(true);
    try {
      await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          experimentId,
          ai_recommendation: aiRec,
          ai_reason: interpretation?.reason,
          human_decision: overrideDirection,
          override_applied: true,
          override_reason: overrideReason.trim(),
          override_penalty: penalty,
        }),
      });
      showToast('Override saved ✓');
      setPostDecisionVerdict(overrideDirection);
      setShowOverride(false);
      setState('POST_DECISION');
      
      // Auto-navigate after 1.5s
      setTimeout(() => {
        if (overrideDirection === 'GO') {
          router.push(`/products/${productId}/flow10`);
        } else if (overrideDirection === 'FIX') {
          router.push(`/products/${productId}/flow7`);
        } else {
          router.push(`/products/${productId}/killed`);
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save override');
    } finally {
      setLoading(false);
    }
  };

  const gates = (interpretation?.gates as { gates: GateResult[] })?.gates ?? [];
  const verdict = (interpretation?.recommendation as string) ?? 'FIX';
  const aiReason = (interpretation?.reason as string) ?? 'No reason provided';
  const aiAnalysis = (interpretation?.result_summary as string) ?? '';
  const fixTarget = interpretation?.fix_target as string | null;

  // Get gates passed count
  const gatesPassed = gates.filter(g => g.pass).length;

  // Get one-sentence reason (max 10 words)
  const oneSentenceReason = aiReason.split('.').filter(s => s.trim())[0]?.trim() || aiReason;
  const words = oneSentenceReason.split(' ').slice(0, 10).join(' ');

  if (state === 'LOCKED' && lockedDecision) {
    return (
      <FlowContainer
        flowNumber={9}
        flowTitle="Flow 9: Result Interpretation & Recommendation"
        flowDescription="Verdict: compare results to criteria and recommend GO / FIX / KILL."
        productId={productId}
        productName={productName}
        isLocked={false}
        stateIndicator="LOCKED"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3 rounded-lg bg-emerald-50 p-4">
            <div>
              <p className="font-medium text-emerald-900">Decision saved</p>
              <p className="text-emerald-800">Verdict: {lockedDecision}</p>
            </div>
          </div>
          {lockedDecision === 'GO' && (
            <Link
              href={`/products/${productId}/flow10`}
              className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Continue to Flow 10
            </Link>
          )}
          {lockedDecision === 'FIX' && (
            <Link
              href={`/products/${productId}/flow7`}
              className="inline-flex rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Back to Flow 7
            </Link>
          )}
          {lockedDecision === 'KILL' && (
            <Link
              href={`/products/${productId}/killed`}
              className="inline-flex rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Product archive & kill summary
            </Link>
          )}
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={9}
      flowTitle="Flow 9: Result Interpretation & Recommendation"
      flowDescription="Verdict: compare results to criteria and recommend GO / FIX / KILL."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'DATA_CHECK' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <p className="font-medium text-slate-900 mb-2">No experiment results yet</p>
            <p className="text-slate-600 mb-6">
              Enter experiment data in Flow 6 (Signal Interpreter) first. Once
              you have at least one checkpoint, return here to interpret.
            </p>
            <Link
              href={`/products/${productId}/flow6`}
              className="inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Open Flow 6 — Enter data
            </Link>
          </div>
        )}

        {state === 'COMPUTATION' && hasResultsData && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            {loading ? (
              <LoadingSpinner message="Interpreting results..." />
            ) : (
              <>
                <p className="text-slate-600 mb-6">
                  Run full interpretation (gates + criteria + AI recommendation).
                </p>
                <button
                  onClick={runInterpretation}
                  disabled={loading}
                  className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Interpret Results
                </button>
                {error && <ApiErrorMessage onTryAgain={runInterpretation} />}
              </>
            )}
          </div>
        )}

        {/* LAYER 1: THE VERDICT */}
        {state === 'VERDICT' && interpretation && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            {/* Big verdict badge */}
            <div
              className="rounded-[20px] px-10 py-4 mb-4 border-2"
              style={{
                background: verdict === 'GO' 
                  ? 'rgba(34, 197, 94, 0.1)' 
                  : verdict === 'FIX' 
                    ? 'rgba(245, 158, 11, 0.1)' 
                    : 'rgba(239, 68, 68, 0.1)',
                borderColor: verdict === 'GO' 
                  ? '#22c55e' 
                  : verdict === 'FIX' 
                    ? '#f59e0b' 
                    : '#ef4444',
              }}
            >
              <span style={{ fontSize: '32px', display: 'inline-block', marginRight: '12px' }}>
                {verdict === 'GO' ? '🚀' : verdict === 'FIX' ? '🔧' : '💀'}
              </span>
              <span
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: verdict === 'GO' 
                    ? '#22c55e' 
                    : verdict === 'FIX' 
                      ? '#f59e0b' 
                      : '#ef4444',
                }}
              >
                {verdict}
              </span>
            </div>

            {/* ONE sentence — the AI's reason, max 10 words */}
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
              {words}
            </p>

            {/* Gate dots — tiny, visual, no text needed */}
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '24px',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: 'var(--text-muted)',
                  marginRight: '4px',
                }}
              >
                {gatesPassed}/4 gates
              </span>
              {gates.map((gate, i) => (
                <div
                  key={i}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: gate.pass ? '#22c55e' : '#ef4444',
                    boxShadow: gate.pass 
                      ? '0 0 8px rgba(34, 197, 94, 0.4)' 
                      : '0 0 8px rgba(239, 68, 68, 0.4)',
                  }}
                />
              ))}
            </div>

            {/* PRIMARY BUTTON — the only thing that matters */}
            <button
              onClick={handlePrimaryAction}
              disabled={loading}
              className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base"
              style={{
                background: verdict === 'GO' 
                  ? '#22c55e' 
                  : verdict === 'FIX' 
                    ? '#f59e0b' 
                    : '#ef4444',
                color: verdict === 'FIX' ? '#000' : '#fff',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              {loading 
                ? 'Saving...' 
                : verdict === 'GO' 
                  ? '✅ Confirm — Move to Scale' 
                  : verdict === 'FIX' 
                    ? '🔧 I Agree — Fix It' 
                    : '💀 Kill This Product'}
            </button>

            {/* SECONDARY — expand details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium"
              style={{
                background: 'transparent',
                borderColor: 'var(--border)',
                borderWidth: '1.5px',
                color: 'var(--text-secondary)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              🔍 {showDetails ? 'Hide details' : 'Show me the data'}
            </button>

            {/* TERTIARY — override */}
            <button
              onClick={() => setShowOverride(true)}
              className="bg-transparent border-none cursor-pointer text-sm underline mt-4"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              ⚡ Override this verdict
            </button>

            {error && <ApiErrorMessage onTryAgain={handlePrimaryAction} />}

            {/* LAYER 2: THE DATA (Only shown when "Show me the data" is clicked) */}
            {showDetails && (
              <div
                className="w-full max-w-[480px] mt-6 fade-up"
                style={{
                  animation: 'fadeUp 0.4s ease-out',
                }}
              >
                {/* Gate Results */}
                <h3
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    marginBottom: '12px',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                  }}
                >
                  📊 Experiment Results
                </h3>

                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {gates.map((gate, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderBottom: i < gates.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            fontSize: '14px',
                            color: 'var(--text)',
                          }}
                        >
                          {gate.name}
                        </div>
                        <div
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: '2px',
                          }}
                        >
                          Target: {gate.threshold}
                        </div>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '16px',
                            fontWeight: 600,
                            color: 'var(--text)',
                          }}
                        >
                          {gate.value}
                        </span>
                        <span style={{ fontSize: '18px' }}>
                          {gate.pass ? '✅' : '❌'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AI Analysis */}
                <div
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '12px',
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
                    💡 AI Analysis
                  </h3>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.7,
                    }}
                  >
                    {aiAnalysis || 'No analysis available.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LAYER 3: OVERRIDE (Modal/Drawer) */}
        {showOverride && interpretation && (
          <>
            {/* Dark overlay */}
            <div
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setShowOverride(false)}
            />
            {/* Bottom drawer */}
            <div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] p-6 max-h-[80vh] overflow-y-auto"
              style={{
                background: 'var(--surface)',
                borderTop: '1px solid var(--border)',
                animation: 'slideUp 0.3s ease-out',
              }}
            >
              <h2
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '20px',
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: '8px',
                }}
              >
                ⚡ Override Verdict
              </h2>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '24px',
                }}
              >
                AI recommends: <strong>{verdict}</strong>
              </p>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                }}
              >
                You want to change to:
              </p>

              {/* 3 option pills */}
              <div className="flex gap-3 mb-6">
                {(['GO', 'FIX', 'KILL'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setOverrideDirection(option)}
                    className="flex-1 py-3 px-4 rounded-[12px] border-2 font-semibold text-sm transition-all"
                    style={{
                      background: overrideDirection === option
                        ? option === 'GO'
                          ? '#22c55e'
                          : option === 'FIX'
                            ? '#f59e0b'
                            : '#ef4444'
                        : 'transparent',
                      borderColor: overrideDirection === option
                        ? option === 'GO'
                          ? '#22c55e'
                          : option === 'FIX'
                            ? '#f59e0b'
                            : '#ef4444'
                        : 'var(--border)',
                      color: overrideDirection === option && option === 'FIX' ? '#000' : overrideDirection === option ? '#fff' : 'var(--text-secondary)',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {/* Why? textarea */}
              <label
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text)',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Why? (required)
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you're overriding the AI recommendation..."
                rows={4}
                className="w-full rounded-[12px] border px-4 py-3 resize-none"
                style={{
                  background: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                }}
                minLength={30}
              />
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginTop: '4px',
                  marginBottom: '16px',
                }}
              >
                {overrideReason.length} chars (min 30)
              </p>

              {/* Penalty warning */}
              {overrideDirection && (
                <div
                  className="rounded-[12px] p-4 mb-6"
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '13px',
                      color: '#f59e0b',
                    }}
                  >
                    ⚠️ {overrideDirection === 'GO' && verdict !== 'GO'
                      ? `Upgrading to GO carries -${OVERRIDE_PENALTIES[verdict]?.[overrideDirection] ?? 0} penalty. Max PMF drops to ${100 - (OVERRIDE_PENALTIES[verdict]?.[overrideDirection] ?? 0)}.`
                      : overrideDirection !== verdict
                        ? `Changing verdict carries -${OVERRIDE_PENALTIES[verdict]?.[overrideDirection] ?? 0} penalty.`
                        : 'No penalty for keeping current verdict.'}
                  </p>
                </div>
              )}

              {/* Confirm Override button */}
              <button
                onClick={handleOverrideConfirm}
                disabled={
                  !overrideDirection ||
                  overrideReason.trim().length < 30 ||
                  loading
                }
                className="w-full h-14 rounded-[14px] border-none cursor-pointer font-semibold text-base mb-3 disabled:opacity-50"
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  fontFamily: 'Space Grotesk, sans-serif',
                }}
              >
                {loading ? 'Saving...' : 'Confirm Override'}
              </button>

              {/* Cancel */}
              <button
                onClick={() => setShowOverride(false)}
                className="w-full text-center text-sm"
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {/* LAYER 4: POST-DECISION (After user confirms) */}
        {state === 'POST_DECISION' && postDecisionVerdict && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            {postDecisionVerdict === 'GO' && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🚀</div>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  Moving to Scale
                </h2>
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Redirecting to Flow 10...
                </p>
              </>
            )}
            {postDecisionVerdict === 'FIX' && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔧</div>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  Let&apos;s fix it
                </h2>
                {fixTarget && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '16px',
                    }}
                  >
                    What to fix: {fixTarget}
                  </p>
                )}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Redirecting to Flow 7...
                </p>
              </>
            )}
            {postDecisionVerdict === 'KILL' && (
              <>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>💀</div>
                <h2
                  style={{
                    fontFamily: 'Space Grotesk, sans-serif',
                    fontSize: '24px',
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: '8px',
                  }}
                >
                  Product killed
                </h2>
                {interpretation?.money_saved && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                    }}
                  >
                    Money saved: {interpretation.money_saved as string}
                  </p>
                )}
                {interpretation?.learning && (
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '14px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Learning: {interpretation.learning as string}
                  </p>
                )}
                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '14px',
                    color: 'var(--text-secondary)',
                    marginTop: '16px',
                  }}
                >
                  Redirecting...
                </p>
              </>
            )}
          </div>
        )}
      </div>

    </FlowContainer>
  );
}
