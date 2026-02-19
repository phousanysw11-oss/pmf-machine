'use client';

import Link from 'next/link';

type FlowContainerProps = {
  flowNumber: number;
  flowTitle: string;
  flowDescription: string;
  productId: string;
  productName: string;
  isLocked: boolean;
  stateIndicator?: string;
  showOverride?: boolean;
  onOverride?: () => void;
  children: React.ReactNode;
  className?: string;
};

export function FlowContainer({
  flowNumber,
  flowTitle,
  flowDescription,
  productId,
  productName,
  isLocked,
  stateIndicator,
  showOverride,
  onOverride,
  children,
  className = '',
}: FlowContainerProps) {
  const prevFlow = flowNumber > 1 ? flowNumber - 1 : null;
  const nextFlow = flowNumber < 10 ? flowNumber + 1 : null;
  const prevHref = prevFlow ? `/products/${productId}/flow${prevFlow}` : null;
  const nextHref = nextFlow ? `/products/${productId}/flow${nextFlow}` : null;

  return (
    <div className={`min-w-0 space-y-6 ${className}`}>
      {/* Top bar: Back | Step N/10 */}
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Link
          href={`/products/${productId}`}
          className="min-h-[44px] text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          ← Back to product
        </Link>
        <span
          className="text-[13px] font-semibold tabular-nums text-[var(--text-muted)]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Step {flowNumber}/10
        </span>
      </div>

      {/* Optional state / locked / override */}
      {(stateIndicator || isLocked || (showOverride && onOverride)) && (
        <div className="flex flex-wrap items-center gap-2">
          {stateIndicator && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {stateIndicator}
            </span>
          )}
          {isLocked && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase"
              style={{
                background: '#4ade8018',
                color: '#4ade80',
                border: '1px solid #4ade8033',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              🔒 Locked
            </span>
          )}
          {showOverride && onOverride && (
            <button
              type="button"
              onClick={onOverride}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 hover:brightness-110"
              style={{
                borderColor: '#fbbf2433',
                background: '#fbbf2418',
                color: '#fbbf24',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              ⚠️ Override
            </button>
          )}
        </div>
      )}

      <div
        className="min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] p-5 transition-all duration-150"
        style={{ background: 'var(--card)' }}
      >
        {children}
      </div>

      {/* Prev / Next */}
      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        <div className="min-w-0">
          {prevHref && (
            <Link
              href={prevHref}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-4 text-[14px] font-medium transition-all duration-150 hover:border-[var(--border-bright)]"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              ← Flow {prevFlow}
            </Link>
          )}
        </div>
        <div className="min-w-0">
          {nextHref && (
            <Link
              href={nextHref}
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl border border-[var(--border)] px-4 text-[14px] font-medium transition-all duration-150 hover:border-[var(--border-bright)]"
              style={{
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontFamily: 'Space Grotesk, sans-serif',
              }}
            >
              Flow {nextFlow} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
