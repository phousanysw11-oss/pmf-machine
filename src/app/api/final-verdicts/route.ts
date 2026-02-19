import { NextResponse } from 'next/server';
import { saveFinalVerdict } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productId,
      verdict,
      confidence,
      pmf_score,
      foundation_score,
      experiment_score,
      consistency_score,
      total_penalty,
      total_modifiers,
      summary,
    } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const record = await saveFinalVerdict(productId, {
      ...(verdict != null && { verdict }),
      ...(confidence != null && { confidence }),
      ...(pmf_score != null && { pmf_score: Number(pmf_score) }),
      ...(foundation_score != null && { foundation_score: Number(foundation_score) }),
      ...(experiment_score != null && { experiment_score: Number(experiment_score) }),
      ...(consistency_score != null && { consistency_score: Number(consistency_score) }),
      ...(total_penalty != null && { total_penalty: Number(total_penalty) }),
      ...(total_modifiers != null && { total_modifiers: Number(total_modifiers) }),
      ...(summary != null && { summary: typeof summary === 'string' ? summary : JSON.stringify(summary) }),
    });

    return NextResponse.json(record);
  } catch (err) {
    console.error('Final verdict POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save final verdict' },
      { status: 500 }
    );
  }
}
