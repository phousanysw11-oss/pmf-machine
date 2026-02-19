'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type FlowStatus = { flowNum: number; locked: boolean };

const PHASES = [
  { id: 'find', label: 'FIND', flows: [1, 2, 3, 4, 5], color: 'var(--cyan)', accent: 'cyan' as const },
  { id: 'test', label: 'TEST', flows: [7, 8], color: 'var(--amber)', accent: 'amber' as const },
  { id: 'prove', label: 'PROVE', flows: [6, 9], color: 'var(--green)', accent: 'green' as const },
  { id: 'scale', label: 'SCALE', flows: [10], color: 'var(--purple)', accent: 'purple' as const },
];

type ProductPhaseCardsProps = {
  productId: string;
  flowStatuses: FlowStatus[];
  currentFlow: number;
  flowLabels: Record<number, string>;
};

export function ProductPhaseCards({
  productId,
  flowStatuses,
  currentFlow,
  flowLabels,
}: ProductPhaseCardsProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const getStatus = (flowNum: number) =>
    flowStatuses.find((f) => f.flowNum === flowNum) ?? { flowNum, locked: false };

  const phaseComplete = (flowNums: number[]) =>
    flowNums.every((n) => getStatus(n).locked);
  const phaseNextFlow = (flowNums: number[]) =>
    flowNums.find((n) => !getStatus(n).locked);
  const phaseUnlocked = (phaseIndex: number) => {
    if (phaseIndex === 0) return true;
    return phaseComplete(PHASES[phaseIndex - 1].flows);
  };

  return (
    <div className="space-y-3">
      {PHASES.map((phase, idx) => {
        const unlocked = phaseUnlocked(idx);
        const completed = phaseComplete(phase.flows);
        const nextInPhase = phaseNextFlow(phase.flows);
        const expanded = expandedPhase === phase.id;

        return (
          <div
            key={phase.id}
            className="overflow-hidden rounded-2xl border border-[var(--border)] transition-all duration-150"
            style={{
              background: 'var(--card)',
              borderLeftWidth: '4px',
              borderLeftColor: phase.color,
            }}
          >
            {/* Phase header — always visible */}
            <button
              type="button"
              onClick={() => setExpandedPhase(expanded ? null : phase.id)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[var(--card-hover)]"
            >
              <div className="min-w-0 flex-1">
                <p
                  className="text-sm font-bold uppercase tracking-wider"
                  style={{ color: phase.color, fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {phase.label}
                </p>
                {unlocked ? (
                  <>
                    <div className="mt-1 flex gap-0.5">
                      {phase.flows.map((n) => (
                        <span
                          key={n}
                          className="text-[10px]"
                          style={{
                            color: getStatus(n).locked ? phase.color : 'var(--text-muted)',
                          }}
                        >
                          {getStatus(n).locked ? '⬤' : '○'}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                      {phase.flows.filter((n) => getStatus(n).locked).length}/{phase.flows.length} done
                      {!completed &&
                        nextInPhase != null &&
                        ` • ${flowLabels[nextInPhase] ?? `Flow ${nextInPhase}`}`}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                    🔒 Complete {PHASES[idx - 1].label} first
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {completed && (
                  <span className="text-sm font-semibold text-[var(--green)]">COMPLETED ✓</span>
                )}
                {unlocked && !completed && nextInPhase != null && (
                  <span
                    className="rounded px-2 py-0.5 text-[11px] font-bold uppercase"
                    style={{
                      background: `${phase.color}20`,
                      color: phase.color,
                      fontFamily: 'Space Grotesk, sans-serif',
                    }}
                  >
                    DO THIS
                  </span>
                )}
                <span className="text-[var(--text-muted)]">{expanded ? '▼' : '▶'}</span>
              </div>
            </button>

            {/* Expanded: list of flows */}
            {expanded && unlocked && (
              <div className="border-t border-[var(--border)] p-4 pt-3">
                <div className="space-y-2">
                  {phase.flows.map((flowNum) => {
                    const status = getStatus(flowNum);
                    const isNext = flowNum === currentFlow;
                    const label = flowLabels[flowNum] ?? `Flow ${flowNum}`;
                    return (
                      <Link
                        key={flowNum}
                        href={`/products/${productId}/flow${flowNum}`}
                        className={cn(
                          'flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150',
                          isNext && 'border-[var(--border-bright)] bg-[var(--surface)]'
                        )}
                        style={{
                          borderColor: isNext ? undefined : 'var(--border)',
                        }}
                      >
                        <span className="text-[14px] font-medium text-[var(--text)]">
                          {status.locked ? '✓' : '>'} {label}
                        </span>
                        {isNext && (
                          <span
                            className="text-[11px] font-bold uppercase"
                            style={{ color: phase.color }}
                          >
                            DO THIS
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
