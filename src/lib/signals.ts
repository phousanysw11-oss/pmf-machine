/**
 * Signal vs Noise rules and computed metrics for PMF Machine Flow 6.
 */

export const PERMANENT_NOISE_METRICS: readonly string[] = [
  'views',
  'impressions',
  'reach',
  'likes',
  'loves',
  'shares',
  'saves',
  'follower_count',
  'follower_growth',
  'profile_visits',
  'video_watch_time',
  'positive_comments',
  'story_views',
] as const;

export function isPermanentNoise(metricName: string): boolean {
  return PERMANENT_NOISE_METRICS.includes(
    metricName.toLowerCase().replace(/\s+/g, '_') as (typeof PERMANENT_NOISE_METRICS)[number]
  );
}

export type RawInputs = {
  spend: number;
  hours_elapsed: number;
  impressions: number;
  clicks: number;
  messages_received: number;
  orders_placed: number;
  orders_delivered: number;
  orders_canceled: number;
};

export type ComputedMetrics = {
  ctr: number;
  cpa: number;
  message_to_order_rate: number;
  cancel_rate: number;
};

export function computeMetrics(raw: RawInputs): ComputedMetrics {
  const ctr =
    raw.impressions > 0 ? (raw.clicks / raw.impressions) * 100 : 0;
  const cpa =
    raw.orders_placed > 0 ? raw.spend / raw.orders_placed : Infinity;
  const message_to_order_rate =
    raw.messages_received > 0 ? raw.orders_placed / raw.messages_received : 0;
  const placed = raw.orders_placed || raw.orders_delivered + raw.orders_canceled || 1;
  const cancel_rate =
    placed > 0 ? (raw.orders_canceled / placed) * 100 : 0;

  return {
    ctr: Math.round(ctr * 100) / 100,
    cpa: cpa === Infinity ? Infinity : Math.round(cpa * 100) / 100,
    message_to_order_rate: Math.round(message_to_order_rate * 1000) / 1000,
    cancel_rate: Math.round(cancel_rate * 100) / 100,
  };
}

export type Classification = 'NOISE' | 'WEAK' | 'STRONG' | 'PMF';

export type SignalItem = {
  metric: string;
  value: number | string;
  classification: Classification;
  reason?: string;
  action?: string;
  fromRules?: boolean;
};

/** Viable CPA threshold: below this, orders are considered viable. */
const VIABLE_CPA_USD = 15;

/**
 * Rule-based pre-filter. Returns classifications for metrics that can be
 * determined by rules. Vanity metrics are always NOISE.
 */
export function classifyByRules(
  raw: RawInputs,
  computed: ComputedMetrics
): SignalItem[] {
  const byMetric = new Map<string, SignalItem>();

  // Vanity → NOISE
  byMetric.set('impressions', {
    metric: 'impressions',
    value: raw.impressions,
    classification: 'NOISE',
    reason: 'Vanity metric — not a buying signal',
    fromRules: true,
  });

  // High clicks + zero messages → WEAK; else clicks not a strong signal (leave for AI or NOISE)
  if (raw.clicks >= 10 && raw.messages_received === 0) {
    byMetric.set('clicks', {
      metric: 'clicks',
      value: raw.clicks,
      classification: 'WEAK',
      reason: 'High clicks + zero messages = interest but no intent',
      fromRules: true,
    });
  }

  // 3+ orders at viable CPA → STRONG
  if (raw.orders_placed >= 3 && computed.cpa !== Infinity && computed.cpa <= VIABLE_CPA_USD) {
    byMetric.set('orders_placed', {
      metric: 'orders_placed',
      value: raw.orders_placed,
      classification: 'STRONG',
      reason: `3+ orders at $${computed.cpa.toFixed(2)} CPA (viable)`,
      fromRules: true,
    });
    byMetric.set('cpa', {
      metric: 'cpa',
      value: computed.cpa,
      classification: 'STRONG',
      reason: 'Viable CPA with volume',
      fromRules: true,
    });
  }

  // 10+ messages + zero orders → WEAK
  if (raw.messages_received >= 10 && raw.orders_placed === 0) {
    byMetric.set('messages_received', {
      metric: 'messages_received',
      value: raw.messages_received,
      classification: 'WEAK',
      reason: '10+ messages but zero orders',
      fromRules: true,
    });
  }

  // 40%+ cancel rate → WEAK
  if (computed.cancel_rate >= 40) {
    byMetric.set('cancel_rate', {
      metric: 'cancel_rate',
      value: computed.cancel_rate,
      classification: 'WEAK',
      reason: '40%+ cancel rate',
      fromRules: true,
    });
  }

  return Array.from(byMetric.values());
}

/**
 * Metrics that are always NOISE (for UI). No override possible.
 */
export function getPermanentNoiseList(): string[] {
  return [...PERMANENT_NOISE_METRICS];
}
