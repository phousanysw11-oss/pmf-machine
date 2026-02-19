'use client';

import { useState, useCallback, useEffect } from 'react';
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
  | 'AI_SCENARIOS'
  | 'SELECTION'
  | 'HONESTY_GATE'
  | 'HONESTY_EVALUATING'
  | 'CONTRADICTED'
  | 'MARGIN_PREVIEW'
  | 'CONFIRM'
  | 'LOCKED';

type Scenario = {
  tier: string;
  price_usd: number;
  price_lak: number;
  logic: string;
  cod_cancel_risk_percent: number;
  who_buys_description: string;
  honesty_question: string;
};

type Flow4ClientProps = {
  productId: string;
  productName: string;
  painText: string;
  customerProfile: Record<string, unknown> | null;
  solutionDescription: string;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

function marginVerdict(marginPercent: number): string {
  if (marginPercent >= 70) return 'Strong';
  if (marginPercent >= 50) return 'Viable';
  if (marginPercent >= 30) return 'Tight';
  return 'No Margin';
}

export function Flow4Client({
  productId,
  productName,
  painText,
  customerProfile,
  solutionDescription,
  initialData,
  isLocked,
}: Flow4ClientProps) {
  const router = useRouter();
  const initialScenarios = (initialData?.scenarios as Scenario[]) ?? [];
  const hasScenarios = initialScenarios.length > 0;

  const [state, setState] = useState<FlowState>(() => {
    if (isLocked) return 'LOCKED';
    const init = initialData?.state as FlowState;
    if (init) return init;
    return hasScenarios ? 'SELECTION' : 'AI_SCENARIOS';
  });
  const [scenarios, setScenarios] = useState<Scenario[]>(initialScenarios);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(
    null
  );
  const [honestyAnswer, setHonestyAnswer] = useState('');
  const [honestyVerdict, setHonestyVerdict] = useState<{
    verdict: string;
    contradiction: string | null;
    recommended_tier: string | null;
  } | null>(null);
  const [showResearchChecklist, setShowResearchChecklist] = useState(false);
  const [penalty, setPenalty] = useState((initialData?.penalty as number) ?? 0);
  const [insistedDespiteContradiction, setInsistedDespiteContradiction] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const { showToast } = useToast();

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 4,
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

  const fetchScenarios = useCallback(async () => {
    setState('AI_SCENARIOS');
    setError(null);

    try {
      const res = await fetch('/api/ai/flow4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scenarios',
          painText,
          customerProfile,
          solutionDescription,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Failed to generate scenarios');

      setScenarios(data.scenarios ?? []);
      await saveDraft({ scenarios: data.scenarios, market_context: data.market_context });
      setState('SELECTION');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate price scenarios');
      setState('AI_SCENARIOS');
    }
  }, [painText, customerProfile, solutionDescription, saveDraft]);

  useEffect(() => {
    if (isLocked) return;
    if (scenarios.length > 0) {
      setState((s) => (s === 'AI_SCENARIOS' ? 'SELECTION' : s));
      return;
    }
    if (painText) {
      fetchScenarios();
    }
  }, [isLocked, painText, scenarios.length, fetchScenarios]);

  const handleSelectScenario = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setHonestyVerdict(null);
    setHonestyAnswer('');
    setState('HONESTY_GATE');
    saveDraft({
      selected_tier: scenario.tier,
      selected_price_usd: scenario.price_usd,
      selected_price_lak: scenario.price_lak,
    });
  };

  const handleHonestySubmit = async () => {
    if (!selectedScenario || honestyAnswer.trim().length < 20) return;
    setState('HONESTY_EVALUATING');
    setError(null);

    try {
      const res = await fetch('/api/ai/flow4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'honesty',
          tier: selectedScenario.tier,
          priceUsd: selectedScenario.price_usd,
          customerProfile,
          answer: honestyAnswer.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Failed to evaluate');

      setHonestyVerdict(data);
      await saveDraft({
        honesty_answer: honestyAnswer.trim(),
        honesty_verdict: data,
      });

      if (data.verdict === 'HONEST') {
        setState('MARGIN_PREVIEW');
      } else {
        setState('CONTRADICTED');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to evaluate honesty');
      setState('HONESTY_GATE');
    }
  };

  const handleInsistDespiteContradiction = () => {
    setInsistedDespiteContradiction(true);
    setPenalty(5);
    setState('MARGIN_PREVIEW');
    saveDraft({ penalty: 5, insisted_despite_contradiction: true });
  };

  const handleLowerTier = () => {
    const rec = honestyVerdict?.recommended_tier;
    const lower = scenarios.find(
      (s) => s.tier.toUpperCase() === (rec ?? '').toUpperCase()
    );
    if (lower) {
      setSelectedScenario(lower);
      setHonestyVerdict(null);
      setHonestyAnswer('');
      setState('HONESTY_GATE');
    } else {
      setState('SELECTION');
      setSelectedScenario(null);
      setHonestyVerdict(null);
    }
  };

  const handleLockConfirm = async () => {
    setConfirmLockOpen(false);
    if (!selectedScenario) return;
    setLoading(true);
    setError(null);

    const costPoints = [0.2, 0.3, 0.4];
    const marginPreview = costPoints.map((costPct) => {
      const cost = selectedScenario.price_usd * costPct;
      const marginPct = (1 - costPct) * 100;
      return {
        cost_pct: costPct * 100,
        cost_usd: cost,
        margin_pct: marginPct,
        verdict: marginVerdict(marginPct),
      };
    });
    const maxCostForGo = selectedScenario.price_usd * 0.5;

    try {
      const res = await fetch('/api/flows/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          flowNumber: 4,
          data: {
            committed_price_usd: selectedScenario.price_usd,
            committed_price_lak: selectedScenario.price_lak,
            committed_tier: selectedScenario.tier,
            honesty_verdict: honestyVerdict,
            margin_preview: marginPreview,
            max_cost_for_go: maxCostForGo,
            penalty: insistedDespiteContradiction ? 5 : 0,
            scenarios,
          },
          penalty: insistedDespiteContradiction ? 5 : 0,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }

      showToast('Flow 4 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock flow');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePrice = () => {
    setState('SELECTION');
    setSelectedScenario(null);
    setHonestyAnswer('');
    setHonestyVerdict(null);
  };

  const marginPreview =
    selectedScenario
      ? [0.2, 0.3, 0.4].map((costPct) => {
          const marginPct = (1 - costPct) * 100;
          return {
            cost_pct: costPct * 100,
            cost_usd: (selectedScenario!.price_usd * costPct).toFixed(2),
            margin_pct: marginPct,
            verdict: marginVerdict(marginPct),
          };
        })
      : [];
  const maxCostForGo = selectedScenario ? selectedScenario.price_usd * 0.5 : 0;

  if (isLocked || state === 'LOCKED') {
    const lockedData = (initialData ?? {}) as Record<string, unknown>;
    const price = (lockedData.committed_price_usd as number) ?? selectedScenario?.price_usd;
    const tier = (lockedData.committed_tier as string) ?? selectedScenario?.tier;
    const lockedPenalty = (lockedData.penalty as number) ?? penalty;
    const margin = (lockedData.margin_preview as typeof marginPreview) ?? marginPreview;
    const maxCost = (lockedData.max_cost_for_go as number) ?? maxCostForGo;

    return (
      <FlowContainer
        flowNumber={4}
        flowTitle="Flow 4: Willingness to Pay"
        flowDescription="Stress-test whether the customer will actually pay the chosen price."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-emerald-900">Price committed</p>
              <p className="mt-2 text-xl font-semibold text-slate-900">
                ${price} USD
              </p>
              <p className="text-sm text-slate-600">{tier}</p>
              {margin?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    Margin expectations
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Max product cost for viability: ${maxCost.toFixed(2)}
                  </p>
                </div>
              )}
              {lockedPenalty > 0 && (
                <p className="mt-2 text-sm text-amber-600">
                  -{lockedPenalty} penalty applied (insisted despite contradiction)
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/products/${productId}/flow5`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)' }}
          >
            Continue to Flow 5 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={4}
      flowTitle="Flow 4: Willingness to Pay"
      flowDescription="Stress-test whether the customer will actually pay the chosen price."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'AI_SCENARIOS' && (
          <div className="flow-transition-enter-active">
            {error ? (
              <ApiErrorMessage onTryAgain={fetchScenarios} />
            ) : (
              <LoadingSpinner message="Generating price scenarios..." />
            )}
          </div>
        )}

        {state === 'SELECTION' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Pick a price tier. COD customers can reject at the door — choose
                carefully.
              </p>
              <button
                onClick={() => setShowResearchChecklist(!showResearchChecklist)}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                {showResearchChecklist ? 'Hide' : 'I need to research prices first'}
              </button>
            </div>

            {showResearchChecklist && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-amber-900">Research checklist</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
                  <li>Check TikTok Shop for similar products</li>
                  <li>Check Shopee for comparable prices</li>
                  <li>Ask 3 people in your target market what they&apos;d pay</li>
                </ul>
                <button
                  onClick={() => setShowResearchChecklist(false)}
                  className="mt-3 text-sm font-medium text-amber-700 underline"
                >
                  I&apos;ve done my research — show scenarios
                </button>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {scenarios.map((s) => (
                <button
                  key={s.tier}
                  onClick={() => handleSelectScenario(s)}
                  className="rounded-lg border-2 border-slate-200 p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
                >
                  <p className="font-semibold text-slate-900">{s.tier}</p>
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    ${s.price_usd} USD
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.price_lak.toLocaleString()} LAK
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Why this price
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">{s.logic}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    COD cancel risk
                  </p>
                  <p className="mt-0.5 text-sm text-amber-700">
                    {s.cod_cancel_risk_percent}%
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    Who buys
                  </p>
                  <p className="mt-0.5 text-sm text-slate-700">
                    {s.who_buys_description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {state === 'HONESTY_GATE' && selectedScenario && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">
                You picked: {selectedScenario.tier} at $
                {selectedScenario.price_usd}
              </p>
            </div>
            <p className="font-medium text-slate-900">
              {selectedScenario.honesty_question ||
                `If your customer saw this next to a competitor for less, would they still choose yours at $${selectedScenario.price_usd}?`}
            </p>
            <textarea
              value={honestyAnswer}
              onChange={(e) => setHonestyAnswer(e.target.value)}
              placeholder="Your honest answer (min 20 chars)..."
              rows={4}
              className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              minLength={20}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {honestyAnswer.length} chars (min 20)
              </span>
              <button
                onClick={handleHonestySubmit}
                disabled={honestyAnswer.trim().length < 20}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Submit answer
              </button>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleHonestySubmit} />}
          </div>
        )}

        {state === 'HONESTY_EVALUATING' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <LoadingSpinner message="Evaluating honesty..." />
          </div>
        )}

        {state === 'CONTRADICTED' && honestyVerdict && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            {/* Big verdict badge */}
            <div
              className="rounded-[20px] px-10 py-4 mb-4 border-2"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444',
              }}
            >
              <span style={{ fontSize: '32px', display: 'inline-block', marginRight: '12px' }}>⚠️</span>
              <span
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '28px',
                  fontWeight: 800,
                  color: '#ef4444',
                }}
              >
                CONTRADICTED
              </span>
            </div>

            {/* ONE sentence */}
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
              {honestyVerdict.contradiction?.split('.').filter(s => s.trim())[0]?.trim() || 'Your answer doesn\'t align with your pricing choice.'}
            </p>

            {/* PRIMARY BUTTONS */}
            <div className="space-y-3 w-full max-w-[360px]">
              {honestyVerdict.recommended_tier && (
                <button
                  onClick={handleLowerTier}
                  className="w-full h-14 rounded-[14px] border-none cursor-pointer font-semibold text-base"
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    fontFamily: 'Space Grotesk, sans-serif',
                  }}
                >
                  ✅ Switch to {honestyVerdict.recommended_tier}
                </button>
              )}
              <button
                onClick={handleInsistDespiteContradiction}
                className="w-full h-12 rounded-[12px] border cursor-pointer text-sm font-medium"
                style={{
                  background: 'transparent',
                  borderColor: '#f59e0b',
                  color: '#f59e0b',
                }}
              >
                I insist on this price (-5 penalty)
              </button>
              <button
                onClick={handleChangePrice}
                className="w-full h-12 rounded-[12px] border cursor-pointer text-sm font-medium"
                style={{
                  background: 'transparent',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                Go back and choose a different tier
              </button>
            </div>

            {/* SECONDARY — expand details */}
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full max-w-[360px] h-12 rounded-[12px] border cursor-pointer mb-2 text-sm font-medium mt-4"
              style={{
                background: 'transparent',
                borderColor: 'var(--border)',
                borderWidth: '1.5px',
                color: 'var(--text-secondary)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              🔍 {showDetails ? 'Hide pricing analysis' : 'Show pricing analysis'}
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
                    💡 Pricing Analysis
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
                    {honestyVerdict.contradiction || 'Your answer doesn\'t align with your pricing choice.'}
                  </p>
                  {honestyVerdict.recommended_tier && (
                    <p
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontSize: '14px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <strong>Recommended tier:</strong> {honestyVerdict.recommended_tier}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'MARGIN_PREVIEW' && selectedScenario && (
          <div className="space-y-6">
            <p className="text-sm font-medium text-slate-700">
              Unit economics at ${selectedScenario.price_usd} selling price
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 rounded-lg border border-slate-200">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                      Cost (% of price)
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                      Margin
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                      Verdict
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {marginPreview.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {row.cost_pct}% (${row.cost_usd})
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-700">
                        {row.margin_pct}%
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            row.verdict === 'Strong'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.verdict === 'Viable'
                                ? 'bg-emerald-50 text-emerald-700'
                                : row.verdict === 'Tight'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {row.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">
                Max product cost for viability: ${maxCostForGo.toFixed(2)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Keep your product cost below this to maintain viable margins.
              </p>
            </div>
            {(() => {
              const maxMarginPct = marginPreview.length
                ? Math.max(...marginPreview.map((r) => r.margin_pct))
                : 0;
              const noViableMargin = maxMarginPct < 30;
              if (noViableMargin) {
                return (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="font-medium text-red-900">No viable margin</p>
                      <p className="mt-1 text-sm text-red-700">
                        Best margin is under 30%. Consider killing this product or choosing a different price.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href={`/products/${productId}/killed`}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        Kill product
                      </Link>
                      <button
                        onClick={() => setState('SELECTION')}
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Choose different price
                      </button>
                    </div>
                  </div>
                );
              }
              return (
                <div className="flex gap-3">
                  <button
                    onClick={() => setState('CONFIRM')}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Continue to confirm
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {state === 'CONFIRM' && selectedScenario && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Committed price
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                ${selectedScenario.price_usd} USD ({selectedScenario.tier})
              </p>
              <p className="text-sm text-slate-600">
                {selectedScenario.price_lak.toLocaleString()} LAK
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Honesty verdict
              </p>
              <p
                className={`mt-1 inline-block rounded px-2.5 py-1 text-sm font-semibold ${
                  honestyVerdict?.verdict === 'HONEST'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {honestyVerdict?.verdict ?? (insistedDespiteContradiction ? 'CONTRADICTED (insisted)' : 'HONEST')}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Max product cost for viability: ${maxCostForGo.toFixed(2)}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmLockOpen(true)}
                disabled={loading}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Locking…' : 'LOCK'}
              </button>
              <button
                onClick={handleChangePrice}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CHANGE PRICE
              </button>
              <Link
                href={`/products/${productId}`}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                KILL PRODUCT
              </Link>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleLockConfirm} />}
          </div>
        )}

        <ConfirmModal
          open={confirmLockOpen}
          title="Lock committed price?"
          confirmLabel="Lock"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmLockOpen(false)}
        >
          <p className="text-sm">
            You won&apos;t be able to change this price without overriding.
          </p>
        </ConfirmModal>
      </div>
    </FlowContainer>
  );
}
