import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';
import {
  evaluateGates,
  evaluateCriteria,
  ruleRecommendation,
  type ExperimentResults,
  type GatesResult,
} from '@/lib/gates';
import { getExperiment, getSignalsByExperiment } from '@/lib/database';

function buildResultsFromSignals(signals: { metric_name: string; value: number; hours_elapsed?: number }[]): ExperimentResults {
  if (signals.length === 0) return {};

  const byMetric = new Map<string, number>();
  const latestHours = signals[0]?.hours_elapsed ?? 0;
  for (const s of signals) {
    if (s.hours_elapsed === latestHours) {
      byMetric.set(String(s.metric_name).toLowerCase(), Number(s.value));
    }
  }

  const raw: Record<string, number> = {};
  byMetric.forEach((v, k) => {
    raw[k] = v;
  });

  return {
    cpa: raw.cpa,
    ctr: raw.ctr,
    message_to_order_rate: raw.message_to_order_rate,
    orders: raw.orders_placed ?? raw.orders,
    orders_placed: raw.orders_placed ?? raw.orders,
    spend: raw.spend,
    ...raw,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { experimentId } = body;

    if (!experimentId || typeof experimentId !== 'string') {
      return NextResponse.json(
        { error: 'experimentId is required' },
        { status: 400 }
      );
    }

    const experiment = await getExperiment(experimentId);
    const signals = await getSignalsByExperiment(experimentId);

    const results = buildResultsFromSignals(signals);
    const gates = evaluateGates(results);
    const criteria = evaluateCriteria(
      {
        results: experiment.results as Record<string, unknown>,
        hypothesis: experiment.hypothesis as string,
      },
      results
    );

    const killCondition = (experiment.kill_condition as { trigger?: string; timepoint?: string }) ?? {};
    const killTriggered = false;

    const ruleRec = ruleRecommendation(gates, criteria, killTriggered);

    const resultsStr = JSON.stringify(results, null, 2);
    const gatesStr = JSON.stringify(
      gates.gates.map((g) => ({ name: g.name, pass: g.pass, value: g.value })),
      null,
      2
    );
    const res = (experiment.results as Record<string, unknown>) ?? {};
    const checkpoints = (res.checkpoints as Array<{ signal_quality_score?: number }>) ?? [];
    const lastCheckpoint = checkpoints[checkpoints.length - 1];
    const signalQuality = lastCheckpoint?.signal_quality_score ?? 0;
    const successCriteria = (res.success_criteria as string) ?? '';
    const failureCriteria = (res.failure_criteria as string) ?? '';

    const systemPrompt = `Interpret experiment results honestly. You RECOMMEND. You do NOT decide.

Experiment: ${(experiment.hypothesis as string) ?? ''}
Pre-defined success: ${successCriteria}
Pre-defined failure: ${failureCriteria}

Results: ${resultsStr}
Gates: ${gatesStr}
Signal quality: ${signalQuality}

Rules:
- Compare to PRE-DEFINED criteria. Do not invent new success metrics.
- Never use: 'promising', 'encouraging', 'potential'. Use: 'met target', 'missed by X%'.
- If numbers say KILL, recommend KILL.
- FIX must name ONE specific thing to fix.

Respond ONLY with valid JSON:
{
  "result_summary": "string (3-4 sentences, just facts)",
  "hypothesis_verdict": "supported"|"contradicted"|"inconclusive",
  "what_worked": ["string"],
  "what_failed": ["string"],
  "root_cause": "string",
  "recommendation": "GO"|"FIX"|"KILL",
  "confidence": "HIGH"|"MEDIUM"|"LOW",
  "reason": "string",
  "fix_target": "string"|null,
  "next_experiment": "string"|null,
  "learning": "string",
  "money_saved": "string"|null
}

No markdown, no extra text.`;

    const response = await callClaude(
      systemPrompt,
      'Interpret the experiment results and recommend GO, FIX, or KILL.'
    );

    const parsed = parseAIJSON(response) as {
      result_summary?: string;
      hypothesis_verdict?: string;
      what_worked?: string[];
      what_failed?: string[];
      root_cause?: string;
      recommendation?: string;
      confidence?: string;
      reason?: string;
      fix_target?: string | null;
      next_experiment?: string | null;
      learning?: string;
      money_saved?: string | null;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    return NextResponse.json({
      gates,
      criteria,
      ruleRecommendation: ruleRec,
      result_summary: String(parsed.result_summary ?? ''),
      hypothesis_verdict: parsed.hypothesis_verdict ?? 'inconclusive',
      what_worked: Array.isArray(parsed.what_worked) ? parsed.what_worked : [],
      what_failed: Array.isArray(parsed.what_failed) ? parsed.what_failed : [],
      root_cause: String(parsed.root_cause ?? ''),
      recommendation: parsed.recommendation ?? 'FIX',
      confidence: parsed.confidence ?? 'MEDIUM',
      reason: String(parsed.reason ?? ''),
      fix_target: parsed.fix_target ?? null,
      next_experiment: parsed.next_experiment ?? null,
      learning: String(parsed.learning ?? ''),
      money_saved: parsed.money_saved ?? null,
      results,
    });
  } catch (error) {
    console.error('Flow 9 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'Interpretation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
