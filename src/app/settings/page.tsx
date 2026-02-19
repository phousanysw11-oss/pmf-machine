import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 fade-up">
      <div>
        <Link
          href="/"
          className="text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1
          className="text-2xl font-semibold text-[var(--text)]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Settings
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Configure PMF Machine options
        </p>
      </div>

      <div
        className="rounded-2xl border border-[var(--border)] p-6"
        style={{ background: 'var(--card)' }}
      >
        <p className="text-sm text-[var(--text-secondary)]">
          Settings coming soon.
        </p>
      </div>
    </div>
  );
}
