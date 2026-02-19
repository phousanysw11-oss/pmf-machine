'use client';

type AILoadingCardProps = {
  message?: string;
  contextualMessage?: string;
};

export function AILoadingCard({
  message = 'AI is thinking...',
  contextualMessage,
}: AILoadingCardProps) {
  return (
    <div className="flex flex-col items-center justify-center py-10 fade-up">
      <p className="text-4xl pulse-opacity">🧠</p>
      <p
        className="mt-4 text-[18px] font-bold text-[var(--text)]"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {message}
      </p>
      {contextualMessage && (
        <p className="mt-2 text-[14px] text-[var(--text-muted)]">
          {contextualMessage}
        </p>
      )}
      <div className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--gradient-brand)]"
          style={{
            width: '60%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
}
