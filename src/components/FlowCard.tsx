'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type FlowCardProps = {
  flowNumber: number;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'done';
  productId: string;
  phaseColor: string;
};

export function FlowCard({
  flowNumber,
  title,
  description,
  status,
  productId,
  phaseColor,
}: FlowCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    todo: { label: 'To Do', bg: 'var(--surface)', text: 'var(--text2)', border: 'var(--border)' },
    'in-progress': { label: 'In Progress', bg: '#f59e0b08', text: '#f59e0b', border: '#f59e0b22' },
    done: { label: 'Done ✅', bg: '#22c55e08', text: '#5cb87a', border: '#22c55e22' },
  };

  const config = statusConfig[status];

  return (
    <div
      className="rounded-[10px] border transition-all duration-150"
      style={{
        backgroundColor: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex cursor-pointer items-center gap-3 p-4 transition-all duration-150 hover:opacity-80"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Colored circle */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
          style={{
            backgroundColor: `${phaseColor}14`,
            color: phaseColor,
            fontFamily: 'var(--font-outfit)',
          }}
        >
          {flowNumber}
        </div>

        {/* Title and description */}
        <div className="min-w-0 flex-1">
          <div
            className="text-[15px] font-bold"
            style={{ color: 'var(--white)', fontFamily: 'var(--font-outfit)' }}
          >
            {title}
          </div>
          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text3)' }}>
            {description}
          </div>
        </div>

        {/* Status badge */}
        <div
          className="rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            backgroundColor: config.bg,
            color: config.text,
            borderColor: config.border,
            fontFamily: 'var(--font-outfit)',
          }}
        >
          {config.label}
        </div>

        {/* Expand icon */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--text2)' }} />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text2)' }} />
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          className="border-t p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <Link
            href={`/products/${productId}/flow${flowNumber}`}
            className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 hover:brightness-110"
            style={{
              backgroundColor: phaseColor,
              color: phaseColor === 'var(--s4)' ? '#fff' : '#000',
              fontFamily: 'var(--font-outfit)',
              borderRadius: '8px',
            }}
          >
            {status === 'done' ? 'View Flow' : status === 'in-progress' ? 'Continue Flow' : 'Start Flow'}
          </Link>
        </div>
      )}
    </div>
  );
}
