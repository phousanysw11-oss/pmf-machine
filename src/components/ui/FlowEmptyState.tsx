'use client';

type FlowEmptyStateProps = {
  title: string;
  description: string;
};

export function FlowEmptyState({ title, description }: FlowEmptyStateProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-6 text-center">
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
