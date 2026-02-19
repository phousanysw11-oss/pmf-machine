'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function CreateProductForm() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create product');
      }

      router.push(`/products/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-6 shadow-sm"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
        borderRadius: '10px',
      }}
    >
      <label htmlFor="name" className="block text-sm font-medium" style={{ color: 'var(--text2)' }}>
        Product name
      </label>
      <input
        id="name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Wireless Charging Pad"
        className="mt-2 block w-full rounded-lg border px-4 py-2.5 focus:outline-none focus:ring-1"
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
        required
        disabled={loading}
      />
      {error && (
        <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>{error}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110 disabled:opacity-50"
          style={{
            backgroundColor: 'var(--s3)',
            color: '#000',
            fontFamily: 'var(--font-outfit)',
            borderRadius: '8px',
          }}
        >
          {loading ? 'Creating…' : 'Create Product'}
        </button>
        <Link
          href="/"
          className="rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-150 hover:brightness-110"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text2)',
            fontFamily: 'var(--font-outfit)',
            borderRadius: '8px',
          }}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
