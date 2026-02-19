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

    if (action === 'recommendations') {
      const { customerProfile, solutionDescription, priceUsd } = body;

      const customer = formatCustomerProfile(customerProfile);
      const solution = (solutionDescription ?? '').toString().trim() || 'Not specified';
      const price = Number(priceUsd) || 0;

      const systemPrompt = `Recommend channels for a COD e-commerce product in Laos.
Customer: "${customer}"
Product: "${solution}"
Price: $${price}

Laos viable channels: Facebook Ads (primary reach), Facebook Marketplace/Groups, TikTok Ads, TikTok Organic, LINE OA, Shopee/Lazada.
Laos weak channels: Google Ads (low search volume), Instagram (low standalone usage), Twitter/X, LinkedIn, Email.

Recommend 2-3 channels. For each: fit_score (1-10), why (2 sentences), format_required, minimum_daily_budget_usd, capabilities_needed (short list), main_risk.
List 1-2 weak channels with specific reason (reason_why_weak).

Respond ONLY with valid JSON:
{"recommended":[{"channel_name":"string","fit_score":number,"why":"string","format_required":"string","minimum_daily_budget_usd":number,"capabilities_needed":"string","main_risk":"string"}],"weak":[{"channel_name":"string","reason_why_weak":"string"}],"channel_risk_summary":"string"}

No markdown, no extra text.`;

      const response = await callClaude(
        systemPrompt,
        `Recommend channels for this product at $${price}.`
      );

      const parsed = parseAIJSON(response) as {
        recommended?: Array<{
          channel_name: string;
          fit_score: number;
          why: string;
          format_required: string;
          minimum_daily_budget_usd: number;
          capabilities_needed: string;
          main_risk: string;
        }>;
        weak?: Array<{
          channel_name: string;
          reason_why_weak: string;
        }>;
        channel_risk_summary?: string;
      } | null;

      if (!parsed) throw new Error('Invalid AI response (expected JSON)');

      const recommended = (parsed.recommended ?? []).slice(0, 3).map((r) => ({
        channel_name: String(r.channel_name ?? ''),
        fit_score: Number(r.fit_score) || 0,
        why: String(r.why ?? ''),
        format_required: String(r.format_required ?? ''),
        minimum_daily_budget_usd: Number(r.minimum_daily_budget_usd) ?? 0,
        capabilities_needed: String(r.capabilities_needed ?? ''),
        main_risk: String(r.main_risk ?? ''),
      }));

      const weak = (parsed.weak ?? []).slice(0, 2).map((w) => ({
        channel_name: String(w.channel_name ?? ''),
        reason_why_weak: String(w.reason_why_weak ?? ''),
      }));

      return NextResponse.json({
        recommended,
        weak,
        channel_risk_summary: String(parsed.channel_risk_summary ?? ''),
      });
    }

    return NextResponse.json(
      { error: 'action must be recommendations' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Flow 5 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
