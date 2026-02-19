import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      uncertainty,
      painText,
      customerSummary,
      solutionDescription,
      priceUsd,
      channelName,
      simplerVersion,
      blockingReason,
      previousSpec,
    } = body;

    if (!uncertainty || typeof uncertainty !== 'object') {
      return NextResponse.json(
        { error: 'uncertainty is required' },
        { status: 400 }
      );
    }

    const question = (uncertainty.question as string) ?? 'Biggest unknown';
    const pain = (painText ?? '').toString().trim() || 'Not specified';
    const customer = (customerSummary ?? '').toString().trim() || 'Not specified';
    const solution = (solutionDescription ?? '').toString().trim() || 'Not specified';
    const price = Number(priceUsd) || 0;
    const channel = (channelName ?? '').toString().trim() || 'Not specified';

    const systemPrompt = simplerVersion
      ? `The operator cannot execute the previous experiment. Blocker: "${(blockingReason ?? '').toString().trim()}"

Previous spec (for reference): ${JSON.stringify(previousSpec ?? {})}

Design a SIMPLER version of the experiment that avoids this blocker. Same uncertainty to test. Rules:
- Minimum viable: e.g. conversation test, $0 budget, 1-2 steps.
- Still testable and specific.
- Executable with a smartphone only.
Respond in the same JSON format as the main experiment design.`
      : `Design ONE experiment for a COD e-commerce test in Laos.
Biggest uncertainty: ${question}
Pain: ${pain} | Customer: ${customer} | Product: ${solution} | Price: $${price} | Channel: ${channel}

Rules:
- ONE experiment. Not two.
- Every step must be executable by a non-marketer with a smartphone.
- Include EXACT navigation instructions (which button to click, where to look).
- Kill condition must be specific and early (at 24h, not 72h).
- Budget must be realistic for Laos ($15-50 total).

Respond ONLY with valid JSON:
{
  "hypothesis": "string",
  "null_hypothesis": "string",
  "setup_steps": [{"step_number": 1, "action": "string", "time_estimate": "string", "requires": "string", "done_when": "string"}],
  "primary_metric": {"name": "string", "how_to_measure": "string", "target": "string", "unit": "string"},
  "secondary_metrics": [{"name": "string", "how_to_measure": "string", "target": "string"}],
  "kill_condition": {"trigger": "string", "timepoint": "string", "action": "string"},
  "time_limit_hours": number,
  "budget_limit_usd": number,
  "success_criteria": "string",
  "failure_criteria": "string",
  "ambiguous_criteria": "string"
}

No markdown, no extra text.`;

    const userMessage = simplerVersion
      ? `Design a simpler experiment given the blocker.`
      : `Design one experiment for the uncertainty: ${question}`;

    const response = await callClaude(systemPrompt, userMessage);

    const parsed = parseAIJSON(response) as {
      hypothesis?: string;
      null_hypothesis?: string;
      setup_steps?: Array<{
        step_number: number;
        action: string;
        time_estimate: string;
        requires: string;
        done_when: string;
      }>;
      primary_metric?: {
        name: string;
        how_to_measure: string;
        target: string;
        unit: string;
      };
      secondary_metrics?: Array<{ name: string; how_to_measure: string; target: string }>;
      kill_condition?: { trigger: string; timepoint: string; action: string };
      time_limit_hours?: number;
      budget_limit_usd?: number;
      success_criteria?: string;
      failure_criteria?: string;
      ambiguous_criteria?: string;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    const experiment = {
      hypothesis: String(parsed.hypothesis ?? ''),
      null_hypothesis: String(parsed.null_hypothesis ?? ''),
      setup_steps: Array.isArray(parsed.setup_steps) ? parsed.setup_steps : [],
      primary_metric: parsed.primary_metric ?? {},
      secondary_metrics: Array.isArray(parsed.secondary_metrics) ? parsed.secondary_metrics : [],
      kill_condition: parsed.kill_condition ?? {},
      time_limit_hours: Number(parsed.time_limit_hours) || 24,
      budget_limit_usd: Number(parsed.budget_limit_usd) ?? 0,
      success_criteria: String(parsed.success_criteria ?? ''),
      failure_criteria: String(parsed.failure_criteria ?? ''),
      ambiguous_criteria: String(parsed.ambiguous_criteria ?? ''),
    };

    return NextResponse.json(experiment);
  } catch (error) {
    console.error('Flow 7 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'AI request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
