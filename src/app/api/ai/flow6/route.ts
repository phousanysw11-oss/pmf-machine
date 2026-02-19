import { NextRequest, NextResponse } from 'next/server';
import { callClaude } from '@/lib/claude';
import { parseAIJSON } from '@/lib/parseAIJSON';
import {
  computeMetrics,
  classifyByRules,
  type RawInputs,
  type ComputedMetrics,
  type SignalItem,
} from '@/lib/signals';
import { saveSignalsBatch, updateExperiment, getExperiment } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      experimentId,
      spend,
      hours_elapsed,
      impressions,
      clicks,
      messages_received,
      orders_placed,
      orders_delivered,
      orders_canceled,
    } = body;

    if (!experimentId || typeof experimentId !== 'string') {
      return NextResponse.json(
        { error: 'experimentId is required' },
        { status: 400 }
      );
    }

    const raw: RawInputs = {
      spend: Number(spend) || 0,
      hours_elapsed: Number(hours_elapsed) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      messages_received: Number(messages_received) || 0,
      orders_placed: Number(orders_placed) || 0,
      orders_delivered: Number(orders_delivered) || 0,
      orders_canceled: Number(orders_canceled) || 0,
    };

    const computed = computeMetrics(raw);
    const ruleItems = classifyByRules(raw, computed);

    const ruleMetrics = new Set(ruleItems.map((r) => r.metric.toLowerCase()));

    const rawStr = JSON.stringify(raw, null, 2);
    const computedStr = JSON.stringify(
      {
        ...computed,
        cpa: computed.cpa === Infinity ? 'INFINITY' : computed.cpa,
      },
      null,
      2
    );

    const systemPrompt = `Classify experiment signals for a COD e-commerce test in Laos.
Be brutally honest. Operators WANT to see good signals.
Never upgrade vanity metrics. 'How much?' questions = WEAK, not STRONG.
1 order from $50 spend might be an accident. Volume matters.

Raw data:
${rawStr}

Computed:
${computedStr}

Time elapsed: ${raw.hours_elapsed}h | Budget spent: $${raw.spend}

Rule-based classifications already applied (do not re-classify): ${ruleItems.map((r) => r.metric).join(', ')}

Classify any REMAINING signals (metrics not in the rule list). Consider: orders_placed, orders_delivered, orders_canceled, messages_received, ctr, cpa, message_to_order_rate, cancel_rate if not already ruled.
Check for absent signals — what should exist by ${raw.hours_elapsed}h but doesn't.

Respond ONLY with valid JSON:
{
  "classifications": [{"metric": "string", "value": number|string, "classification": "NOISE|WEAK|STRONG|PMF", "reason": "string", "action": "string"}],
  "absent_signals": [{"expected_metric": "string", "expected_by": "string", "likely_cause": "string", "severity": "string"}],
  "overall_assessment": "string",
  "signal_quality_score": number,
  "trajectory_pattern": "string" | null
}

No markdown, no extra text.`;

    const response = await callClaude(
      systemPrompt,
      'Classify the experiment signals and provide absent signals.'
    );

    const parsed = parseAIJSON(response) as {
      classifications?: Array<{
        metric: string;
        value: number | string;
        classification: string;
        reason?: string;
        action?: string;
      }>;
      absent_signals?: Array<{
        expected_metric: string;
        expected_by: string;
        likely_cause: string;
        severity: string;
      }>;
      overall_assessment?: string;
      signal_quality_score?: number;
      trajectory_pattern?: string | null;
    } | null;

    if (!parsed) throw new Error('Invalid AI response (expected JSON)');

    const ruleByMetric = new Map(ruleItems.map((r) => [r.metric.toLowerCase(), r]));
    const aiClassifications = (parsed.classifications ?? [])
      .filter((c) => !ruleByMetric.has(String(c.metric).toLowerCase()))
      .map((c) => ({
        metric: c.metric,
        value: c.value,
        classification: c.classification as SignalItem['classification'],
        reason: c.reason ?? '',
        action: c.action ?? '',
        fromRules: false as const,
      }));

    const allClassifications: SignalItem[] = [
      ...ruleItems,
      ...aiClassifications,
    ];

    const absentSignals = (parsed.absent_signals ?? []).map((a) => ({
      expected_metric: a.expected_metric,
      expected_by: a.expected_by,
      likely_cause: a.likely_cause,
      severity: a.severity,
    }));

    const signal_quality_score = Math.min(
      100,
      Math.max(0, Number(parsed.signal_quality_score) ?? 0)
    );
    const overall_assessment = String(parsed.overall_assessment ?? '');
    const trajectory_pattern = parsed.trajectory_pattern ?? null;

    const experiment = await getExperiment(experimentId);
    const existingResults = (experiment.results as Record<string, unknown>) ?? {};
    const checkpoints = (existingResults.checkpoints as Array<Record<string, unknown>>) ?? [];
    checkpoints.push({
      hours_elapsed: raw.hours_elapsed,
      overall_assessment,
      absent_signals: absentSignals,
      signal_quality_score,
      trajectory_pattern,
    });

    await updateExperiment(experimentId, {
      results: { ...existingResults, checkpoints },
    });

    const signalRows = allClassifications.map((c) => ({
      metric_name: c.metric,
      value:
        typeof c.value === 'number'
          ? c.value
          : typeof c.value === 'string' && c.value !== 'INFINITY'
            ? parseFloat(c.value) || 0
            : 0,
      classification: c.classification,
      classified_by: (c as SignalItem).fromRules ? 'rules' : 'ai',
      reason: c.reason ?? '',
      hours_elapsed: raw.hours_elapsed,
    }));

    await saveSignalsBatch(experimentId, signalRows);

    return NextResponse.json({
      classifications: allClassifications,
      absent_signals: absentSignals,
      overall_assessment,
      signal_quality_score,
      trajectory_pattern,
      computed,
    });
  } catch (error) {
    console.error('Flow 6 AI error:', error);
    const message =
      error instanceof Error ? error.message : 'Classification failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
