import { NextRequest, NextResponse } from 'next/server';
import { saveFlowData } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, flowNumber, data } = body;

    if (typeof productId !== 'string' || typeof flowNumber !== 'number') {
      return NextResponse.json(
        { error: 'productId and flowNumber are required' },
        { status: 400 }
      );
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { error: 'data must be an object' },
        { status: 400 }
      );
    }

    const result = await saveFlowData(productId, flowNumber, data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Save flow error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save flow data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
