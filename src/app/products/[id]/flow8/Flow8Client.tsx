'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { useToast } from '@/components/ui/Toast';

type Variant = {
  label: string;
  angle: string;
  primary_text: string;
  headline: string;
  cta: string;
};

type ChecklistItem = {
  step: number;
  action: string;
  time_estimate: string;
  details: string;
};

type FlowState =
  | 'GATE_CHECK'
  | 'AI_DRAFTING'
  | 'SELECTION'
  | 'CHECKLIST'
  | 'LOCKED';

type Flow8ClientProps = {
  productId: string;
  productName: string;
  painText: string;
  customerSummary: string;
  solutionDescription: string;
  priceUsd: number;
  channelName: string;
  experimentHypothesis: string;
  experimentId: string;
  hasActiveExperiment: boolean;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow8Client({
  productId,
  productName,
  priceUsd,
  channelName,
  experimentId,
  hasActiveExperiment,
  initialData,
  isLocked,
}: Flow8ClientProps) {
  const router = useRouter();
  const { showToast } = useToast();

  const [state, setState] = useState<FlowState>(() => {
    if (isLocked) return 'LOCKED';
    if (!hasActiveExperiment) return 'GATE_CHECK';
    const saved = initialData?.state as FlowState | undefined;
    if (saved && ['SELECTION', 'CHECKLIST', 'LOCKED'].includes(saved)) return saved;
    const hasVariants = Array.isArray(initialData?.variants) && (initialData.variants as unknown[]).length >= 3;
    return hasVariants ? 'SELECTION' : 'AI_DRAFTING';
  });

  const [variants, setVariants] = useState<Variant[]>(
    (initialData?.variants as Variant[]) ?? []
  );
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(
    (initialData?.selected_variant as Variant) ?? null
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    (initialData?.checklist as ChecklistItem[]) ?? []
  );
  const [imageDirection, setImageDirection] = useState<string>(
    String(initialData?.image_direction ?? '')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checklistChecked, setChecklistChecked] = useState<Record<number, boolean>>({});

  const saveDraft = useCallback(
    async (data: Record<string, unknown>) => {
      try {
        await fetch('/api/flows/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            flowNumber: 8,
            data: {
              ...initialData,
              ...data,
              state,
            },
          }),
        });
      } catch {
        // non-blocking
      }
    },
    [productId, initialData, state]
  );

  useEffect(() => {
    if (!hasActiveExperiment || isLocked) return;
    if (state === 'AI_DRAFTING' && variants.length === 0 && !loading) {
      setLoading(true);
      setError(null);
      (async () => {
        try {
          const res = await fetch('/api/ai/flow8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error ?? 'Invalid response');
          }
          if (!data.variants || data.variants.length < 3) {
            throw new Error(data.error ?? 'Invalid response: expected 3 variants');
          }
          setVariants(data.variants);
          setChecklist(Array.isArray(data.checklist) ? data.checklist : []);
          setImageDirection(String(data.image_direction ?? ''));
          setState('SELECTION');
          saveDraft({
            variants: data.variants,
            checklist: data.checklist ?? [],
            image_direction: data.image_direction,
            state: 'SELECTION',
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed to generate assets');
          setState('AI_DRAFTING');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [hasActiveExperiment, isLocked, productId, state, variants.length, loading, saveDraft]);

  const handleUseThisOne = useCallback(
    async (v: Variant) => {
      setSelectedVariant(v);
      setState('CHECKLIST');
      await saveDraft({ selected_variant: v, state: 'CHECKLIST' });
    },
    [saveDraft]
  );

  const handleToggleCheck = useCallback((step: number) => {
    setChecklistChecked((prev) => ({ ...prev, [step]: !prev[step] }));
  }, []);

  const handleReadyToLaunch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/flows/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          flowNumber: 8,
          data: {
            variants,
            selected_variant: selectedVariant,
            checklist,
            image_direction: imageDirection,
            state: 'LOCKED',
          },
          penalty: 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }
      showToast('Flow 8 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to lock');
    } finally {
      setLoading(false);
    }
  }, [productId, variants, selectedVariant, checklist, imageDirection, showToast, router]);

  if (!hasActiveExperiment && state === 'GATE_CHECK') {
    return (
      <FlowContainer
        flowNumber={8}
        flowTitle="Flow 8: Execution Assets"
        flowDescription="Ad copy variants and launch checklist."
        productId={productId}
        productName={productName}
        isLocked={false}
        stateIndicator="GATE_CHECK"
      >
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <p className="font-medium text-[var(--text)] mb-2">Start an experiment in Flow 7 first</p>
          <p className="text-[var(--text-secondary)] mb-6">
            Flow 8 requires an active experiment. Create one in Flow 7, then return here.
          </p>
          <Link
            href={`/products/${productId}/flow7`}
            className="inline-flex rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--amber)' }}
          >
            Go to Flow 7
          </Link>
        </div>
      </FlowContainer>
    );
  }

  if (isLocked || state === 'LOCKED') {
    const lockedVariant = (initialData?.selected_variant as Variant) ?? selectedVariant;
    const lockedChecklist = (initialData?.checklist as ChecklistItem[]) ?? checklist;
    return (
      <FlowContainer
        flowNumber={8}
        flowTitle="Flow 8: Execution Assets"
        flowDescription="Ad copy variants and launch checklist."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6 space-y-6">
          <div
            className="rounded-xl border p-4"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Selected variant
            </p>
            {lockedVariant && (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {lockedVariant.label}: {lockedVariant.angle}
                </p>
                <p className="mt-1 text-sm font-medium text-[var(--cyan)]">{lockedVariant.headline}</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
                  {lockedVariant.primary_text}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">CTA: {lockedVariant.cta}</p>
              </>
            )}
          </div>
          {lockedChecklist.length > 0 && (
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Launch checklist
              </p>
              <ul className="space-y-2">
                {lockedChecklist.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-[var(--text-secondary)]"
                  >
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-[var(--green)]" />
                    <span>
                      <strong className="text-[var(--text)]">{item.action}</strong>
                      {item.time_estimate && (
                        <span className="text-[var(--text-muted)] ml-1">({item.time_estimate})</span>
                      )}
                      {item.details && (
                        <p className="text-[var(--text-muted)] text-xs mt-0.5">{item.details}</p>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href={`/products/${productId}/flow6?experimentId=${experimentId}`}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)', color: 'var(--bg)' }}
          >
            Go to Flow 6 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={8}
      flowTitle="Flow 8: Execution Assets"
      flowDescription="Ad copy variants and launch checklist."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6 space-y-6">
        {state === 'AI_DRAFTING' && (
          <div className="flow-transition-enter-active">
            {error ? (
              <ApiErrorMessage
                onTryAgain={() => {
                  setError(null);
                  setState('AI_DRAFTING');
                  setVariants([]);
                }}
              />
            ) : (
              <>
                <div className="flex flex-col items-center justify-center min-h-[40vh]">
                  <LoadingSpinner message="Generating 3 ad variants and checklist..." />
                </div>
                <div className="animate-pulse space-y-4 max-w-lg mx-auto mt-8">
                  <div className="h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)]" />
                  <div className="h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)]" />
                  <div className="h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)]" />
                </div>
              </>
            )}
          </div>
        )}

        {state === 'SELECTION' && variants.length >= 3 && (
          <div className="space-y-6">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              Choose one variant. Price (${priceUsd}) is included in every option.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {variants.map((v, i) => (
                <div
                  key={i}
                  className="rounded-xl border p-4 text-left transition"
                  style={{
                    background: 'var(--surface)',
                    borderColor: selectedVariant?.label === v.label ? 'var(--cyan)' : 'var(--border)',
                  }}
                >
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {v.label}: {v.angle}
                  </p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text)]">{v.headline}</p>
                  <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-4 whitespace-pre-wrap">
                    {v.primary_text}
                  </p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">CTA: {v.cta}</p>
                  <button
                    type="button"
                    onClick={() => handleUseThisOne(v)}
                    className="mt-4 w-full rounded-lg py-2.5 text-sm font-semibold text-white"
                    style={{ background: 'var(--cyan)', color: 'var(--bg)' }}
                  >
                    Use this one
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {state === 'CHECKLIST' && selectedVariant && (
          <div className="space-y-6">
            <div
              className="rounded-xl border p-4"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Selected: {selectedVariant.label} — {selectedVariant.angle}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{selectedVariant.headline}</p>
            </div>

            <h3
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Launch checklist
            </h3>
            <ul className="space-y-3">
              {checklist.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border p-3"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleCheck(item.step)}
                    className="shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5"
                    style={{
                      borderColor: checklistChecked[item.step] ? 'var(--green)' : 'var(--border)',
                      background: checklistChecked[item.step] ? 'var(--green)' : 'transparent',
                    }}
                  >
                    {checklistChecked[item.step] && <Check className="h-3 w-3 text-[var(--bg)]" />}
                  </button>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {item.step}. {item.action}
                      {item.time_estimate && (
                        <span className="text-[var(--text-muted)] font-normal ml-1">
                          ({item.time_estimate})
                        </span>
                      )}
                    </p>
                    {item.details && (
                      <p className="text-xs text-[var(--text-muted)] mt-1">{item.details}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div
              className="rounded-xl border p-4"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
              }}
            >
              <p className="text-sm font-medium text-[var(--red)]">
                ⚠️ Kill condition reminder: If your experiment hits the kill condition (e.g. at 24h), stop and interpret in Flow 9. Do not scale.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReadyToLaunch}
              disabled={loading}
              className="w-full max-w-md mx-auto flex items-center justify-center gap-2 rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--green)', color: 'var(--bg)' }}
            >
              <Check className="h-5 w-5" />
              Ready to launch ✅
            </button>
            {error && (
              <p className="text-sm text-[var(--red)]">{error}</p>
            )}
          </div>
        )}
      </div>
    </FlowContainer>
  );
}
