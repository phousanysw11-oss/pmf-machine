'use client';

import { useEffect } from 'react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'default';
};

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmModalProps) {
  useEffect(() => {
    if (open) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel();
      };
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.body.style.overflow = '';
      };
    }
  }, [open, onCancel]);

  if (!open) return null;

  const confirmStyle =
    variant === 'danger'
      ? { backgroundColor: 'var(--red)', color: '#fff' }
      : { backgroundColor: 'var(--green)', color: '#000' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 transition-opacity"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onCancel}
        aria-hidden
      />
      <div
        className="relative w-full max-w-md rounded-xl border p-6 shadow-xl"
        style={{
          backgroundColor: 'var(--card)',
          borderColor: 'var(--border)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start justify-between gap-4">
          <h2
            id="confirm-title"
            className="text-lg font-bold"
            style={{ color: 'var(--text)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 transition-colors hover:opacity-80"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>
        <div className="mt-4 text-[14px]" style={{ color: 'var(--text-secondary)' }}>{children}</div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[52px] flex-1 rounded-xl px-4 font-bold transition-all duration-150 hover:brightness-110"
            style={{
              ...confirmStyle,
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[52px] flex-1 rounded-xl border px-4 font-bold transition-all duration-150 hover:brightness-110"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text-secondary)',
              fontFamily: 'Space Grotesk, sans-serif',
            }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
