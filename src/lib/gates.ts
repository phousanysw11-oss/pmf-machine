/**
 * Gate evaluation and rule-based recommendation for PMF Machine Flow 9.
 */

export type GateResult = {
  name: string;
  pass: boolean;
  value: number;
  threshold: string;
};

export type GatesResult = {
  passCount: number;
  gates: GateResult[];
};

export type CriteriaVerdict = 'SUCCESS' | 'FAILURE' | 'CONTRADICTORY' | 'AMBIGUOUS';

export type RuleRecommendation = {
  recommendation: 'GO' | 'FIX' | 'KILL';
  confidence: 'HIGH' | 'MEDIUM';
  reason: string;
};

export type ExperimentResults = {
  cpa?: number;
  ctr?: number;
  message_to_order_rate?: number;
  orders?: number;
  orders_placed?: number;
  spend?: number;
  [key: string]: number | undefined;
};

const GATE_1_CPA_MAX = 2.5;
const GATE_2_CTR_MIN = 1;
const GATE_3_MESSAGE_ORDER_MIN = 30;
const GATE_4_ORDERS_MIN = 3;

/**
 * Evaluate the 4 gates against results.
 */
export function evaluateGates(results: ExperimentResults): GatesResult {
  const cpa = results.cpa ?? results.orders_placed
    ? (results.spend ?? 0) / Math.max(1, results.orders_placed ?? 0)
    : Infinity;
  const ctr = results.ctr ?? 0;
  const messageToOrder = (results.message_to_order_rate ?? 0) * 100;
  const orders = results.orders ?? results.orders_placed ?? 0;

  const gates: GateResult[] = [
    {
      name: 'CPA ≤ $2.50',
      pass: cpa !== Infinity && cpa <= GATE_1_CPA_MAX,
      value: cpa === Infinity ? 0 : cpa,
      threshold: `≤ ${GATE_1_CPA_MAX}`,
    },
    {
      name: 'CTR ≥ 1%',
      pass: ctr >= GATE_2_CTR_MIN,
      value: ctr,
      threshold: `≥ ${GATE_2_CTR_MIN}%`,
    },
    {
      name: 'Message-to-Order ≥ 30%',
      pass: messageToOrder >= GATE_3_MESSAGE_ORDER_MIN,
      value: messageToOrder,
      threshold: `≥ ${GATE_3_MESSAGE_ORDER_MIN}%`,
    },
    {
      name: 'Orders ≥ 3',
      pass: orders >= GATE_4_ORDERS_MIN,
      value: orders,
      threshold: `≥ ${GATE_4_ORDERS_MIN}`,
    },
  ];

  const passCount = gates.filter((g) => g.pass).length;

  return { passCount, gates };
}

type ExperimentWithCriteria = {
  results?: Record<string, unknown>;
  hypothesis?: string;
};

/**
 * Compare results to experiment success/failure criteria.
 * Parses criteria from experiment.results (success_criteria, failure_criteria).
 */
export function evaluateCriteria(
  experiment: ExperimentWithCriteria,
  results: ExperimentResults
): CriteriaVerdict {
  const res = (experiment.results as Record<string, unknown>) ?? {};
  const successStr = (res.success_criteria as string) ?? '';
  const failureStr = (res.failure_criteria as string) ?? '';

  if (!successStr && !failureStr) return 'AMBIGUOUS';

  const orders = results.orders ?? results.orders_placed ?? 0;
  const cpa = results.cpa ?? (results.orders_placed ? (results.spend ?? 0) / Math.max(1, results.orders_placed) : Infinity);
  const ctr = results.ctr ?? 0;

  let successMet = false;
  let failureMet = false;

  if (successStr) {
    if (/\d+\+?\s*orders?/i.test(successStr) && orders >= 3) successMet = true;
    if (/cpa|cost.*per/i.test(successStr) && cpa <= 2.5) successMet = true;
    if (/ctr|click/i.test(successStr) && ctr >= 1) successMet = true;
    if (/message.*order|conversion/i.test(successStr)) {
      const rate = (results.message_to_order_rate ?? 0) * 100;
      if (rate >= 30) successMet = true;
    }
  }

  if (failureStr) {
    if (/zero\s*orders?|no\s*orders?/i.test(failureStr) && orders === 0) failureMet = true;
    if (/0\s*orders?/i.test(failureStr) && orders === 0) failureMet = true;
  }

  if (successMet && failureMet) return 'CONTRADICTORY';
  if (successMet) return 'SUCCESS';
  if (failureMet) return 'FAILURE';
  return 'AMBIGUOUS';
}

/**
 * Rule-based recommendation from gates, criteria, and kill trigger.
 */
export function ruleRecommendation(
  gates: GatesResult,
  criteria: CriteriaVerdict,
  killTriggered: boolean
): RuleRecommendation {
  if (killTriggered) {
    return {
      recommendation: 'KILL',
      confidence: 'HIGH',
      reason: 'Kill condition was triggered.',
    };
  }

  if (criteria === 'SUCCESS' && gates.passCount >= 3) {
    return {
      recommendation: 'GO',
      confidence: 'HIGH',
      reason: `Success criteria met with ${gates.passCount} gates passed.`,
    };
  }

  if (criteria === 'FAILURE' && gates.passCount <= 1) {
    return {
      recommendation: 'KILL',
      confidence: 'MEDIUM',
      reason: 'Failure criteria met with 1 or fewer gates passed.',
    };
  }

  if (criteria === 'CONTRADICTORY' || criteria === 'AMBIGUOUS') {
    return {
      recommendation: 'FIX',
      confidence: 'MEDIUM',
      reason: `Criteria verdict: ${criteria}. Needs clarification.`,
    };
  }

  if (gates.passCount === 2) {
    return {
      recommendation: 'FIX',
      confidence: 'MEDIUM',
      reason: '2 gates passed — partial success, fix and retest.',
    };
  }

  return {
    recommendation: 'KILL',
    confidence: 'MEDIUM',
    reason: 'Insufficient gates passed and criteria not met.',
  };
}
