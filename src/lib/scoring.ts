/**
 * PMF Machine Flow 10 — Rule-based scoring engine (no AI).
 * Aggregates all flow data, experiments, signals, and decisions into a 0–100 PMF score.
 */

import { evaluateGates, type ExperimentResults } from './gates';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type FlowDataRecord = {
  flow_number: number;
  data: Record<string, unknown>;
  penalties?: number;
  override_applied?: boolean;
  locked?: boolean;
};

export type ExperimentRecord = {
  id: string;
  hypothesis?: string;
  results?: Record<string, unknown>;
  primary_metric?: Record<string, unknown>;
  verdict?: string;
  status?: string;
};

export type SignalRecord = {
  experiment_id: string;
  metric_name?: string;
  value?: number;
  classification?: string;
  hours_elapsed?: number;
};

export type DecisionRecord = {
  experiment_id?: string;
  human_decision?: string;
  override_penalty?: number;
};

export type ConsistencyInput = {
  cpa_stability_pct?: number; // e.g. 15 = within 15% variance
  net_margin_pct?: number;
  cancel_rate_pct?: number;
  repeat_buyer_pct?: number;
  sean_ellis_pct?: number | null; // optional, skip if null
};

export type ScoringInput = {
  allFlowData: FlowDataRecord[];
  experiments: ExperimentRecord[];
  signals: SignalRecord[];
  decisions: DecisionRecord[];
  consistency?: ConsistencyInput;
  /** Committed price USD for hard kills (CPA > 50% of price). */
  committedPriceUsd?: number;
  /** Latest signal quality 0–100 from Flow 6 (or derived). */
  signalQualityScore?: number;
  /** Whether signals are accelerating (e.g. improving over time). */
  acceleratingSignals?: boolean;
};

export type FoundationBreakdown = {
  pain: { score: number; max: number; label: string };
  customer: { score: number; max: number; label: string };
  solution: { score: number; max: number; label: string };
  price: { score: number; max: number; label: string };
  channel: { score: number; max: number; label: string };
  total: number;
  max: number;
};

export type ExperimentBreakdown = {
  primary_metric: { score: number; max: number; label: string };
  gates: { score: number; max: number; label: string; passCount?: number };
  signal_quality: { score: number; max: number; label: string };
  integrity: { score: number; max: number; label: string };
  total: number;
  max: number;
};

export type ConsistencyBreakdown = {
  cpa_stability: { score: number; max: number; label: string };
  net_margin: { score: number; max: number; label: string };
  cancel_rate: { score: number; max: number; label: string };
  repeat_buyers: { score: number; max: number; label: string };
  sean_ellis: { score: number; max: number; label: string; skipped?: boolean };
  total: number;
  max: number;
};

