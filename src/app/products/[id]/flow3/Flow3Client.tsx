'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';

type FlowState =
  | 'GATE_CHECK'
  | 'INITIAL'
  | 'AI_STRESS_TEST'
  | 'HUMAN_DEFENSE'
  | 'AI_VERDICT'
  | 'OVERRIDE'
  | 'CONFIRM'
  | 'LOCKED';

type Challenge = {
  challenge_text: string;
  alternative_named: string;
  switching_barrier: string;
};

type AIVerdict = {
  verdict: string;
  explanation: string;
  strongest_point: string;
  weakest_point: string;
};

type CustomerProfile = Record<string, unknown>;

type Flow3ClientProps = {
  productId: string;
  productName: string;
  painText: string;
  customerProfile: CustomerProfile | null;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow3Client({
  productId,
  productName,
  painText,
  customerProfile,
  initialData,
  isLocked,
}: Flow3ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    isLocked ? 'LOCKED' : (initialData?.state as FlowState) ?? 'INITIAL'
  );
  const [defenseText, setDefenseText] = useState(
    (initialData?.defense_text as string) ?? ''
  );
  const [challenges, setChallenges] = useState<Challenge[]>(
    (initialData?.challenges as Challenge[]) ?? []
  );
  const [defenseResponses, setDefenseResponses] = useState<string[]>(
    (initialData?.defense_responses as string[]) ?? ['', '', '']
  );
  const [aiVerdict, setAiVerdict] = useState<AIVerdict | null>(
    (initialData?.ai_verdict as AIVerdict) ?? null
  );
  const [overrideApplied, setOverrideApplied] = useState(
    (initialData?.override_applied as boolean) ?? false
  );
  const [overrideReason, setOverrideReason] = useState(
    (initialData?.override_reason as string) ?? ''
  );
  const [penalty, setPenalty] = useState((initialData?.penalty as number) ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { showToast } = useToast();

  const customerLabel =
    customerProfile && typeof customerProfile === 'object'
      ? (customerProfile as { who?: string }).who ??
        (customerProfile as { custom_text?: string }).custom_text ??
        'your customer'
      : 'your customer';

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 3,
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

  const fetchChallenges = async () => {
    if (defenseText.trim().length < 20) return;
    setState('AI_STRESS_TEST');
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/flow3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stress_test',
          painText,
          customerProfile,
          operatorInput: defenseText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate challenges');
      setChallenges(data.challenges ?? []);
      await saveDraft({ defense_text: defenseText, challenges: data.challenges });
      setDefenseResponses(['', '', '']);
      setState('HUMAN_DEFENSE');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate challenges');
      setState('INITIAL');
    } finally {
      setLoading(false);
    }
  };

  const fetchVerdict = async () => {
    const responses = defenseResponses.map((r) => r.trim());
    if (responses.some((r) => r.length < 20)) return;
    setState('AI_VERDICT');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow3', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verdict',
          challenges,
          defenseResponses: responses,
          operatorInput: defenseText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to evaluate');
      setAiVerdict(data);
      await saveDraft({
        defense_responses: responses,
        ai_verdict: data,
      });
      setState('AI_VERDICT');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate defenses');
      setState('HUMAN_DEFENSE');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDefense = () => {
    const responses = defenseResponses.map((r) => r.trim());
    if (responses.every((r) => r.length >= 20)) {
      fetchVerdict();
    }
  };

  const handleTryAgain = () => {
    setState('AI_STRESS_TEST');
    setAiVerdict(null);
    fetchChallenges();
  };

  const handleAdmitNoDifference = () => {
    setState('OVERRIDE');
  };

  const handleRethink = () => {
    setState('INITIAL');
    setChallenges([]);
    setDefenseResponses(['', '', '']);
    setAiVerdict(null);
  };

  const handleOverrideSubmit = async () => {
    if (overrideReason.trim().length < 30) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flows/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          flowNumber: 3,
          data: {
            defense_text: defenseText,
            challenges,
            defense_responses: defenseResponses,
            ai_verdict: aiVerdict,
            override_applied: true,
            override_reason: overrideReason.trim(),
            penalty: 15,
          },
          penalty: 15,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }

      setOverrideApplied(true);
      setPenalty(15);
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock');
    } finally {
      setLoading(false);
    }
  };

  const handleLockConfirm = async () => {
    setConfirmLockOpen(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flows/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          flowNumber: 3,
          data: {
            defense_text: defenseText,
            challenges,
            defense_responses: defenseResponses,
            ai_verdict: aiVerdict,
            override_applied: overrideApplied,
            override_reason: overrideReason || undefined,
            penalty: 0,
          },
          penalty: 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }
      showToast('Flow 3 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock flow');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setState('HUMAN_DEFENSE');
  };

  const verdictColor =
    aiVerdict?.verdict === 'STRONG'
      ? 'emerald'
      : aiVerdict?.verdict === 'WEAK'
        ? 'amber'
        : 'red';

  if (isLocked || state === 'LOCKED') {
    const lockedData = (initialData ?? {}) as Record<string, unknown>;
    const verdict = (lockedData.ai_verdict as { verdict?: string })?.verdict;
    const lockedPenalty = (lockedData.penalty as number) ?? penalty;
    const override = lockedData.override_applied ?? overrideApplied;

    return (
      <FlowContainer
        flowNumber={3}
        flowTitle="Flow 3: Solution Differentiation"
        flowDescription="Stress-test whether your product is genuinely different."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-emerald-900">Differentiation locked</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`rounded-md px-2.5 py-1 text-sm font-semibold uppercase ${
                    verdict === 'STRONG'
                      ? 'bg-emerald-100 text-emerald-800'
                      : verdict === 'WEAK'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  {verdict ?? 'N/A'}
                </span>
                {override && (
                  <span className="rounded-md bg-amber-100 px-2.5 py-1 text-sm text-amber-800">
                    Override applied
                  </span>
                )}
              </div>
              <p className="mt-2 text-slate-700">
                <strong>Claim:</strong> {(lockedData.defense_text as string) ?? defenseText}
              </p>
              {lockedPenalty > 0 && (
                <p className="mt-2 text-sm text-amber-600">
                  -{lockedPenalty} penalty applied (admitted no difference)
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/products/${productId}/flow4`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)' }}
          >
            Continue to Flow 4 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={3}
      flowTitle="Flow 3: Solution Differentiation"
      flowDescription="Stress-test whether your product is genuinely different."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'INITIAL' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-700">
              What makes your product different from alternatives? Why would{' '}
              {customerLabel} switch to you?
            </p>
            <textarea
              value={defenseText}
              onChange={(e) => setDefenseText(e.target.value)}
              placeholder="e.g. We deliver within 24 hours to rural areas where Shopee takes 5-7 days..."
              rows={4}
              className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              minLength={20}
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-sm ${
                  defenseText.length < 20 ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {defenseText.length} characters (min 20)
              </span>
              <button
                onClick={fetchChallenges}
                disabled={defenseText.trim().length < 20}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Stress test my claim
              </button>
            </div>
            {error && <ApiErrorMessage onTryAgain={fetchChallenges} />}
          </div>
        )}

        {state === 'AI_STRESS_TEST' && (
          <div className="flow-transition-enter-active">
            <LoadingSpinner message="Preparing stress test..." />
          </div>
        )}

        {state === 'HUMAN_DEFENSE' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Defend against each challenge. Be specific — marketing speak won&apos;t
              pass.
            </p>
            <div className="space-y-4">
              {challenges.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4"
                >
                  <p className="text-sm font-semibold text-red-800">
                    Challenge {i + 1}:
                  </p>
                  <p className="mt-1 text-slate-800">{c.challenge_text}</p>
                  <label className="mt-3 block text-xs font-medium text-slate-600">
                    Your defense
                  </label>
                  <textarea
                    value={defenseResponses[i] ?? ''}
                    onChange={(e) => {
                      const next = [...defenseResponses];
                      next[i] = e.target.value;
                      setDefenseResponses(next);
                    }}
                    placeholder="Your specific, verifiable response (min 20 chars)..."
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    minLength={20}
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    {(defenseResponses[i] ?? '').length} characters (min 20)
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmitDefense}
              disabled={defenseResponses.some((r) => r.trim().length < 20)}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Submit defense
            </button>
            {error && <ApiErrorMessage onTryAgain={handleSubmitDefense} />}
          </div>
        )}

        {state === 'AI_VERDICT' && (
          <div className="flow-transition-enter-active">
            {loading ? (
              <LoadingSpinner message="Evaluating defense..." />
            ) : error ? (
              <ApiErrorMessage onTryAgain={fetchVerdict} />
            ) : aiVerdict ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
                {/* Big verdict badge */}
                <div
                  className="rounded-[20px] px-10 py-4 mb-4 border-2"
                  style={{
                    background: aiVerdict.verdict === 'STRONG'
                      ? 'rgba(34, 197, 94, 0.1)'
                      : aiVerdict.verdict === 'WEAK'
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(239, 68, 68, 0.1)',
                    borderColor: aiVerdict.verdict === 'STRONG'
                      ? '#22c55e'
                      : aiVerdict.verdict === 'WEAK'
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                >
                  <span style={{ fontSize: '32px', display: 'inline-block', marginRight: '12px' }}>
                    {aiVerdict.verdict === 'STRONG' ? '✅' : aiVerdict.verdict === 'WEAK' ? '⚠️' : '❌'}
                  </span>
                  <span
                    style={{
                      fontFamily: 'Space Grotesk, sans-serif',
                      fontSize: '28px',
                      fontWeight: 800,
                      color: aiVerdict.verdict === 'STRONG'
                        ? '#22c55e'
                        : aiVerdict.verdict === 'WEAK'
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {aiVerdict.verdict}
                  </span>
                </div>

                {/* ONE sentence explanation */}
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
                  {aiVerdict.explanation.split('.').filter(s => s.trim())[0]?.trim() || aiVerdict.explanation}
                </p>

                {/* PRIMARY BUTTON */}
                {aiVerdict.verdict === 'NONE' ? (
                  <div className="space-y-3 w-full max-w-[360px]">
                    <button
                      onClick={handleTryAgain}
                      className="w-full h-12 rounded-[12px] border px-4 py-2 text-left text-sm font-medium"
                      style={{
                        background: 'transparent',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                    >
                      Identify a difference I missed
                    </button>
                    <button
                      onClick={handleAdmitNoDifference}
                      className="w-full h-12 rounded-[12px] border px-4 py-2 text-left text-sm font-medium"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        borderColor: '#ef4444',
                        color: '#ef4444',
                      }}
                    >
                      Admit no difference — compete on execution (-15 penalty)
                    </button>
                    <button
                      onClick={handleRethink}
                      className="w-full h-12 rounded-[12px] border px-4 py-2 text-left text-sm font-medium"
                      style={{
                        background: 'transparent',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Go back and rethink
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirmLockOpen(true)}
                      disabled={loading}
                      className="w-full max-w-[360px] h-14 rounded-[14px] border-none cursor-pointer mb-2 font-semibold text-base"
                      style={{
                        background: aiVerdict.verdict === 'STRONG' ? '#22c55e' : '#f59e0b',
                        color: '#fff',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {loading ? 'Locking…' : '✅ Lock This Verdict'}
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={loading}
                      className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium"
                      style={{
                        background: 'transparent',
                        borderColor: 'var(--border)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      Edit Defense
                    </button>
                  </>
                )}

                {/* SECONDARY — expand details */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium mt-2"
                  style={{
                    background: 'transparent',
                    borderColor: 'var(--border)',
                    borderWidth: '1.5px',
                    color: 'var(--text-secondary)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  🔍 {showDetails ? 'Hide challenges & defense' : 'Show challenges & defense'}
                </button>

                {/* LAYER 2: DETAILS */}
                {showDetails && (
                  <div
                    className="w-full max-w-[480px] mt-6 fade-up text-left"
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
                        💡 Full Analysis
                      </h3>
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          fontSize: '14px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.7,
                          marginBottom: '12px',
                        }}
                      >
                        {aiVerdict.explanation}
                      </p>
                      {aiVerdict.strongest_point && (
                        <div style={{ marginBottom: '12px' }}>
                          <p
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#22c55e',
                              marginBottom: '4px',
                            }}
                          >
                            ✅ Strongest:
                          </p>
                          <p
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '14px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {aiVerdict.strongest_point}
                          </p>
                        </div>
                      )}
                      {aiVerdict.weakest_point && (
                        <div>
                          <p
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#f59e0b',
                              marginBottom: '4px',
                            }}
                          >
                            ⚠️ Weakest:
                          </p>
                          <p
                            style={{
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '14px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {aiVerdict.weakest_point}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {state === 'OVERRIDE' && (
          <div className="space-y-6 rounded-lg border-2 border-amber-200 bg-amber-50 p-6">
            <p className="flex items-center gap-2 font-medium text-amber-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              This carries -15 penalty. Your maximum PMF score drops to 85. Proceed?
            </p>
            <div>
              <label className="block text-sm font-medium text-amber-900">
                Reason (min 30 chars)
              </label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. We'll compete on delivery speed and customer service in our region..."
                rows={3}
                className="mt-2 block w-full rounded-lg border border-amber-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                minLength={30}
              />
              <span className="mt-1 block text-xs text-amber-700">
                {overrideReason.length} characters (min 30)
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleOverrideSubmit}
                disabled={overrideReason.trim().length < 30 || loading}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? 'Saving…' : 'Proceed with -15 penalty'}
              </button>
              <button
                onClick={() => setState('AI_VERDICT')}
                disabled={loading}
                className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Cancel
              </button>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleOverrideSubmit} />}
          </div>
        )}

        <ConfirmModal
          open={confirmLockOpen}
          title="Lock solution defense?"
          confirmLabel="Lock"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmLockOpen(false)}
        >
          <p className="text-sm">
            You won&apos;t be able to edit this defense without overriding.
          </p>
        </ConfirmModal>
      </div>
    </FlowContainer>
  );
}
