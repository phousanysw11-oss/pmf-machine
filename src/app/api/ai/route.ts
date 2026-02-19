import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing ANTHROPIC_API_KEY. Add it to .env.local and restart the server.' },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const systemPrompt = body?.systemPrompt;
    const userMessage = body?.userMessage;

    if (typeof systemPrompt !== 'string' || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'systemPrompt and userMessage must be strings' },
        { status: 400 }
      );
    }

    const text = await callClaude(systemPrompt, userMessage);
    return NextResponse.json({ response: text });
  } catch (error) {
    console.error('AI API error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
