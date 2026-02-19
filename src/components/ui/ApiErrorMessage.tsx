'use client';

type ApiErrorMessageProps = {
  onTryAgain?: () => void;
  className?: string;
};

const FRIENDLY_MESSAGE = 'Something went wrong. Please try again.';

export function ApiErrorMessage({ onTryAgain, className = '' }: ApiErrorMessageProps) {
  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-xl border p-6 ${className}`}
      style={{
        borderColor: '#fbbf2433',
        backgroundColor: '#fbbf2418',
      }}
      role="alert"
    >
      <span className="text-3xl" aria-hidden>⚠️</span>
      <p className="text-center text-[15px] font-medium" style={{ color: '#fbbf24', fontFamily: 'Space Grotesk, sans-serif' }}>
        {FRIENDLY_MESSAGE}
      </p>
      {onTryAgain && (
        <button
          type="button"
          onClick={onTryAgain}
          className="min-h-[52px] min-w-[140px] rounded-xl px-4 py-2.5 text-[15px] font-bold transition-all duration-150 hover:brightness-110"
          style={{
            backgroundColor: 'var(--amber)',
            color: '#000',
            fontFamily: 'Space Grotesk, sans-serif',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
