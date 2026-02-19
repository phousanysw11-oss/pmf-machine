import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';
import { getFlowData } from '@/lib/database';

function formatCustomer(profile: unknown): string {
  if (!profile || typeof profile !== 'object') return 'target customer';
  const p = profile as Record<string, unknown>;
  if (p.source === 'custom' && typeof p.custom_text === 'string') return p.custom_text;
  if (p.source === 'ai' && p.who) return String(p.who);
  return 'target customer';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const productId = String(body?.productId ?? '').trim();
    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 });
    }

    const [flow1, flow2, flow3, flow4, flow5, flow7] = await Promise.all([
      getFlowData(productId, 1),
      getFlowData(productId, 2),
      getFlowData(productId, 3),
      getFlowData(productId, 4),
      getFlowData(productId, 5),
      getFlowData(productId, 7),
    ]);

    const f1 = (flow1?.data as Record<string, unknown>) ?? {};
    const f2 = (flow2?.data as Record<string, unknown>) ?? {};
    const f3 = (flow3?.data as Record<string, unknown>) ?? {};
    const f4 = (flow4?.data as Record<string, unknown>) ?? {};
    const f5 = (flow5?.data as Record<string, unknown>) ?? {};
    const f7 = (flow7?.data as Record<string, unknown>) ?? {};

    const pain = String(f1.pain_text ?? '').trim() || 'Not specified';
    const customer = formatCustomer(f2.customer_profile);
    const solution = String(f3.defense_text ?? '').trim() || 'Not specified';
    const price = Number(f4.committed_price_usd) || 0;
    const channel = String(f5.primary_channel ?? '').trim() || 'Not specified';
    const defense = String(f3.defense_text ?? '').trim() || solution;

    const experimentSpec = f7.experiment_spec as Record<string, unknown> | undefined;
    const hypothesis = String(experimentSpec?.hypothesis ?? '').trim() || 'Not specified';

    const systemPrompt = `Write 3 ad copy variants for a COD e-commerce test in Laos.
Channel: ${channel}
Product: ${solution}
Customer: ${customer}
Pain: ${pain}
Price: $${price}
Differentiation: ${defense}

Rules:
- Write for the CUSTOMER, not marketers
- No hype words: no 'amazing', 'revolutionary', 'limited time'
- MUST include price in every variant
- Each variant uses different angle: A=pain-focused, B=solution-focused, C=direct-offer
- Max 4 sentences per variant
- Include clear CTA
- Write in language matching the target market

Respond ONLY in JSON:
{
  "variants": [{"label": "A", "angle": "Pain-focused", "primary_text": "...", "headline": "...", "cta": "..."}],
  "image_direction": "what to photograph",
  "checklist": [{"step": 1, "action": "...", "time_estimate": "2 min", "details": "..."}]
}

No markdown, no extra text.`;

    const response = await callClaude(systemPrompt, 'Generate 3 ad variants and launch checklist JSON.');
    const parsed = parseAIJSON(response) as {
      variants?: Array<{
        label?: string;
        angle?: string;
        primary_text?: string;
        headline?: string;
        cta?: string;
      }>;
      image_direction?: string;
      checklist?: Array<{
        step?: number;
        action?: string;
        time_estimate?: string;
        details?: string;
      }>;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    const variants = (parsed.variants ?? []).slice(0, 3).map((v, i) => {
      const labels = ['A', 'B', 'C'];
      const angles = ['Pain-focused', 'Solution-focused', 'Direct offer'];
      const primary = String(v.primary_text ?? '').trim();
      const hasPrice = price > 0 && primary.includes(`$${price}`);
      return {
        label: String(v.label ?? labels[i]),
        angle: String(v.angle ?? angles[i]),
        primary_text: hasPrice ? primary : `${primary} Price: $${price}`.trim(),
        headline: String(v.headline ?? ''),
        cta: String(v.cta ?? ''),
      };
    });
    if (variants.length < 3) throw new Error('Invalid format: expected 3 variants');

    const checklist = (parsed.checklist ?? []).map((c, i) => ({
      step: Number(c.step ?? i + 1),
      action: String(c.action ?? ''),
      time_estimate: String(c.time_estimate ?? ''),
      details: String(c.details ?? ''),
    }));

    return NextResponse.json({
      variants,
      image_direction: String(parsed.image_direction ?? ''),
      checklist,
    });
  } catch (error) {
    console.error('Flow 8 AI error:', error);
    const message = error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
