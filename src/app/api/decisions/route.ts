import { NextResponse } from 'next/server';
import { saveDecision } from '@/lib/database';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      productId,
      experimentId,
      ai_recommendation,
      ai_reason,
      human_decision,
      override_applied,
      override_reason,
      override_penalty,
    } = body;

    if (!productId || !human_decision) {
      return NextResponse.json(
        { error: 'productId and human_decision are required' },
        { status: 400 }
      );
    }

    const decision = await saveDecision(productId, {
      ...(experimentId && { experiment_id: experimentId }),
      ...(ai_recommendation != null && { ai_recommendation }),
      ...(ai_reason != null && { ai_reason }),
      human_decision,
      override_applied: Boolean(override_applied),
      ...(override_reason != null && { override_reason }),
      override_penalty: Number(override_penalty) || 0,
    });

    return NextResponse.json(decision);
  } catch (err) {
    console.error('Decisions POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save decision' },
      { status: 500 }
    );
  }
}
