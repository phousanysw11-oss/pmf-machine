'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, AlertTriangle } from 'lucide-react';
import { FlowContainer } from '@/components/flows/FlowContainer';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApiErrorMessage } from '@/components/ui/ApiErrorMessage';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils';

type FlowState =
  | 'INITIAL'
  | 'AI_PROCESSING'
  | 'REVIEW'
  | 'CONFIDENCE'
  | 'CONFIRM'
  | 'LOCKED';

type Version = {
  text: string;
  angle: string;
  explanation: string;
};

type ConfidenceOption = 'customers' | 'observed' | 'guess';

type Flow1ClientProps = {
  productId: string;
  productName: string;
  initialData: Record<string, unknown> | null;
  isLocked: boolean;
};

export function Flow1Client({
  productId,
  productName,
  initialData,
  isLocked,
}: Flow1ClientProps) {
  const router = useRouter();
  const [state, setState] = useState<FlowState>(
    isLocked ? 'LOCKED' : (initialData?.state as FlowState) ?? 'INITIAL'
  );
  const [rawPain, setRawPain] = useState(
    (initialData?.raw_pain as string) ?? ''
  );
  const [versions, setVersions] = useState<Version[]>(
    (initialData?.versions as Version[]) ?? []
  );
  const [selectedText, setSelectedText] = useState(
    (initialData?.pain_text as string) ?? ''
  );
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
            flowNumber: 1,
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

  const handleSubmitRaw = async () => {
    if (rawPain.trim().length < 10) return;
    setState('AI_PROCESSING');
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/flow1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPain: rawPain.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate');
      setVersions(data.versions ?? []);
      await saveDraft({ raw_pain: rawPain, versions: data.versions });
      setState('REVIEW');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate versions');
      setState('INITIAL');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (text: string) => {
    setSelectedText(text);
    setState('CONFIDENCE');
    saveDraft({ pain_text: text });
  };

  const handleTryAgain = async () => {
    setError(null);
    setLoading(true);
    setState('AI_PROCESSING');
    try {
      const res = await fetch('/api/ai/flow1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawPain: rawPain.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.versions) {
        setError(data?.error ?? 'Failed to generate versions');
        setState('REVIEW');
        return;
      }
      setVersions(data.versions);
      setState('REVIEW');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate versions');
      setState('REVIEW');
    } finally {
      setLoading(false);
    }
  };

  const handleConfidence = async (opt: ConfidenceOption) => {
    const guess = opt === 'guess';
    setConfidence(opt);
    setWasGuessed(guess);
    if (guess) {
      setPenalty(5);
      setState('CONFIDENCE');
    } else {
      setPenalty(0);
      await saveDraft({
        pain_text: selectedText,
        confidence: opt,
        was_guessed: false,
      });
      setState('CONFIRM');
    }
  };

  const handleAcceptGuess = async () => {
    await saveDraft({
      pain_text: selectedText,
      confidence: 'guess',
      was_guessed: true,
      penalty: 5,
    });
    setState('CONFIRM');
  };

  const handleGetEvidence = () => {
    setState('REVIEW');
    setSelectedText('');
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
          flowNumber: 1,
          data: {
            pain_text: selectedText,
            confidence,
            was_guessed: wasGuessed,
            penalty: wasGuessed ? 5 : 0,
            raw_pain: rawPain,
            versions,
          },
          penalty: wasGuessed ? 5 : 0,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to lock');
      }
      showToast('Flow 1 locked ✓');
      setState('LOCKED');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lock flow');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setState('REVIEW');
    setSelectedText('');
  };

  const handleStartOver = () => {
    setRawPain('');
    setVersions([]);
    setSelectedText('');
    setConfidence(null);
    setWasGuessed(false);
    setPenalty(0);
    setState('INITIAL');
  };

  if (isLocked || state === 'LOCKED') {
    const lockedData = (initialData ?? {}) as Record<string, unknown>;
    const painText = (lockedData.pain_text as string) ?? selectedText;
    const lockedPenalty = (lockedData.penalty as number) ?? penalty;

    return (
      <FlowContainer
        flowNumber={1}
        flowTitle="Flow 1: Pain Rephrasing"
        flowDescription="Articulate your customer's real pain in clear, specific language."
        productId={productId}
        productName={productName}
        isLocked
        stateIndicator="LOCKED"
      >
        <div className="p-6">
          <div
            className="flex items-start gap-3 rounded-lg p-4"
            style={{
              backgroundColor: '#22c55e08',
              borderColor: '#22c55e22',
            }}
          >
            <Check className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#5cb87a' }} />
            <div>
              <p className="font-medium" style={{ color: '#5cb87a', fontFamily: 'var(--font-outfit)' }}>
                Pain statement locked
              </p>
              <p className="mt-2" style={{ color: 'var(--text)' }}>{painText}</p>
              {lockedPenalty > 0 && (
                <p className="mt-2 text-sm" style={{ color: '#f59e0b' }}>
                  -{lockedPenalty} penalty applied (guessed pain)
                </p>
              )}
            </div>
          </div>
          <Link
            href={`/products/${productId}/flow2`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: 'var(--cyan)' }}
          >
            Continue to Flow 2 →
          </Link>
        </div>
      </FlowContainer>
    );
  }

  return (
    <FlowContainer
      flowNumber={1}
      flowTitle="Flow 1: Pain Rephrasing"
      flowDescription="Articulate your customer's real pain in clear, specific language."
      productId={productId}
      productName={productName}
      isLocked={false}
      stateIndicator={state}
    >
      <div className="p-6">
        {state === 'INITIAL' && (
          <div className="space-y-4">
            <label className="block text-sm font-medium" style={{ color: 'var(--text2)' }}>
              Describe the problem your product solves. Use your customer&apos;s words.
            </label>
            <textarea
              value={rawPain}
              onChange={(e) => setRawPain(e.target.value)}
              placeholder="e.g. I hate waiting for delivery and not knowing when it arrives..."
              rows={4}
              className="block w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--bg)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
                fontSize: '13px',
                padding: '8px 10px',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#a855f7';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
              }}
              minLength={10}
            />
            <div className="flex items-center justify-between">
              <span
                className="text-sm"
                style={{
                  color: rawPain.length < 10 ? 'var(--text3)' : 'var(--text2)',
                }}
              >
                {rawPain.length} characters (min 10)
              </span>
              <button
                onClick={handleSubmitRaw}
                disabled={rawPain.trim().length < 10}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 hover:brightness-110 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--s1)',
                  color: '#000',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                Rephrase with AI
              </button>
            </div>
            {error && (
              <ApiErrorMessage onTryAgain={() => { setError(null); handleSubmitRaw(); }} />
            )}
          </div>
        )}

        {state === 'AI_PROCESSING' && (
          <div className="flow-transition-enter-active">
            <LoadingSpinner message="Rephrasing your pain statement..." />
          </div>
        )}

        {state === 'REVIEW' && (
          <div className="space-y-6 flow-transition-enter-active">
            {error && <ApiErrorMessage onTryAgain={() => { setError(null); handleTryAgain(); }} />}
            <p className="text-sm" style={{ color: 'var(--text2)' }}>
              Select the version that best captures your customer&apos;s pain, or ask for new options.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              {versions.map((v, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(v.text)}
                  className="rounded-lg border-2 p-4 text-left transition-all duration-150 hover:-translate-y-[2px]"
                  style={{
                    backgroundColor: 'var(--card)',
                    borderColor: selectedText === v.text ? 'var(--s1)' : 'var(--border)',
                  }}
                >
                  <p className="font-medium" style={{ color: 'var(--white)', fontFamily: 'var(--font-outfit)' }}>
                    {v.text}
                  </p>
                  <p
                    className="mt-1 text-xs uppercase tracking-wider"
                    style={{ color: 'var(--text3)' }}
                  >
                    {v.angle}
                  </p>
                  <p className="mt-2 text-sm" style={{ color: 'var(--text2)' }}>
                    {v.explanation}
                  </p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {versions.map((v, i) => (
                <button
                  key={i}
                  onClick={() => handleSelect(v.text)}
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 hover:brightness-110"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                    color: 'var(--text2)',
                    fontFamily: 'var(--font-outfit)',
                    borderRadius: '8px',
                  }}
                >
                  Select {String.fromCharCode(65 + i)}
                </button>
              ))}
              <button
                onClick={handleTryAgain}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  borderColor: '#f59e0b22',
                  backgroundColor: '#f59e0b08',
                  color: '#f59e0b',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                None work, try again
              </button>
            </div>
          </div>
        )}

        {state === 'CONFIDENCE' && (
          <div className="space-y-6">
            <p className="font-medium" style={{ color: 'var(--white)', fontFamily: 'var(--font-outfit)' }}>
              How do you know this pain is real?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleConfidence('customers')}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  borderColor: '#22c55e22',
                  backgroundColor: '#22c55e08',
                  color: '#5cb87a',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                Customers told me directly
              </button>
              <button
                onClick={() => handleConfidence('observed')}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  borderColor: '#22c55e22',
                  backgroundColor: '#22c55e08',
                  color: '#5cb87a',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                I observed it
              </button>
              <button
                onClick={() => handleConfidence('guess')}
                className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  borderColor: '#f59e0b22',
                  backgroundColor: '#f59e0b08',
                  color: '#f59e0b',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                I&apos;m guessing
              </button>
            </div>

            {confidence === 'guess' && (
              <div
                className="rounded-lg border p-4"
                style={{
                  borderColor: '#f59e0b22',
                  backgroundColor: '#f59e0b08',
                }}
              >
                <p className="flex items-center gap-2 font-medium" style={{ color: '#f59e0b', fontFamily: 'var(--font-outfit)' }}>
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  Guessed pain carries -5 penalty. Consider talking to 3 customers first.
                </p>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleAcceptGuess}
                    className="rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 hover:brightness-110"
                    style={{
                      backgroundColor: '#f59e0b',
                      color: '#000',
                      fontFamily: 'var(--font-outfit)',
                      borderRadius: '8px',
                    }}
                  >
                    Accept guess
                  </button>
                  <button
                    onClick={handleGetEvidence}
                    className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 hover:brightness-110"
                    style={{
                      borderColor: '#f59e0b22',
                      backgroundColor: 'var(--surface)',
                      color: '#f59e0b',
                      fontFamily: 'var(--font-outfit)',
                      borderRadius: '8px',
                    }}
                  >
                    I&apos;ll get evidence first
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {state === 'CONFIRM' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text3)' }}>
                Final pain statement
              </p>
              <p
                className="mt-2 rounded-lg border p-4"
                style={{
                  backgroundColor: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
              >
                {selectedText}
              </p>
            </div>
            <p className="font-medium" style={{ color: 'var(--white)', fontFamily: 'var(--font-outfit)' }}>
              Lock this pain statement?
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setConfirmLockOpen(true)}
                disabled={loading}
                className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 hover:brightness-110 disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--s1)',
                  color: '#000',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                {loading ? 'Locking…' : 'LOCK'}
              </button>
              <button
                onClick={handleEdit}
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text2)',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                EDIT
              </button>
              <button
                onClick={handleStartOver}
                disabled={loading}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150 hover:brightness-110"
                style={{
                  borderColor: '#ef444422',
                  backgroundColor: '#ef444408',
                  color: '#d46666',
                  fontFamily: 'var(--font-outfit)',
                  borderRadius: '8px',
                }}
              >
                START OVER
              </button>
            </div>
            {error && <ApiErrorMessage onTryAgain={() => { setError(null); handleLockConfirm(); }} />}
          </div>
        )}

        <ConfirmModal
          open={confirmLockOpen}
          title="Lock pain statement?"
          confirmLabel="Lock"
          onConfirm={handleLockConfirm}
          onCancel={() => setConfirmLockOpen(false)}
        >
          <p className="text-sm">
            You won&apos;t be able to edit this pain statement without overriding. Make sure it&apos;s correct.
          </p>
        </ConfirmModal>
      </div>
    </FlowContainer>
  );
}
