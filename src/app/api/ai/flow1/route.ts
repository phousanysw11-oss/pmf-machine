import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';

const SYSTEM_PROMPT = `You are helping a COD e-commerce operator in Laos articulate their customer's pain.
Take their raw description and create 3 rephrased versions.
Rules:
- Use the CUSTOMER's language, not business jargon
- Be specific: who has the pain, when, how badly
- Keep each version under 2 sentences
- Each version should use a different angle: emotional, practical, financial
Respond ONLY with valid JSON in this exact format: {"versions":[{"text":"string","angle":"string","explanation":"string"}]}
No markdown, no extra text.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawPain } = body;

    if (typeof rawPain !== 'string' || !rawPain.trim()) {
      return NextResponse.json(
        { error: 'rawPain is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const response = await callClaude(
      SYSTEM_PROMPT,
      `Rephrase this customer pain statement into 3 versions:\n\n"${rawPain.trim()}"`
    );

    const parsed = parseAIJSON(response) as {
      versions?: Array<{ text: string; angle: string; explanation: string }>;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    if (!parsed.versions || !Array.isArray(parsed.versions) || parsed.versions.length < 3) {
      throw new Error('Invalid response format: expected {versions: [{text, angle, explanation}, ...]}');
    }

    const versions = parsed.versions.slice(0, 3).map((v) => ({
      text: String(v.text ?? ''),
      angle: String(v.angle ?? ''),
      explanation: String(v.explanation ?? ''),
    }));

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('Flow 1 AI error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate rephrased versions';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
