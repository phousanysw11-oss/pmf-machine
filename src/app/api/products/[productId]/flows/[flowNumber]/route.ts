import { NextRequest, NextResponse } from 'next/server';
import { saveFlowData, lockFlowWithData } from '@/lib/database';

export async function POST(
  request: NextRequest,
  { params }: { params: { productId: string; flowNumber: string } }
) {
  try {
    const productId = params.productId;
    const flowNumber = parseInt(params.flowNumber, 10);

    if (!productId || isNaN(flowNumber) || flowNumber < 1 || flowNumber > 10) {
      return NextResponse.json({ error: 'Invalid product or flow' }, { status: 400 });
    }

    const body = await request.json();
    const { action, data, penalty } = body;

    if (action === 'save') {
      if (!data || typeof data !== 'object') {
        return NextResponse.json({ error: 'data is required' }, { status: 400 });
      }
      await saveFlowData(productId, flowNumber, data);
      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      if (!data || typeof data !== 'object') {
        return NextResponse.json({ error: 'data is required' }, { status: 400 });
      }
      const penaltyToAdd = typeof penalty === 'number' ? penalty : 0;
      const result = await lockFlowWithData(
        productId,
        flowNumber,
        data,
        penaltyToAdd
      );
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Flow API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
