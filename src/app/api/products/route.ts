import { NextRequest, NextResponse } from 'next/server';
import { createProduct } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    const product = await createProduct(name.trim());

    return NextResponse.json({
      id: product.id,
      name: product.name,
      status: product.status,
    });
  } catch (error) {
    console.error('Create product error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create product';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