export type ScoringResult = {
  pmf_score: number;
  verdict: 'PMF_CONFIRMED' | 'PMF_PARTIAL' | 'NO_PMF';
  hard_kill_applied: string | null;
  foundation: FoundationBreakdown;
  experiment: ExperimentBreakdown;
  consistency: ConsistencyBreakdown;
  total_penalty: number;
  penalty_cap_applied: boolean;
  total_modifiers: number;
  modifier_cap_applied: boolean;
  penalty_sources: { flow: number; penalty: number }[];
  modifier_sources: { reason: string; value: number }[];
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getFlow(productId: string, flowData: FlowDataRecord[], flowNumber: number): FlowDataRecord | undefined {
  return flowData.find((f) => f.flow_number === flowNumber);
}

function getFlowData(flowData: FlowDataRecord[], flowNumber: number): Record<string, unknown> {
  return getFlow('', flowData, flowNumber)?.data ?? {};
}

// -----------------------------------------------------------------------------
// Foundation (max 40)
// -----------------------------------------------------------------------------

function scoreFoundation(flowData: FlowDataRecord[]): FoundationBreakdown {
  const f1 = getFlowData(flowData, 1);
  const f2 = getFlowData(flowData, 2);
  const f3 = getFlowData(flowData, 3);
  const f4 = getFlowData(flowData, 4);
  const f5 = getFlowData(flowData, 5);

  const f1Locked = getFlow('', flowData, 1)?.locked ?? false;
  const f2Locked = getFlow('', flowData, 2)?.locked ?? false;
  const f3Locked = getFlow('', flowData, 3)?.locked ?? false;
  const f4Locked = getFlow('', flowData, 4)?.locked ?? false;
  const f5Locked = getFlow('', flowData, 5)?.locked ?? false;

  // Pain (max 10): HIGH=10, GUESS=5, SKIPPED=0
  const painConf = (f1.confidence as string) ?? '';
  let painScore = 0;
  let painLabel = 'Skipped';
  if (f1Locked) {
    if (painConf === 'customers' || painConf === 'observed') {
      painScore = 10;
      painLabel = 'High (evidence-based)';
    } else if (painConf === 'guess') {
      painScore = 5;
      painLabel = 'Guess';
    }
  }

  // Customer (max 10): HIGH=10, GUESS=5, SKIPPED=0
  const f2Penalty = (getFlow('', flowData, 2)?.penalties as number) ?? 0;
  let customerScore = 0;
  let customerLabel = 'Skipped';
  if (f2Locked) {
    if (f2Penalty > 0) {
      customerScore = 5;
      customerLabel = 'Guess';
    } else {
      customerScore = 10;
      customerLabel = 'High';
    }
  }

  // Solution (max 10): STRONG=10, WEAK=5, NONE+override=2
  const verdict = (f3.ai_verdict as { verdict?: string })?.verdict ?? '';
  const f3Override = getFlow('', flowData, 3)?.override_applied ?? false;
  let solutionScore = 0;
  let solutionLabel = 'Skipped';
  if (f3Locked) {
    if (verdict === 'STRONG') {
      solutionScore = 10;
      solutionLabel = 'Strong';
    } else if (verdict === 'WEAK') {
      solutionScore = 5;
      solutionLabel = 'Weak';
    } else if (verdict === 'NONE' && f3Override) {
      solutionScore = 2;
      solutionLabel = 'None (override)';
    }
  }

  // Price (max 5): HONEST=5, CONTRADICTED+downgraded=4, CONTRADICTED+defended=2
  const honestyVerdict = (f4.honesty_verdict as { verdict?: string })?.verdict ?? '';
  const f4Override = getFlow('', flowData, 4)?.override_applied ?? false;
  let priceScore = 0;
  let priceLabel = 'Skipped';
  if (f4Locked) {
    if (honestyVerdict === 'HONEST') {
      priceScore = 5;
      priceLabel = 'Honest';
    } else if (honestyVerdict === 'CONTRADICTED' && !f4Override) {
      priceScore = 4;
      priceLabel = 'Contradicted (downgraded)';
    } else if (honestyVerdict === 'CONTRADICTED' && f4Override) {
      priceScore = 2;
      priceLabel = 'Contradicted (defended)';
    }
  }

  // Channel (max 5): recommended+capable=5, recommended+gaps_resolved=4, weak_override=2
  const f5PickedFromWeak = !!(f5.picked_from_weak as boolean);
  const f5CapabilityComplete = !!(f5.capability_complete as boolean) || !!(f5.checklist_complete as boolean);
  let channelScore = 0;
  let channelLabel = 'Skipped';
  if (f5Locked) {
    if (f5PickedFromWeak) {
      channelScore = 2;
      channelLabel = 'Weak override';
    } else if (f5CapabilityComplete) {
      channelScore = 5;
      channelLabel = 'Recommended + capable';
    } else {
      channelScore = 4;
      channelLabel = 'Recommended + gaps resolved';
    }
  }

  const total = painScore + customerScore + solutionScore + priceScore + channelScore;
  return {
    pain: { score: painScore, max: 10, label: painLabel },
    customer: { score: customerScore, max: 10, label: customerLabel },
    solution: { score: solutionScore, max: 10, label: solutionLabel },
    price: { score: priceScore, max: 5, label: priceLabel },
    channel: { score: channelScore, max: 5, label: channelLabel },
    total,
    max: 40,
  };
}

// -----------------------------------------------------------------------------
// Experiment (max 30) — use best GO experiment if multiple
// -----------------------------------------------------------------------------

function buildResultsFromSignals(signals: SignalRecord[], experimentId: string): ExperimentResults {
  const byMetric = new Map<string, number>();
  const expSignals = signals.filter((s) => s.experiment_id === experimentId);
  const latestHours = expSignals.length
    ? Math.max(...expSignals.map((s) => Number(s.hours_elapsed) || 0))
    : 0;
  for (const s of expSignals) {
    if (Number(s.hours_elapsed) === latestHours) {
      const k = String(s.metric_name ?? '').toLowerCase();
      byMetric.set(k, Number(s.value) ?? 0);
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

function scoreExperiment(
  flowData: FlowDataRecord[],
  experiments: ExperimentRecord[],
  signals: SignalRecord[],
  decisions: DecisionRecord[],
  signalQualityScore: number
): ExperimentBreakdown {
  const goDecisions = decisions.filter((d) => d.human_decision === 'GO');
  const goExperimentIds = new Set(goDecisions.map((d) => d.experiment_id).filter(Boolean));

  let bestGatesPassCount = 0;
  let primaryMetricScore = 0;
  let primaryMetricLabel = 'No GO experiment';

  for (const exp of experiments) {
    if (!goExperimentIds.has(exp.id)) continue;
    const results = buildResultsFromSignals(signals, exp.id);
    const gates = evaluateGates(results);
    if (gates.passCount > bestGatesPassCount) bestGatesPassCount = gates.passCount;

    const primaryMetric = (exp.primary_metric as { target?: string; value?: number }) ?? {};
    const target = primaryMetric.target ?? 'orders';
    const val = results.orders ?? results.orders_placed ?? 0;
    if (target.toLowerCase().includes('order')) {
      if (val >= 3) primaryMetricScore = Math.max(primaryMetricScore, 10);
      else if (val >= 1) primaryMetricScore = Math.max(primaryMetricScore, 7);
      else if (val > 0) primaryMetricScore = Math.max(primaryMetricScore, 3);
    }
  }

  if (goDecisions.length === 0 && experiments.length > 0) {
    const latest = experiments[0];
    const results = buildResultsFromSignals(signals, latest.id);
    const gates = evaluateGates(results);
    bestGatesPassCount = gates.passCount;
    primaryMetricLabel = 'No verdict yet';
  } else if (goDecisions.length > 0) {
    if (primaryMetricScore >= 10) primaryMetricLabel = 'Met';
    else if (primaryMetricScore >= 7) primaryMetricLabel = 'Near';
    else if (primaryMetricScore >= 3) primaryMetricLabel = 'Missed';
    else primaryMetricLabel = 'Zero';
  }

  const gatesScore =
    bestGatesPassCount >= 4 ? 10 : bestGatesPassCount >= 3 ? 7 : bestGatesPassCount >= 2 ? 4 : 0;
  const gatesLabel = `${bestGatesPassCount}/4 gates`;

  const sq =
    signalQualityScore >= 60 ? 5 : signalQualityScore >= 40 ? 3 : signalQualityScore >= 20 ? 1 : 0;
  const signalQualityLabel =
    signalQualityScore >= 60 ? 'High (≥60)' : signalQualityScore >= 40 ? 'Medium (40–59)' : signalQualityScore >= 20 ? 'Low (20–39)' : 'Very low (<20)';

  const killIgnored = decisions.some(
    (d) => d.human_decision === 'GO' && (d as { ai_recommendation?: string })?.ai_recommendation === 'KILL'
  );
  const overrides = decisions.filter((d) => (d as { override_applied?: boolean })?.override_applied);
  let integrityScore = 5;
  let integrityLabel = 'Full, complete';
  if (killIgnored) {
    integrityScore = 1;
    integrityLabel = 'Kill ignored';
  } else if (overrides.length > 2) {
    integrityScore = 2;
    integrityLabel = 'Minimum';
  } else if (overrides.length > 0) {
    integrityScore = 3;
    integrityLabel = 'Simplified';
  }

  const expTotal = primaryMetricScore + gatesScore + sq + integrityScore;
  return {
    primary_metric: {
      score: primaryMetricScore,
      max: 10,
      label: primaryMetricLabel,
    },
    gates: { score: gatesScore, max: 10, label: gatesLabel, passCount: bestGatesPassCount },
    signal_quality: { score: sq, max: 5, label: signalQualityLabel },
    integrity: { score: integrityScore, max: 5, label: integrityLabel },
    total: expTotal,
    max: 30,
  };
}

// -----------------------------------------------------------------------------
// Consistency (max 30)
// -----------------------------------------------------------------------------

function scoreConsistency(consistency: ConsistencyInput | undefined): ConsistencyBreakdown {
  const c = consistency ?? {};
  const cpaStability = c.cpa_stability_pct ?? 100;
  const netMargin = c.net_margin_pct ?? 0;
  const cancelRate = c.cancel_rate_pct ?? 0;
  const repeatBuyers = c.repeat_buyer_pct ?? 0;
  const seanEllis = c.sean_ellis_pct ?? null;

  const cpaScore =
    cpaStability >= 80 ? 8 : cpaStability >= 70 ? 5 : 2;
  const marginScore =
    netMargin >= 30 ? 8 : netMargin >= 20 ? 5 : netMargin >= 15 ? 2 : 0;
  const cancelScore =
    cancelRate <= 20 ? 5 : cancelRate <= 30 ? 3 : cancelRate <= 40 ? 1 : 0;
  const repeatScore =
    repeatBuyers >= 15 ? 5 : repeatBuyers >= 10 ? 3 : repeatBuyers >= 5 ? 1 : 0;
  let seanScore = 0;
  let seanSkipped = true;
  if (seanEllis != null && !Number.isNaN(seanEllis)) {
    seanSkipped = false;
    seanScore = seanEllis >= 40 ? 4 : seanEllis >= 25 ? 2 : 0;
  }

  const total = cpaScore + marginScore + cancelScore + repeatScore + seanScore;
  return {
    cpa_stability: {
      score: cpaScore,
      max: 8,
      label: `Within ${100 - cpaStability}% variance`,
    },
    net_margin: { score: marginScore, max: 8, label: `${netMargin}%` },
    cancel_rate: { score: cancelScore, max: 5, label: `${cancelRate}%` },
    repeat_buyers: { score: repeatScore, max: 5, label: `${repeatBuyers}%` },
    sean_ellis: { score: seanScore, max: 4, label: seanSkipped ? 'No data' : `${seanEllis}%`, skipped: seanSkipped },
    total,
    max: 30,
  };
}

// -----------------------------------------------------------------------------
// Penalties & Modifiers
// -----------------------------------------------------------------------------

const PENALTY_CAP = 40;
const MODIFIER_CAP = 15;

function sumPenalties(
  flowData: FlowDataRecord[],
  decisions: DecisionRecord[]
): {
  total: number;
  capped: boolean;
  sources: { flow: number; penalty: number }[];
} {
  const sources: { flow: number; penalty: number }[] = [];
  let total = 0;
  for (const f of flowData) {
    const p = Math.abs((f.penalties ?? 0) as number);
    if (p > 0) {
      sources.push({ flow: f.flow_number, penalty: -p });
      total += p;
    }
  }
  for (const d of decisions ?? []) {
    const p = Math.abs((d.override_penalty ?? 0) as number);
    if (p > 0) {
      sources.push({ flow: 9, penalty: -p });
      total += p;
    }
  }
  const capped = total > PENALTY_CAP;
  return {
    total: -Math.min(total, PENALTY_CAP),
    capped,
    sources,
  };
}

function sumModifiers(
  acceleratingSignals: boolean,
  signalQualityScore: number
): { total: number; capped: boolean; sources: { reason: string; value: number }[] } {
  const sources: { reason: string; value: number }[] = [];
  if (acceleratingSignals) sources.push({ reason: 'Accelerating signals', value: 5 });
  if (signalQualityScore >= 60) sources.push({ reason: 'High signal quality', value: 5 });
  const total = sources.reduce((s, x) => s + x.value, 0);
  const capped = total > MODIFIER_CAP;
  return {
    total: Math.min(total, MODIFIER_CAP),
    capped,
    sources,
  };
}

// -----------------------------------------------------------------------------
// Hard kills
// -----------------------------------------------------------------------------

function checkHardKills(
  experiments: ExperimentRecord[],
  signals: SignalRecord[],
  consistency: ConsistencyInput | undefined,
  committedPriceUsd: number
): string | null {
  const c = consistency ?? {};
  const netMargin = c.net_margin_pct ?? 0;
  const cancelRate = c.cancel_rate_pct ?? 0;

  if (c.net_margin_pct != null && netMargin < 15) return 'Net margin < 15%';
  if (c.cancel_rate_pct != null && cancelRate > 50) return 'Cancel rate > 50%';

  let totalOrders = 0;
  let maxCpa = 0;
  for (const exp of experiments) {
    const results = buildResultsFromSignals(signals, exp.id);
    const orders = results.orders ?? results.orders_placed ?? 0;
    totalOrders += orders;
    const cpa = results.cpa ?? (orders > 0 ? (results.spend ?? 0) / orders : Infinity);
    if (cpa !== Infinity && cpa > maxCpa) maxCpa = cpa;
  }
  if (experiments.length > 0 && totalOrders === 0) return 'Zero orders across all experiments';
  if (committedPriceUsd > 0 && maxCpa > committedPriceUsd * 0.5) return 'CPA > 50% of price';

  return null;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

export function computePMFScore(input: ScoringInput): ScoringResult {
  const {
    allFlowData,
    experiments,
    signals,
    decisions,
    consistency,
    committedPriceUsd = 0,
    signalQualityScore = 0,
    acceleratingSignals = false,
  } = input;

  const foundation = scoreFoundation(allFlowData);
  const experiment = scoreExperiment(
    allFlowData,
    experiments,
    signals,
    decisions,
    signalQualityScore
  );
  const consistencyBreakdown = scoreConsistency(consistency);
  const penaltyResult = sumPenalties(allFlowData, decisions ?? []);
  const modifierResult = sumModifiers(acceleratingSignals, signalQualityScore);

  const hardKill = checkHardKills(experiments, signals, consistency, committedPriceUsd);

  let rawScore =
    foundation.total +
    experiment.total +
    consistencyBreakdown.total +
    penaltyResult.total +
    modifierResult.total;

  let verdict: 'PMF_CONFIRMED' | 'PMF_PARTIAL' | 'NO_PMF' =
    rawScore >= 70 ? 'PMF_CONFIRMED' : rawScore >= 50 ? 'PMF_PARTIAL' : 'NO_PMF';

  if (hardKill) {
    rawScore = Math.min(rawScore, 49);
    verdict = 'NO_PMF';
  }

  const pmf_score = Math.max(0, Math.min(100, Math.round(rawScore)));

  return {
    pmf_score,
    verdict,
    hard_kill_applied: hardKill,
    foundation,
    experiment,
    consistency: consistencyBreakdown,
    total_penalty: penaltyResult.total,
    penalty_cap_applied: penaltyResult.capped,
    total_modifiers: modifierResult.total,
    modifier_cap_applied: modifierResult.capped,
    penalty_sources: penaltyResult.sources,
    modifier_sources: modifierResult.sources,
  };
}
