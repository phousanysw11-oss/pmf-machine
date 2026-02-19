import { supabase } from './supabase';

/** Format Supabase/PostgREST error for clearer debugging (RLS, schema, etc.). */
function formatDbError(error: { message?: string; code?: string; details?: string }, prefix: string): string {
  const msg = error?.message ?? 'Unknown error';
  const code = (error as { code?: string }).code;
  const details = (error as { details?: string }).details;
  if (code || details) {
    return `${prefix}: [${code ?? 'error'}] ${msg}${details ? ` — ${details}` : ''}`;
  }
  return `${prefix}: ${msg}`;
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export async function createProduct(name: string) {
  const { data, error } = await supabase
    .from('products')
    .insert({ name })
    .select('id, name, status, created_at, updated_at')
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to create product'));
  }

  return data;
}

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch products'));
  }

  return data;
}

export async function getProduct(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch product'));
  }

  return data;
}

export async function updateProduct(
  productId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to update product'));
  }

  return data;
}

export async function getKilledProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'killed')
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch killed products'));
  }

  return data ?? [];
}

// -----------------------------------------------------------------------------
// Flow Data
// -----------------------------------------------------------------------------

export async function getFlowData(productId: string, flowNumber: number) {
  const { data, error } = await supabase
    .from('flow_data')
    .select('*')
    .eq('product_id', productId)
    .eq('flow_number', flowNumber)
    .maybeSingle();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch flow data'));
  }

  return data;
}

export async function saveFlowData(
  productId: string,
  flowNumber: number,
  data: Record<string, unknown>
) {
  const { data: existing } = await supabase
    .from('flow_data')
    .select('id, data')
    .eq('product_id', productId)
    .eq('flow_number', flowNumber)
    .maybeSingle();

  let result;

  if (existing) {
    const { data: updated, error } = await supabase
      .from('flow_data')
      .update({
        data: { ...(existing.data as Record<string, unknown> || {}), ...data },
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .eq('flow_number', flowNumber)
      .select()
      .single();

    if (error) {
      throw new Error(formatDbError(error, 'Failed to update flow data'));
    }

    result = updated;
  } else {
    const { data: inserted, error } = await supabase
      .from('flow_data')
      .insert({
        product_id: productId,
        flow_number: flowNumber,
        data,
      })
      .select()
      .single();

    if (error) {
      throw new Error(formatDbError(error, 'Failed to create flow data'));
    }

    result = inserted;
  }

  return result;
}

export async function getProductFlows(productId: string) {
  const { data, error } = await supabase
    .from('flow_data')
    .select('*')
    .eq('product_id', productId)
    .order('flow_number', { ascending: true });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch product flows'));
  }

  return data;
}

export async function getLatestFinalVerdict(productId: string) {
  const { data, error } = await supabase
    .from('final_verdicts')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch final verdict'));
  }

  return data;
}

export async function lockFlow(productId: string, flowNumber: number) {
  const { data, error } = await supabase
    .from('flow_data')
    .update({
      locked: true,
      locked_at: new Date().toISOString(),
    })
    .eq('product_id', productId)
    .eq('flow_number', flowNumber)
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to lock flow'));
  }

  return data;
}

export async function lockFlowWithData(
  productId: string,
  flowNumber: number,
  flowData: Record<string, unknown>,
  penaltyToAdd: number = 0
) {
  await saveFlowData(productId, flowNumber, flowData);

  const { data: existing } = await supabase
    .from('flow_data')
    .select('penalties')
    .eq('product_id', productId)
    .eq('flow_number', flowNumber)
    .single();

  const currentPenalties = (existing?.penalties as number) ?? 0;

  const { data, error } = await supabase
    .from('flow_data')
    .update({
      locked: true,
      locked_at: new Date().toISOString(),
      penalties: currentPenalties + penaltyToAdd,
    })
    .eq('product_id', productId)
    .eq('flow_number', flowNumber)
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to lock flow'));
  }

  return data;
}

// -----------------------------------------------------------------------------
// Experiments
// -----------------------------------------------------------------------------

export async function createExperiment(
  productId: string,
  data: Record<string, unknown>
) {
  const { data: experiment, error } = await supabase
    .from('experiments')
    .insert({
      product_id: productId,
      ...data,
    })
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to create experiment'));
  }

  return experiment;
}

export async function getExperiments(productId: string) {
  const { data, error } = await supabase
    .from('experiments')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch experiments'));
  }

  return data;
}

export async function getExperiment(experimentId: string) {
  const { data, error } = await supabase
    .from('experiments')
    .select('*')
    .eq('id', experimentId)
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch experiment'));
  }

  return data;
}

export async function updateExperiment(
  experimentId: string,
  updates: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from('experiments')
    .update(updates)
    .eq('id', experimentId)
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to update experiment'));
  }

  return data;
}

// -----------------------------------------------------------------------------
// Signals
// -----------------------------------------------------------------------------

export async function saveSignal(
  experimentId: string,
  data: Record<string, unknown>
) {
  const { data: signal, error } = await supabase
    .from('signals')
    .insert({
      experiment_id: experimentId,
      ...data,
    })
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to save signal'));
  }

  return signal;
}

export async function saveSignalsBatch(
  experimentId: string,
  signals: Array<Record<string, unknown>>
) {
  if (signals.length === 0) return [];

  const rows = signals.map((s) => ({
    experiment_id: experimentId,
    ...s,
  }));

  const { data, error } = await supabase
    .from('signals')
    .insert(rows)
    .select();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to save signals'));
  }

  return data ?? [];
}

export async function getSignalsByExperiment(experimentId: string) {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('experiment_id', experimentId)
    .order('hours_elapsed', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch signals'));
  }

  return data ?? [];
}

export async function getSignalsForProduct(productId: string) {
  const experiments = await getExperiments(productId);
  if (experiments.length === 0) return [];
  const expIds = experiments.map((e) => e.id);
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .in('experiment_id', expIds);
  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch signals'));
  }
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Decisions
// -----------------------------------------------------------------------------

export async function saveDecision(
  productId: string,
  data: Record<string, unknown>
) {
  const { data: decision, error } = await supabase
    .from('decisions')
    .insert({
      product_id: productId,
      ...data,
    })
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to save decision'));
  }

  return decision;
}

export async function getDecisionsByProduct(productId: string) {
  const { data, error } = await supabase
    .from('decisions')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(formatDbError(error, 'Failed to fetch decisions'));
  }

  return data ?? [];
}

// -----------------------------------------------------------------------------
// Final Verdicts
// -----------------------------------------------------------------------------

export async function saveFinalVerdict(
  productId: string,
  data: Record<string, unknown>
) {
  const { data: verdict, error } = await supabase
    .from('final_verdicts')
    .insert({
      product_id: productId,
      ...data,
    })
    .select()
    .single();

  if (error) {
    throw new Error(formatDbError(error, 'Failed to save final verdict'));
  }

  return verdict;
}
