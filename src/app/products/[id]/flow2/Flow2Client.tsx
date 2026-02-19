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
  | 'AI_GENERATING'
  | 'SELECTION'
  | 'CONFIDENCE'
  | 'CONFIRM'
  | 'LOCKED';

type Profile = {
  rank: number;
  who: string;
  why_worst: string;
  how_to_reach: string;
  budget_estimate: string;
};

type CustomerProfile =
  | (Profile & { source: 'ai' })
  | { source: 'custom'; custom_text: string };

type ConfidenceOption = 'sold_before' | 'talked_to' | 'guess';

type Flow2ClientProps = {
  productId: string;
  productName: string;
  painText: string;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow2Client({
  productId,
  productName,
  painText,
  initialData,
  isLocked,
}: Flow2ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    isLocked ? 'LOCKED' : (initialData?.state as FlowState) ?? 'AI_GENERATING'
  );
  const [profiles, setProfiles] = useState<Profile[]>(
    (initialData?.profiles as Profile[]) ?? []
  );
  const [selectedProfile, setSelectedProfile] = useState<CustomerProfile | null>(
    (initialData?.customer_profile as CustomerProfile) ?? null
  );
  const [customText, setCustomText] = useState('');
  const [confidence, setConfidence] = useState<ConfidenceOption | null>(
    (initialData?.confidence as ConfidenceOption) ?? null
  );
  const [wasGuessed, setWasGuessed] = useState(
    (initialData?.was_guessed as boolean) ?? false
  );
  const [penalty, setPenalty] = useState((initialData?.penalty as number) ?? 0);
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
            flowNumber: 2,
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

  const fetchProfiles = useCallback(async () => {
    setState('AI_GENERATING');
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/flow2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ painText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');
      setProfiles(data.profiles ?? []);
      await saveDraft({ profiles: data.profiles });
      setState('SELECTION');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate customer profiles');
      setState('AI_GENERATING');
    } finally {
      setLoading(false);
    }
  }, [painText, saveDraft]);

  useEffect(() => {
    if (isLocked) return;
    // Only sync to SELECTION when we have profiles and are still in loading state
    // (e.g. initial load from cached data). Do NOT reset to SELECTION when user
    // has already advanced to CONFIDENCE/CONFIRM — that was causing the button to "do nothing".
    if (profiles.length > 0 && state === 'AI_GENERATING') {
      setState('SELECTION');
      return;
    }
    if (painText && profiles.length === 0) {
      fetchProfiles();
    }
  }, [isLocked, painText, profiles.length, state, fetchProfiles]);

  const handleSelectProfile = (profile: Profile) => {
    setSelectedProfile({ ...profile, source: 'ai' });
    setState('CONFIDENCE');
    saveDraft({ customer_profile: { ...profile, source: 'ai' } });
  };

  const handleCustomSubmit = () => {
    if (customText.trim().length < 20) return;
    const profile: CustomerProfile = { source: 'custom', custom_text: customText.trim() };
    setSelectedProfile(profile);
    setState('CONFIDENCE');
    saveDraft({ customer_profile: profile });
  };

  const handleConfidence = (opt: ConfidenceOption) => {
    const guess = opt === 'guess';
    setConfidence(opt);
    setWasGuessed(guess);
    if (guess) {
      setPenalty(3);
      setState('CONFIDENCE');
    } else {
      setPenalty(0);
      saveDraft({
        customer_profile: selectedProfile,
        confidence: opt,
        was_guessed: false,
        source: selectedProfile?.source ?? 'ai',
      });
      setState('CONFIRM');
    }
  };

  const handleAcceptGuess = async () => {
    await saveDraft({
      customer_profile: selectedProfile,
      confidence: 'guess',
      was_guessed: true,
      penalty: 3,
      source: selectedProfile?.source ?? 'ai',
    });
    setState('CONFIRM');
  };

  const handleGetEvidence = () => {
    setState('SELECTION');
    setSelectedProfile(null);
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
          flowNumber: 2,
          data: {
            customer_profile: selectedProfile,
            confidence,
            was_guessed: wasGuessed,
            source: selectedProfile?.source ?? 'ai',
            penalty: wasGuessed ? 3 : 0,
            profiles,
          },
          penalty: wasGuessed ? 3 : 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }
      showToast('Flow 2 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock flow');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setState('SELECTION');
    setSelectedProfile(null);
  };

  const handleBack = () => {
    setState('SELECTION');
    setSelectedProfile(null);
  };

  const renderProfileCard = (profile: Profile, label: string) => {
    const isSelected =
      selectedProfile?.source === 'ai' &&
      selectedProfile.rank === profile.rank;
    return (
      <div
        key={profile.rank}
        className={`rounded-lg border-2 p-4 text-left transition-colors ${
          isSelected
            ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/30'
            : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rank {profile.rank}
          </span>
          {isSelected && (
            <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          )}
        </div>
        <p className="font-medium text-slate-900">{profile.who}</p>
        <p className="mt-1 text-xs uppercase text-slate-500">Why worst</p>
        <p className="mt-0.5 text-sm text-slate-700">{profile.why_worst}</p>
        <p className="mt-2 text-xs uppercase text-slate-500">How to reach</p>
        <p className="mt-0.5 text-sm text-slate-700">{profile.how_to_reach}</p>
        <p className="mt-2 text-xs uppercase text-slate-500">Budget estimate</p>
        <p className="mt-0.5 text-sm text-slate-700">{profile.budget_estimate}</p>
        <button
          type="button"
          onClick={() => handleSelectProfile(profile)}
          className="mt-4 w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          {label}
        </button>
      </div>
    );
  };

  if (isLocked || state === 'LOCKED') {
    const lockedData = (initialData ?? {}) as Record<string, unknown>;
    const profile = (lockedData.customer_profile as CustomerProfile) ?? selectedProfile;
    const lockedPenalty = (lockedData.penalty as number) ?? penalty;

    return (
      <FlowContainer
        flowNumber={2}
        flowTitle="Flow 2: Customer Clarity"
        flowDescription="Identify who has the pain worst."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6">
          <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-emerald-900">Customer profile locked</p>
              {profile && profile.source === 'custom' ? (
                <p className="mt-2 text-slate-700">{profile.custom_text}</p>
              ) : profile && profile.source === 'ai' ? (
                <div className="mt-2 space-y-2 text-slate-700">
                  <p><strong>Who:</strong> {profile.who}</p>
                  <p><strong>Why worst:</strong> {profile.why_worst}</p>
                  <p><strong>How to reach:</strong> {profile.how_to_reach}</p>
                  <p><strong>Budget:</strong> {profile.budget_estimate}</p>
                </div>
              ) : null}
              {lockedPenalty > 0 && (
                <p className="mt-2 text-sm text-amber-600">
                  -{lockedPenalty} penalty applied (guessed customer)
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/products/${productId}/flow3`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)' }}
          >
            Continue to Flow 3 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={2}
      flowTitle="Flow 2: Customer Clarity"
      flowDescription="Identify who has the pain worst."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'AI_GENERATING' && (
          <div className="flow-transition-enter-active">
            {error ? (
              <ApiErrorMessage onTryAgain={fetchProfiles} />
            ) : (
              <LoadingSpinner message="Generating customer profiles..." />
            )}
          </div>
        )}

        {state === 'SELECTION' && (
          <div className="space-y-6">
            <p className="text-sm text-slate-600">
              Select the customer profile that best matches who suffers most from
              this pain, or describe your own.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {profiles.map((p) =>
                renderProfileCard(p, 'This is my customer')
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
              <p className="mb-2 text-sm font-medium text-slate-700">
                None of these — I know my customer
              </p>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Describe your ideal customer (min 20 characters)..."
                rows={3}
                className="block w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="mt-1 block text-xs text-slate-500">
                {customText.length} characters (min 20)
              </span>
              <button
                type="button"
                onClick={handleCustomSubmit}
                disabled={customText.trim().length < 20}
                className="mt-3 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
              >
                Use my description
              </button>
            </div>
          </div>
        )}

        {state === 'CONFIDENCE' && (
          <div className="space-y-6">
            <p className="font-medium text-slate-900">
              How do you know this is the right customer?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleConfidence('sold_before')}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                I&apos;ve sold to them before
              </button>
              <button
                onClick={() => handleConfidence('talked_to')}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                I&apos;ve talked to them
              </button>
              <button
                onClick={() => handleConfidence('guess')}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                I&apos;m guessing
              </button>
            </div>

            {confidence === 'guess' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="flex items-center gap-2 font-medium text-amber-800">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  Guessed customer carries -3 penalty. Consider validating with
                  real customers first.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleAcceptGuess}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Accept guess
                  </button>
                  <button
                    onClick={handleGetEvidence}
                    className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100"
                  >
                    I&apos;ll get evidence first
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'CONFIRM' && selectedProfile && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Selected customer profile
              </p>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                {selectedProfile.source === 'custom' ? (
                  <p className="text-slate-900">{selectedProfile.custom_text}</p>
                ) : (
                  <div className="space-y-2 text-slate-900">
                    <p><strong>Who:</strong> {selectedProfile.who}</p>
                    <p><strong>Why worst:</strong> {selectedProfile.why_worst}</p>
                    <p><strong>How to reach:</strong> {selectedProfile.how_to_reach}</p>
                    <p><strong>Budget:</strong> {selectedProfile.budget_estimate}</p>
                  </div>
                )}
              </div>
            </div>
            <p className="font-medium text-slate-900">Lock this customer profile?</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmLockOpen(true)}
                disabled={loading}
                className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loading ? 'Locking…' : 'LOCK'}
              </button>
              <button
                onClick={handleEdit}
                disabled={loading}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                EDIT
              </button>
              <Link
                href={`/products/${productId}`}
                className="min-h-[44px] inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                BACK
              </Link>
            </div>
            {error && <ApiErrorMessage onTryAgain={handleLockConfirm} />}
          </div>
        )}

        <ConfirmModal
          open={confirmLockOpen}
          title="Lock customer profile?"
          confirmLabel="Lock"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmLockOpen(false)}
        >
          <p className="text-sm">
            You won&apos;t be able to change this profile without overriding.
          </p>
        </ConfirmModal>
      </div>
    </FlowContainer>
  );
}
