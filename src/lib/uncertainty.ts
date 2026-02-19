/**
 * Uncertainty ranking engine for PMF Machine.
 * Reads flow 1-5 data and extracts ranked uncertainties for experiment design.
 */

export type FlowDataRecord = {
  flow_number: number;
  data: Record<string, unknown>;
  locked?: boolean;
  penalties?: number;
};

export type Uncertainty = {
  type: string;
  weight: number;
  question: string;
};

const TIEBREAKER_ORDER: Record<string, number> = {
  PRICE_OPTIMISTIC: 0,
  PRICE_AGGRESSIVE: 0,
  CHANNEL_MISMATCH: 1,
  EXECUTION_CAPABILITY: 1,
  DIFFERENTIATION_UNCLEAR: 2,
  NO_DIFFERENTIATION: 2,
  CUSTOMER_UNVALIDATED: 3,
  PAIN_UNVALIDATED: 4,
};

function tiebreakerRank(type: string): number {
  return TIEBREAKER_ORDER[type] ?? 5;
}

/**
 * Rank uncertainties from flow data. Sorted by weight descending,
 * then by tiebreaker: PRICE > CHANNEL > DIFFERENTIATION > CUSTOMER > PAIN.
 */
export function rankUncertainties(flowData: FlowDataRecord[]): Uncertainty[] {
  const uncertainties: Uncertainty[] = [];
  const byFlow = new Map(flowData.map((f) => [f.flow_number, f]));

  const flow1 = byFlow.get(1)?.data;
  const flow2 = byFlow.get(2)?.data;
  const flow3 = byFlow.get(3)?.data;
  const flow4 = byFlow.get(4)?.data;
  const flow5 = byFlow.get(5)?.data;

  // Flow 1: Check if pain was guessed/unvalidated
  if (flow1) {
    const confidence = String(flow1.confidence ?? '').toLowerCase();
    const wasGuessed = flow1.was_guessed === true;
    if (confidence === 'guess' || wasGuessed) {
      uncertainties.push({
        type: 'PAIN_UNVALIDATED',
        weight: 30,
        question: 'Do real people actually have this problem?',
      });
    }
  }

  // Flow 2: Check if customer was guessed/unvalidated
  if (flow2) {
    const confidence = String(flow2.confidence ?? '').toLowerCase();
    const wasGuessed = flow2.was_guessed === true;
    if (confidence === 'guess' || wasGuessed) {
      uncertainties.push({
        type: 'CUSTOMER_UNVALIDATED',
        weight: 25,
        question: 'Is this the right buyer?',
      });
    }
  }

  // Flow 3: Check differentiation verdict
  if (flow3) {
    // Handle both nested { verdict: 'WEAK' } and direct 'ai_verdict' string
    const aiVerdict = flow3.ai_verdict;
    let verdict = '';
    if (typeof aiVerdict === 'string') {
      verdict = aiVerdict.toUpperCase();
    } else if (aiVerdict && typeof aiVerdict === 'object') {
      verdict = String((aiVerdict as { verdict?: string }).verdict ?? '').toUpperCase();
    }
    
    if (verdict === 'WEAK') {
      uncertainties.push({
        type: 'DIFFERENTIATION_UNCLEAR',
        weight: 20,
        question: 'Will customers see this as different?',
      });
    }
    if (verdict === 'NONE') {
      uncertainties.push({
        type: 'NO_DIFFERENTIATION',
        weight: 25,
        question: 'This product may be undifferentiated. Will anyone switch?',
      });
    }
  }

  // Flow 4: Check price honesty and tier
  if (flow4) {
    // Handle both nested { verdict: 'CONTRADICTED' } and direct string
    const honestyVerdictObj = flow4.honesty_verdict;
    let honestyVerdict = '';
    if (typeof honestyVerdictObj === 'string') {
      honestyVerdict = honestyVerdictObj.toUpperCase();
    } else if (honestyVerdictObj && typeof honestyVerdictObj === 'object') {
      honestyVerdict = String((honestyVerdictObj as { verdict?: string }).verdict ?? '').toUpperCase();
    }
    
    const insisted = flow4.insisted_despite_contradiction === true;
    const tier = String(flow4.committed_tier ?? '').toUpperCase();
    
    if (honestyVerdict === 'CONTRADICTED' || (honestyVerdict === 'CONTRADICTED' && insisted)) {
      uncertainties.push({
        type: 'PRICE_OPTIMISTIC',
        weight: 20,
        question: 'Will customers actually pay this price?',
      });
    }
    if (tier === 'AGGRESSIVE') {
      uncertainties.push({
        type: 'PRICE_AGGRESSIVE',
        weight: 15,
        question: 'Is this price above what the market will tolerate?',
      });
    }
  }

  // Flow 5: Check channel override
  if (flow5) {
    const overrideApplied = flow5.override_applied === true;
    if (overrideApplied) {
      uncertainties.push({
        type: 'CHANNEL_MISMATCH',
        weight: 15,
        question: 'Will customers actually be on this channel?',
      });
    }
  }

  // If no uncertainties found, add default
  if (uncertainties.length === 0) {
    uncertainties.push({
      type: 'DEMAND_VALIDATION',
      weight: 20,
      question: 'Will people actually buy this product?',
    });
  }

  uncertainties.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return tiebreakerRank(a.type) - tiebreakerRank(b.type);
  });

  return uncertainties;
}
