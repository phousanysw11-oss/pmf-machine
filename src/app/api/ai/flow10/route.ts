import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { computePMFScore, type ScoringResult } from '@/lib/scoring';
import { parseAIJSON } from '@/lib/parseAIJSON';
import {
  getProduct,
  getProductFlows,
  getExperiments,
  getDecisionsByProduct,
  getSignalsForProduct,
} from '@/lib/database';
import type { FlowDataRecord } from '@/lib/scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { productId } = body;

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const [product, flowRows, experiments, decisions, signals] = await Promise.all([
      getProduct(productId),
      getProductFlows(productId),
      getExperiments(productId),
      getDecisionsByProduct(productId),
      getSignalsForProduct(productId),
    ]);

    const allFlowData: FlowDataRecord[] = (flowRows ?? []).map((row: Record<string, unknown>) => ({
      flow_number: row.flow_number as number,
      data: (row.data as Record<string, unknown>) ?? {},
      penalties: row.penalties as number,
      override_applied: row.override_applied as boolean,
      locked: row.locked as boolean,
    }));

    const flow4Data = allFlowData.find((f) => f.flow_number === 4)?.data ?? {};
    const flow6Data = allFlowData.find((f) => f.flow_number === 6)?.data ?? {};
    const committedPriceUsd = Number(flow4Data.committed_price_usd) || 0;

    const signalQualityScore = Number(flow6Data.signal_quality_score) || 0;
    const acceleratingSignals = !!(flow6Data.accelerating_signals as boolean);

    const consistency = undefined;

    const result = computePMFScore({
      allFlowData,
      experiments: (experiments ?? []) as Parameters<typeof computePMFScore>[0]['experiments'],
      signals: (signals ?? []) as Parameters<typeof computePMFScore>[0]['signals'],
      decisions: (decisions ?? []).map((d: Record<string, unknown>) => ({
        experiment_id: typeof d.experiment_id === 'string' ? d.experiment_id : undefined,
        human_decision: typeof d.human_decision === 'string' ? d.human_decision : undefined,
        override_penalty: Number(d.override_penalty) || 0,
        override_applied: Boolean(d.override_applied),
        ai_recommendation: typeof d.ai_recommendation === 'string' ? d.ai_recommendation : undefined,
      })),
      consistency,
      committedPriceUsd,
      signalQualityScore,
      acceleratingSignals,
    });

    const aiSummary = await getAISummary(productId, product, result, experiments, decisions);

    return NextResponse.json({
      ...result,
      ai_summary: aiSummary,
    });
  } catch (error) {
    console.error('Flow 10 error:', error);
    const message =
      error instanceof Error ? error.message : 'Scoring failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getAISummary(
  productId: string,
  product: Record<string, unknown>,
  result: ScoringResult,
  experiments: Record<string, unknown>[],
  decisions: Record<string, unknown>[]
) {
  const conf =
    result.verdict === 'PMF_CONFIRMED'
      ? 'HIGH'
      : result.verdict === 'PMF_PARTIAL'
        ? 'MEDIUM'
        : 'LOW';

  const componentDetails = [
    `Foundation: ${result.foundation.total}/${result.foundation.max}`,
    `  Pain ${result.foundation.pain.score}/10, Customer ${result.foundation.customer.score}/10, Solution ${result.foundation.solution.score}/10, Price ${result.foundation.price.score}/5, Channel ${result.foundation.channel.score}/5`,
    `Experiment: ${result.experiment.total}/${result.experiment.max}`,
    `  Primary metric ${result.experiment.primary_metric.score}/10, Gates ${result.experiment.gates.score}/10, Signal quality ${result.experiment.signal_quality.score}/5, Integrity ${result.experiment.integrity.score}/5`,
    `Consistency: ${result.consistency.total}/${result.consistency.max}`,
    `Penalties: ${result.total_penalty}, Modifiers: +${result.total_modifiers}`,
  ].join('\n');

  const productHistory = [
    `Experiments: ${experiments.length}`,
    `Decisions: ${decisions.map((d) => `${d.human_decision}`).join(', ') || 'none'}`,
    `Spend/days: (from signals if needed)`,
  ].join('\n');

  const systemPrompt = `You are the PMF Machine final verdict summarizer. Generate the final PMF verdict summary. Simple language. One clear recommendation.

Score: ${result.pmf_score}/100 | Verdict: ${result.verdict} | Confidence: ${conf}
Breakdown: Foundation ${result.foundation.total}/40, Experiment ${result.experiment.total}/30, Consistency ${result.consistency.total}/30, Penalties ${result.total_penalty}, Modifiers +${result.total_modifiers}

Component details:
${componentDetails}

Product: ${(product.name as string) ?? productId}
Product history:
${productHistory}

Respond in JSON only, no markdown:
{
  "one_line_summary": "string",
  "strengths": ["string", "string", "string"],
  "risks": ["string", "string", "string"],
  "score_explanation": "string (3-4 sentences, plain language)",
  "recommended_next": "string (specific actionable steps)",
  "gap_analysis": "string or null (if PARTIAL, what to fix)"
}`;

  try {
    const response = await callClaude(
      systemPrompt,
      'Generate the final PMF verdict summary JSON.'
    );
    const parsed = parseAIJSON(response) as {
      one_line_summary?: string;
      strengths?: string[];
      risks?: string[];
      score_explanation?: string;
      recommended_next?: string;
      gap_analysis?: string | null;
    } | null;
    if (!parsed) throw new Error('Invalid AI response (expected JSON)');
    return {
      one_line_summary: String(parsed.one_line_summary ?? ''),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      score_explanation: String(parsed.score_explanation ?? ''),
      recommended_next: String(parsed.recommended_next ?? ''),
      gap_analysis: parsed.gap_analysis ?? null,
    };
  } catch (err) {
    console.error('Flow 10 AI summary error:', err);
    return {
      one_line_summary: `Score ${result.pmf_score}/100 — ${result.verdict}. ${result.hard_kill_applied ? `Hard kill: ${result.hard_kill_applied}.` : ''}`,
      strengths: [],
      risks: [],
      score_explanation: 'AI summary could not be generated.',
      recommended_next: result.verdict === 'PMF_CONFIRMED' ? 'Proceed to scale.' : result.verdict === 'PMF_PARTIAL' ? 'Fix gaps and re-prove.' : 'Kill or pivot.',
      gap_analysis: result.verdict === 'PMF_PARTIAL' ? 'Review breakdown and fix weakest components.' : null,
    };
  }
}
