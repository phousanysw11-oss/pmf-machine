'use client';

type LoadingSpinnerProps = {
  message?: string;
  className?: string;
};

export function LoadingSpinner({ message, className = '' }: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 py-8 ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="text-3xl pulse-opacity">⏳</div>
      {message && (
        <p
          className="text-center text-[15px] font-medium text-[var(--text-secondary)]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {message}
        </p>
      )}
    </div>
  );
}
