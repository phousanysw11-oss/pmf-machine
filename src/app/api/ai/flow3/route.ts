import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';

function formatCustomerProfile(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'Unknown';
  const p = profile as Record<string, unknown>;
  if (p.source === 'custom' && typeof p.custom_text === 'string') {
    return p.custom_text;
  }
  if (p.source === 'ai' && p.who) return String(p.who);
  return JSON.stringify(profile);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'stress_test') {
      const { painText, customerProfile, operatorInput } = body;

      if (typeof painText !== 'string' || !painText.trim()) {
        return NextResponse.json(
          { error: 'painText is required' },
          { status: 400 }
        );
      }
      if (typeof operatorInput !== 'string' || !operatorInput.trim()) {
        return NextResponse.json(
          { error: 'operatorInput is required (min 20 chars)' },
          { status: 400 }
        );
      }

      const customer = formatCustomerProfile(customerProfile);

      const systemPrompt = `You are stress-testing whether a COD e-commerce product is genuinely differentiated.
Pain: "${painText.trim()}"
Customer: "${customer}"
Claimed difference: "${operatorInput.trim()}"

Generate 3 tough challenges. Be the skeptical investor. Each challenge should:
- Name a specific alternative the customer already has
- Explain why the customer might NOT switch
- Force the operator to prove their difference is REAL, not marketing

Respond ONLY with valid JSON in this exact format:
{"challenges":[{"challenge_text":"string","alternative_named":"string","switching_barrier":"string"}]}

No markdown, no extra text.`;

      const response = await callClaude(
        systemPrompt,
        `Generate 3 tough challenges to this differentiation claim.`
      );

      const parsed = parseAIJSON(response) as {
        challenges?: Array<{
          challenge_text: string;
          alternative_named: string;
          switching_barrier: string;
        }>;
      } | null;

      if (!parsed) throw new Error('Invalid AI response (expected JSON)');

      if (
        !parsed.challenges ||
        !Array.isArray(parsed.challenges) ||
        parsed.challenges.length < 3
      ) {
        throw new Error(
          'Invalid format: expected {challenges: [{challenge_text, alternative_named, switching_barrier}, ...]}'
        );
      }

      const challenges = parsed.challenges.slice(0, 3).map((c) => ({
        challenge_text: String(c.challenge_text ?? ''),
        alternative_named: String(c.alternative_named ?? ''),
        switching_barrier: String(c.switching_barrier ?? ''),
      }));

      return NextResponse.json({ challenges });
    }

    if (action === 'verdict') {
      const { challenges, defenseResponses, operatorInput } = body;

      if (!Array.isArray(challenges) || challenges.length < 3) {
        return NextResponse.json(
          { error: 'challenges array is required (3 items)' },
          { status: 400 }
        );
      }
      if (!Array.isArray(defenseResponses) || defenseResponses.length < 3) {
        return NextResponse.json(
          { error: 'defenseResponses array is required (3 items)' },
          { status: 400 }
        );
      }

      const context = challenges
        .map(
          (c: { challenge_text: string }, i: number) =>
            `Challenge ${i + 1}: ${c.challenge_text}\nDefense: ${defenseResponses[i] ?? ''}`
        )
        .join('\n\n');

      const systemPrompt = `Evaluate whether these defenses prove genuine differentiation for a COD product.
Original claim: "${(operatorInput ?? '').toString()}"

${context}

Be honest. If the defenses are just marketing speak ('better quality', 'more convenient'), rate as WEAK.
If defenses cite specific, verifiable advantages, rate as STRONG.
If defenses don't address the challenges, rate as NONE.

Respond ONLY with valid JSON:
{"verdict":"STRONG"|"WEAK"|"NONE","explanation":"string","strongest_point":"string","weakest_point":"string"}

No markdown, no extra text.`;

      const response = await callClaude(
        systemPrompt,
        `Evaluate the defense. Respond with JSON only.`
      );

      const parsed = parseAIJSON(response) as {
        verdict?: string;
        explanation?: string;
        strongest_point?: string;
        weakest_point?: string;
      } | null;

      if (!parsed) throw new Error('Invalid AI response (expected JSON)');

      const verdict = parsed.verdict ?? 'NONE';
      if (!['STRONG', 'WEAK', 'NONE'].includes(verdict)) {
        throw new Error('Invalid verdict: expected STRONG, WEAK, or NONE');
      }

      return NextResponse.json({
        verdict,
        explanation: String(parsed.explanation ?? ''),
        strongest_point: String(parsed.strongest_point ?? ''),
        weakest_point: String(parsed.weakest_point ?? ''),
      });
    }

    return NextResponse.json(
      { error: 'action must be stress_test or verdict' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Flow 3 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
