'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type FlowStatus = {
  locked: boolean;
  completed: boolean;
  score?: number | null;
};

type FlowStepperProps = {
  currentFlow: number;
  flowStatuses: FlowStatus[];
  productId?: string;
};

type Phase = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  flows: number[];
  timeEstimate: string;
};

const PHASES: Phase[] = [
  {
    id: 'find',
    label: 'FIND',
    color: 'var(--s1)',
    bgColor: 'var(--s1bg)',
    flows: [1, 2, 3, 4, 5],
    timeEstimate: '~2h',
  },
  {
    id: 'test',
    label: 'TEST',
    color: 'var(--s2)',
    bgColor: 'var(--s2bg)',
    flows: [7, 8],
    timeEstimate: '~1h',
  },
  {
    id: 'prove',
    label: 'PROVE',
    color: 'var(--s3)',
    bgColor: 'var(--s3bg)',
    flows: [6, 9],
    timeEstimate: '~1h',
  },
  {
    id: 'scale',
    label: 'SCALE',
    color: 'var(--s4)',
    bgColor: 'var(--s4bg)',
    flows: [10],
    timeEstimate: '~30m',
  },
];

function getPhaseForFlow(flowNum: number): Phase | null {
  return PHASES.find((p) => p.flows.includes(flowNum)) ?? null;
}

function getPhaseProgress(phase: Phase, flowStatuses: FlowStatus[]): {
  completed: number;
  total: number;
  allComplete: boolean;
} {
  const phaseFlows = phase.flows.map((f) => flowStatuses[f - 1] ?? { locked: false, completed: false });
  const completed = phaseFlows.filter((f) => f.completed && f.locked).length;
  const total = phaseFlows.length;
  return {
    completed,
    total,
    allComplete: completed === total && total > 0,
  };
}

function isPhaseActive(phase: Phase, currentFlow: number): boolean {
  return phase.flows.includes(currentFlow);
}

export function FlowStepper({ currentFlow, flowStatuses, productId }: FlowStepperProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {PHASES.map((phase) => {
        const progress = getPhaseProgress(phase, flowStatuses);
        const active = isPhaseActive(phase, currentFlow);
        const progressPercent = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

        const href = productId ? `/products/${productId}` : null;
        const Wrapper = href ? Link : 'div';

        return (
          <Wrapper
            key={phase.id}
            href={href ?? '#'}
            className={cn(
              'group relative rounded-[10px] border p-4 transition-all duration-150',
              active
                ? 'border-[2px]'
                : 'border-[1px]',
              'hover:-translate-y-[2px]'
            )}
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: active ? phase.color : 'var(--border)',
            }}
          >
            {/* Check mark when complete */}
            {progress.allComplete && (
              <div className="absolute right-2 top-2">
                <span className="text-lg">✅</span>
              </div>
            )}

            {/* Colored circle number */}
            <div
              className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
              style={{
                backgroundColor: `${phase.color}14`,
                color: phase.color,
                fontFamily: 'var(--font-outfit)',
              }}
            >
              {PHASES.indexOf(phase) + 1}
            </div>

            {/* Phase label */}
            <div
              className="mb-1 text-center text-[13px] font-bold"
              style={{
                color: 'var(--white)',
                fontFamily: 'var(--font-outfit)',
              }}
            >
              {phase.label}
            </div>

            {/* Time estimate */}
            <div
              className="mb-3 text-center text-[10px]"
              style={{ color: 'var(--text3)' }}
            >
              {phase.timeEstimate}
            </div>

            {/* Progress bar */}
            <div
              className="h-[3px] rounded-full"
              style={{ backgroundColor: 'var(--border)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: phase.color,
                }}
              />
            </div>
          </Wrapper>
        );
      })}
    </div>
  );
}
