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

    if (action === 'scenarios') {
      const { painText, customerProfile, solutionDescription } = body;

      if (typeof painText !== 'string' || !painText.trim()) {
        return NextResponse.json(
          { error: 'painText is required' },
          { status: 400 }
        );
      }

      const customer = formatCustomerProfile(customerProfile);
      const solution = (solutionDescription ?? '').toString().trim() || 'Not specified';

      const systemPrompt = `Generate 3 price scenarios for a COD product in Laos.
Customer: "${customer}"
Pain: "${painText.trim()}"
Product type: "${solution}"

 CONSERVATIVE: Price requiring zero convincing. Impulse buy territory.
 MID-RANGE: Requires perceived value. Accessible but thoughtful purchase.
 AGGRESSIVE: Premium. Only converts with strong differentiation.

For each include: tier (CONSERVATIVE|MID-RANGE|AGGRESSIVE), price_usd (number), price_lak (number, 1 USD ≈ 21700 LAK), logic, cod_cancel_risk_percent (number 0-100), who_buys_description.
Also include honesty_question: a scenario question to test if the operator is honest about pricing, e.g. "If [customer] saw this next to [competitor] for $X less, would they still choose yours at $[price]?"

Respond ONLY with valid JSON:
{"scenarios":[{"tier":"string","price_usd":number,"price_lak":number,"logic":"string","cod_cancel_risk_percent":number,"who_buys_description":"string","honesty_question":"string"}],"market_context":"string"}

No markdown, no extra text.`;

      const response = await callClaude(
        systemPrompt,
        `Generate 3 price scenarios with honesty questions.`
      );

      const parsed = parseAIJSON(response) as {
        scenarios?: Array<{
          tier: string;
          price_usd: number;
          price_lak: number;
          logic: string;
          cod_cancel_risk_percent: number;
          who_buys_description: string;
          honesty_question?: string;
        }>;
        market_context?: string;
      } | null;

      if (!parsed) throw new Error('Invalid AI response (expected JSON)');

      if (
        !parsed.scenarios ||
        !Array.isArray(parsed.scenarios) ||
        parsed.scenarios.length < 3
      ) {
        throw new Error(
          'Invalid format: expected {scenarios: [{tier, price_usd, price_lak, logic, cod_cancel_risk_percent, who_buys_description, honesty_question}, ...], market_context}'
        );
      }

      const scenarios = parsed.scenarios.slice(0, 3).map((s) => {
        const s2 = s as Record<string, unknown>;
        const cancelRisk = s2.cod_cancel_risk_percent ?? s2.cancel_risk ?? 0;
        return {
          tier: String(s.tier ?? ''),
          price_usd: Number(s.price_usd) || 0,
          price_lak: Number(s.price_lak) || 0,
          logic: String(s.logic ?? ''),
          cod_cancel_risk_percent: Number(cancelRisk) || 0,
          who_buys_description: String(s.who_buys_description ?? ''),
          honesty_question: String(s.honesty_question ?? ''),
        };
      });

      return NextResponse.json({
        scenarios,
        market_context: String(parsed.market_context ?? ''),
      });
    }

    if (action === 'honesty') {
      const { tier, priceUsd, customerProfile, answer } = body;

      if (typeof tier !== 'string' || typeof priceUsd !== 'number') {
        return NextResponse.json(
          { error: 'tier and priceUsd are required' },
          { status: 400 }
        );
      }
      if (typeof answer !== 'string' || answer.trim().length < 20) {
        return NextResponse.json(
          { error: 'answer must be at least 20 characters' },
          { status: 400 }
        );
      }

      const customer = formatCustomerProfile(customerProfile);

      const systemPrompt = `Evaluate if the operator's pricing answer is honest.
They picked ${tier} at $${priceUsd}.
Their customer: "${customer}"
Their answer to the pricing scenario: "${answer.trim()}"

Look for contradictions:
- Price-sensitive customer + aggressive price
- Words like 'maybe', 'if we convince them', 'with good marketing' (= hope, not evidence)
- Comparing to premium markets but selling in Laos

Respond ONLY with valid JSON:
{"verdict":"HONEST"|"CONTRADICTED","contradiction":string|null,"recommended_tier":string|null}

No markdown, no extra text.`;

      const response = await callClaude(
        systemPrompt,
        `Evaluate the pricing answer for honesty.`
      );

      const parsed = parseAIJSON(response) as {
        verdict?: string;
        contradiction?: string | null;
        recommended_tier?: string | null;
      } | null;

      if (!parsed) throw new Error('Invalid AI response (expected JSON)');

      const verdict = parsed.verdict ?? 'HONEST';
      if (!['HONEST', 'CONTRADICTED'].includes(verdict)) {
        throw new Error('Invalid verdict: expected HONEST or CONTRADICTED');
      }

      return NextResponse.json({
        verdict,
        contradiction: parsed.contradiction ?? null,
        recommended_tier: parsed.recommended_tier ?? null,
      });
    }

    return NextResponse.json(
      { error: 'action must be scenarios or honesty' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Flow 4 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
