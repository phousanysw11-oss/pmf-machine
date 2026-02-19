'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import Link from 'next/link';
import { FlowContainer } from '@/components/flows/FlowContainer';
import {
  getChecklistForChannel,
  type ChecklistItem,
  type GapType,
} from './channelChecklists';

type FlowState =
  | 'GATE_CHECK'
  | 'AI_ANALYSIS'
  | 'SELECTION'
  | 'CAPABILITY_CHECK'
  | 'CAPABILITY_RESULT'
  | 'CUMULATIVE_DISPLAY'
  | 'CONFIRM'
  | 'LOCKED';

type RecommendedChannel = {
  channel_name: string;
  fit_score: number;
  why: string;
  format_required: string;
  minimum_daily_budget_usd: number;
  capabilities_needed: string;
  main_risk: string;
};

type WeakChannel = {
  channel_name: string;
  reason_why_weak: string;
};

type Flow5ClientProps = {
  productId: string;
  productName: string;
  painText: string;
  customerSummary: string;
  solutionDescription: string;
  priceUsd: number;
  maxCostUsd: number;
  upstreamPenalty: number;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow5Client({
  productId,
  productName,
  painText,
  customerSummary,
  solutionDescription,
  priceUsd,
  maxCostUsd,
  upstreamPenalty,
  initialData,
  isLocked,
}: Flow5ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    isLocked ? 'LOCKED' : (initialData?.state as FlowState) ?? 'AI_ANALYSIS'
  );
  const [recommended, setRecommended] = useState<RecommendedChannel[]>(
    (initialData?.recommended as RecommendedChannel[]) ?? []
  );
  const [weak, setWeak] = useState<WeakChannel[]>(
    (initialData?.weak as WeakChannel[]) ?? []
  );
  const [channelRiskSummary, setChannelRiskSummary] = useState(
    (initialData?.channel_risk_summary as string) ?? ''
  );
  const [primaryChannel, setPrimaryChannel] = useState<RecommendedChannel | WeakChannel | null>(
    null
  );
  const [secondaryChannel, setSecondaryChannel] = useState<string | null>(null);
  const [pickedFromWeak, setPickedFromWeak] = useState(false);
  const [weakPickReason, setWeakPickReason] = useState('');
  const [flow5Penalty, setFlow5Penalty] = useState(
    (initialData?.picked_from_weak as boolean) ? 3 : 0
  );
  const [capabilityAnswers, setCapabilityAnswers] = useState<Record<string, boolean>>({});
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLockOpen, setConfirmLockOpen] = useState(false);
  const { showToast } = useToast();

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 5,
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

  const fetchRecommendations = useCallback(async () => {
    setState('AI_ANALYSIS');
    setError(null);

    try {
      const res = await fetch('/api/ai/flow5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recommendations',
          customerProfile: { who: customerSummary },
          solutionDescription,
          priceUsd,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');

      setRecommended(data.recommended ?? []);
      setWeak(data.weak ?? []);
      setChannelRiskSummary(data.channel_risk_summary ?? '');
      await saveDraft({
        recommended: data.recommended,
        weak: data.weak,
        channel_risk_summary: data.channel_risk_summary,
      });
      setState('SELECTION');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate channel recommendations');
      setState('AI_ANALYSIS');
    }
  }, [customerSummary, solutionDescription, priceUsd, saveDraft]);

  useEffect(() => {
    if (isLocked) return;
    if (recommended.length > 0) {
      setState((s) => (s === 'AI_ANALYSIS' ? 'SELECTION' : s));
      return;
    }
    fetchRecommendations();
  }, [isLocked, recommended.length, fetchRecommendations]);

  const handleSelectPrimary = (ch: RecommendedChannel | WeakChannel, isWeak: boolean) => {
    setPrimaryChannel(ch);
    setPickedFromWeak(isWeak);
    if (isWeak) {
      setFlow5Penalty(3);
      setState('SELECTION');
      saveDraft({ primary_channel: ch.channel_name, picked_from_weak: true, cumulative_penalty: 3 });
    } else {
      setState('CAPABILITY_CHECK');
      const checklist = getChecklistForChannel(ch.channel_name);
      setCapabilityAnswers(
        Object.fromEntries(checklist.map((item) => [item.id, false]))
      );
      saveDraft({
        primary_channel: ch.channel_name,
        primary_channel_data: ch,
        picked_from_weak: false,
      });
    }
  };

  const handleWeakPickConfirm = () => {
    if (weakPickReason.trim().length < 20) return;
    setState('CAPABILITY_CHECK');
    const ch = primaryChannel!;
    const checklist = getChecklistForChannel(ch.channel_name);
    setCapabilityAnswers(
      Object.fromEntries(checklist.map((item) => [item.id, false]))
    );
    saveDraft({
      weak_pick_reason: weakPickReason.trim(),
      cumulative_penalty: 3,
    });
  };

  const checklist = primaryChannel
    ? getChecklistForChannel(primaryChannel.channel_name)
    : [];
  const allYes = checklist.length > 0 && checklist.every((item) => capabilityAnswers[item.id]);
  const noItems = checklist.filter((item) => !capabilityAnswers[item.id]);
  const gapGroups = noItems.reduce<Record<GapType, ChecklistItem[]>>(
    (acc, item) => {
      if (!acc[item.gapType]) acc[item.gapType] = [];
      acc[item.gapType].push(item);
      return acc;
    },
    { FIXABLE_FAST: [], FIXABLE_SLOW: [], HARD_BLOCKER: [] }
  );

  const handleCapabilitySubmit = () => {
    if (allYes) {
      setState('CUMULATIVE_DISPLAY');
      saveDraft({ capability_status: 'CAPABLE', capability_answers: capabilityAnswers });
    } else {
      setState('CAPABILITY_RESULT');
      saveDraft({
        capability_status: 'GAPS',
        capability_answers: capabilityAnswers,
        gaps: noItems.map((i) => ({ id: i.id, label: i.label, gapType: i.gapType })),
      });
    }
  };

  const handleProceedAnyway = () => {
    setProceedAnyway(true);
    setState('CUMULATIVE_DISPLAY');
    saveDraft({ proceed_anyway: true, capability_status: 'GAPS_PROCEEDED' });
  };

  const totalPenalty = upstreamPenalty + flow5Penalty;
  const maxPmf = Math.max(0, 100 - totalPenalty);
  const cannotAchievePmf = maxPmf < 70;

  const formatRequired =
    primaryChannel && 'format_required' in primaryChannel
      ? (primaryChannel as RecommendedChannel).format_required
      : 'chosen format';
  const scoutingBrief = `Find product that solves ${painText} for ${customerSummary}, differentiated by ${solutionDescription}, sells at ~$${priceUsd} (max cost $${maxCostUsd.toFixed(2)}), tested on ${primaryChannel?.channel_name ?? 'channel'} using ${formatRequired}.`;

  const handleLockConfirm = async () => {
    setConfirmLockOpen(false);
    setLoading(true);
    setError(null);

    const payload = {
      primary_channel: primaryChannel?.channel_name,
      secondary_channel: secondaryChannel,
      capability_status: allYes ? 'CAPABLE' : proceedAnyway ? 'GAPS_PROCEEDED' : 'GAPS',
      gaps: noItems.map((i) => ({ id: i.id, label: i.label, gapType: i.gapType })),
      cumulative_penalty: totalPenalty,
      scouting_brief: scoutingBrief,
      picked_from_weak: pickedFromWeak,
      weak_pick_reason: pickedFromWeak ? weakPickReason : undefined,
    };

    try {
      const res = await fetch('/api/flows/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          flowNumber: 5,
          data: payload,
          penalty: 0,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }

      showToast('Flow 5 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock flow');
    } finally {
      setLoading(false);
    }
  };

  if (isLocked || state === 'LOCKED') {
    const lockedData = (initialData ?? {}) as Record<string, unknown>;
    const brief =
      (lockedData.scouting_brief as string) ?? scoutingBrief;
    const capStatus = (lockedData.capability_status as string) ?? (allYes ? 'CAPABLE' : 'GAPS');
    const cumPenalty = (lockedData.cumulative_penalty as number) ?? totalPenalty;

    return (
      <FlowContainer
        flowNumber={5}
        flowTitle="Flow 5: Channel Reality Check"
        flowDescription="Match the channel to the customer and check execution capability."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6 space-y-6">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900">Channel locked</p>
              <p className="mt-2 text-slate-800">
                Primary: {(lockedData.primary_channel as string) ?? primaryChannel?.channel_name}
              </p>
              {lockedData.secondary_channel ? (
                <p className="text-slate-700">
                  Secondary: {String(lockedData.secondary_channel)}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-slate-600">
                Capability: {capStatus}
              </p>
              <p className="mt-2 text-sm text-amber-600">
                Combined penalty: -{cumPenalty} · Max PMF: {100 - cumPenalty}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Scouting Brief (for Step 1.1)
            </p>
            <p className="mt-2 text-slate-800">{brief}</p>
          </div>
          <Link
            href={`/products/${productId}/flow7`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)' }}
          >
            Continue to Flow 7 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={5}
      flowTitle="Flow 5: Channel Reality Check"
      flowDescription="Match the channel to the customer and check execution capability."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'AI_ANALYSIS' && (
          <div className="flow-transition-enter-active">
            {error ? (
              <ApiErrorMessage onTryAgain={fetchRecommendations} />
            ) : (
              <LoadingSpinner message="Analyzing channels..." />
            )}
          </div>
        )}

        {state === 'SELECTION' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Pick your primary channel (and optional secondary). Picking a weak
              channel adds -3 penalty.
            </p>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                Recommended
              </p>
              <div className="space-y-3">
                {recommended.map((r) => (
                  <button
                    key={r.channel_name}
                    onClick={() => handleSelectPrimary(r, false)}
                    className="w-full rounded-lg border-2 border-slate-200 p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">
                        {r.channel_name}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-sm font-medium text-emerald-800">
                        Fit {r.fit_score}/10
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{r.why}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Format: {r.format_required} · Min budget: $
                      {r.minimum_daily_budget_usd}/day
                    </p>
                    <p className="mt-1 text-xs text-amber-600">Risk: {r.main_risk}</p>
                  </button>
                ))}
              </div>
            </div>

            {weak.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Weak for this customer
                </p>
                <div className="space-y-3">
                  {weak.map((w) => (
                    <button
                      key={w.channel_name}
                      onClick={() => handleSelectPrimary(w, true)}
                      className="w-full rounded-lg border border-amber-200 bg-amber-50/50 p-4 text-left transition-colors hover:border-amber-300 hover:bg-amber-50"
                    >
                      <span className="font-medium text-amber-900">
                        {w.channel_name}
                      </span>
                      <p className="mt-1 text-sm text-amber-800">
                        {w.reason_why_weak}
                      </p>
                      <p className="mt-2 text-xs text-amber-700">
                        -3 penalty if selected
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {primaryChannel && pickedFromWeak && (
              <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
                <p className="font-medium text-amber-900">Mismatch warning</p>
                <p className="mt-1 text-sm text-amber-800">
                  You selected a channel marked weak for your customer. Add a
                  reason (min 20 chars) to proceed.
                </p>
                <textarea
                  value={weakPickReason}
                  onChange={(e) => setWeakPickReason(e.target.value)}
                  placeholder="Why this channel still makes sense..."
                  rows={2}
                  className="mt-3 block w-full rounded-lg border border-amber-300 px-3 py-2 text-slate-900"
                  minLength={20}
                />
                <p className="mt-1 text-xs text-amber-700">
                  {weakPickReason.length} chars (min 20)
                </p>
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleWeakPickConfirm}
                    disabled={weakPickReason.trim().length < 20}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Proceed (-3 penalty)
                  </button>
                  <button
                    onClick={() => {
                      setPrimaryChannel(null);
                      setPickedFromWeak(false);
                      setWeakPickReason('');
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Choose another channel
                  </button>
                </div>
              </div>
            )}

            {channelRiskSummary && !primaryChannel && (
              <p className="text-sm text-slate-500">{channelRiskSummary}</p>
            )}
          </div>
        )}

        {state === 'CAPABILITY_CHECK' && primaryChannel && (
          <div className="space-y-6">
            <p className="font-medium text-slate-900">
              Capability check: {primaryChannel.channel_name}
            </p>
            <div className="space-y-3">
              {checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={capabilityAnswers[item.id] ?? false}
                    onChange={(e) =>
                      setCapabilityAnswers((prev) => ({
                        ...prev,
                        [item.id]: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span className="text-sm text-slate-800">{item.label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleCapabilitySubmit}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Submit
            </button>
          </div>
        )}

        {state === 'CAPABILITY_RESULT' && (
          <div className="space-y-6">
            {allYes ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="font-semibold text-emerald-800">CAPABLE — proceed.</p>
                <button
                  onClick={() => {
                    setState('CUMULATIVE_DISPLAY');
                    saveDraft({ capability_status: 'CAPABLE' });
                  }}
                  className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Continue
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">Capability gaps</p>
                  {(['HARD_BLOCKER', 'FIXABLE_SLOW', 'FIXABLE_FAST'] as const).map(
                    (gapType) =>
                      gapGroups[gapType]?.length > 0 && (
                        <div key={gapType} className="mt-3">
                          <p className="text-xs font-semibold uppercase text-amber-700">
                            {gapType.replace('_', ' ')}
                          </p>
                          <ul className="mt-1 list-inside list-disc text-sm text-amber-900">
                            {gapGroups[gapType].map((i) => (
                              <li key={i.id}>{i.label}</li>
                            ))}
                          </ul>
                        </div>
                      )
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setState('CAPABILITY_CHECK')}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Resolve gaps (show checklist)
                  </button>
                  <button
                    onClick={() => {
                      setPrimaryChannel(null);
                      setState('SELECTION');
                    }}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Switch channel
                  </button>
                  <button
                    onClick={handleProceedAnyway}
                    className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-left text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    Proceed anyway (risk flag)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {state === 'CUMULATIVE_DISPLAY' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-medium text-slate-900">Combined penalty: -{totalPenalty}</p>
              <p className="mt-1 text-slate-700">
                Max achievable PMF: {maxPmf}. PMF requires 70.
              </p>
            </div>
            {cannotAchievePmf && (
              <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-red-900">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  Current foundations cannot achieve PMF. Fix upstream flows.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setState('CONFIRM')}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Continue to confirm
              </button>
            </div>
          </div>
        )}

        {state === 'CONFIRM' && (
          <div className="space-y-6">
            <p className="text-slate-700">
              Primary: <strong>{primaryChannel?.channel_name}</strong>
              {secondaryChannel && (
                <> · Secondary: <strong>{secondaryChannel}</strong></>
              )}
            </p>
            <p className="text-sm text-slate-600">
              Combined penalty: -{totalPenalty} · Max PMF: {maxPmf}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmLockOpen(true)}
                disabled={loading}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Locking…' : 'LOCK'}
              </button>
              <button
                onClick={() => {
                  setPrimaryChannel(null);
                  setState('SELECTION');
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CHANGE CHANNEL
              </button>
              <Link
                href={`/products/${productId}`}
                className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
              >
                FIX UPSTREAM
              </Link>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleLockConfirm} />}
          </div>
        )}

        <ConfirmModal
          open={confirmLockOpen}
          title="Lock channel choice?"
          confirmLabel="Lock"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmLockOpen(false)}
        >
          <p className="text-sm">
            You won&apos;t be able to change this channel without overriding.
          </p>
        </ConfirmModal>
      </div>
    </FlowContainer>
  );
}
