import { cn } from '@/lib/utils';

type Status = 'GO' | 'FIX' | 'KILL' | 'ACTIVE' | 'LOCKED' | 'CONFIRMED' | 'KILLED';

const statusConfig: Record<
  Status,
  { bg: string; text: string; border: string }
> = {
  GO: { bg: '#22c55e08', text: '#5cb87a', border: '#22c55e22' },
  FIX: { bg: '#f59e0b08', text: '#f59e0b', border: '#f59e0b22' },
  KILL: { bg: '#ef444408', text: '#d46666', border: '#ef444422' },
  KILLED: { bg: '#ef444408', text: '#d46666', border: '#ef444422' },
  ACTIVE: { bg: 'var(--surface)', text: 'var(--text2)', border: 'var(--border)' },
  LOCKED: { bg: 'var(--surface)', text: 'var(--text2)', border: 'var(--border)' },
  CONFIRMED: { bg: '#22c55e08', text: '#5cb87a', border: '#22c55e22' },
};

export function StatusBadge({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const config = statusConfig[status] ?? statusConfig.ACTIVE;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wider',
        className
      )}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
        fontFamily: 'Space Grotesk, sans-serif',
      }}
    >
      {status}
    </span>
  );
}
