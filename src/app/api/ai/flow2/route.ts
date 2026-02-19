import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { painText } = body;

    if (typeof painText !== 'string' || !painText.trim()) {
      return NextResponse.json(
        { error: 'painText is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are identifying the ideal customer for a COD e-commerce product in Laos/Southeast Asia.
Given this pain: "${painText.trim()}"

Generate 3 customer profiles ranked by who suffers MOST from this pain.
Each profile must include:
- rank: 1, 2, or 3 (1 = suffers most)
- who: specific demographics (age, location, occupation, income level)
- why_worst: why this person has the pain worst (2 sentences)
- how_to_reach: where this person spends time online (specific platforms)
- budget_estimate: what they typically spend on solutions to this pain

Respond ONLY with valid JSON in this exact format:
{"profiles":[{"rank":1,"who":"string","why_worst":"string","how_to_reach":"string","budget_estimate":"string"}]}

No markdown, no extra text.`;

    const response = await callClaude(
      systemPrompt,
      `Generate 3 customer profiles for the pain: "${painText.trim()}"`
    );

    const parsed = parseAIJSON(response) as {
      profiles?: Array<{
        rank: number;
        who: string;
        why_worst: string;
        how_to_reach: string;
        budget_estimate: string;
      }>;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    if (!parsed.profiles || !Array.isArray(parsed.profiles) || parsed.profiles.length < 3) {
      throw new Error('Invalid response format: expected {profiles: [{rank, who, why_worst, how_to_reach, budget_estimate}, ...]}');
    }

    const profiles = parsed.profiles.slice(0, 3).map((p) => ({
      rank: Number(p.rank) || 0,
      who: String(p.who ?? ''),
      why_worst: String(p.why_worst ?? ''),
      how_to_reach: String(p.how_to_reach ?? ''),
      budget_estimate: String(p.budget_estimate ?? ''),
    }));

    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Flow 2 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to generate customer profiles';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
