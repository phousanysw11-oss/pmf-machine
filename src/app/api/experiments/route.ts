import { NextRequest, NextResponse } from 'next/server';
import { createExperiment } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      productId,
      hypothesis,
      null_hypothesis,
      setup_steps,
      primary_metric,
      kill_condition,
      time_limit_hours,
      budget_limit_usd,
      success_criteria,
      failure_criteria,
      ambiguous_criteria,
      secondary_metrics,
      startNow,
      uncertainty_type,
      uncertainty_question,
    } = body;

    if (typeof productId !== 'string' || !productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    const data: Record<string, unknown> = {
      hypothesis: hypothesis ?? '',
      null_hypothesis: null_hypothesis ?? '',
      setup_steps: setup_steps ?? [],
      primary_metric: primary_metric ?? {},
      kill_condition: kill_condition ?? {},
      time_limit_hours: time_limit_hours ?? 24,
      budget_limit_usd: budget_limit_usd ?? 0,
      results: {
        success_criteria: success_criteria ?? '',
        failure_criteria: failure_criteria ?? '',
        ambiguous_criteria: ambiguous_criteria ?? '',
        secondary_metrics: secondary_metrics ?? [],
      },
      status: startNow ? 'active' : 'pending',
      ...(startNow && { started_at: now }),
    };

    const experiment = await createExperiment(productId, data);

    return NextResponse.json({
      ...experiment,
      uncertainty_type,
      uncertainty_question,
    });
  } catch (error) {
    console.error('Create experiment error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create experiment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
