-- PMF Machine — Supabase Database Schema
-- Run this in Supabase SQL Editor (Postgres 15+).
--
-- After running: In .env.local set SUPABASE_URL and SUPABASE_ANON_KEY
-- (or NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).
-- RLS policies below allow all operations; tighten for production.

-- =============================================================================
-- 1. PRODUCTS
-- =============================================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. FLOW_DATA
-- =============================================================================
CREATE TABLE flow_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  flow_number INTEGER NOT NULL CHECK (flow_number >= 1 AND flow_number <= 10),
  flow_name TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  data JSONB NOT NULL DEFAULT '{}',
  penalties INTEGER NOT NULL DEFAULT 0,
  risk_flags TEXT[] NOT NULL DEFAULT '{}',
  override_applied BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 3. EXPERIMENTS
-- =============================================================================
CREATE TABLE experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  hypothesis TEXT,
  null_hypothesis TEXT,
  setup_steps JSONB,
  primary_metric JSONB,
  kill_condition JSONB,
  time_limit_hours INTEGER,
  budget_limit_usd NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  results JSONB NOT NULL DEFAULT '{}',
  verdict TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4. SIGNALS
-- =============================================================================
CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  metric_name TEXT,
  value NUMERIC,
  classification TEXT,
  classified_by TEXT,
  reason TEXT,
  hours_elapsed NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 5. DECISIONS
-- =============================================================================
CREATE TABLE decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
  ai_recommendation TEXT,
  ai_reason TEXT,
  human_decision TEXT,
  override_applied BOOLEAN NOT NULL DEFAULT false,
  override_reason TEXT,
  override_penalty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 6. FINAL_VERDICTS
-- =============================================================================
CREATE TABLE final_verdicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  verdict TEXT,
  confidence TEXT,
  pmf_score INTEGER,
  foundation_score INTEGER,
  experiment_score INTEGER,
  consistency_score INTEGER,
  total_penalty INTEGER,
  total_modifiers INTEGER,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- INDEXES (for common lookups)
-- =============================================================================
CREATE INDEX idx_flow_data_product_id ON flow_data(product_id);
CREATE INDEX idx_flow_data_product_flow ON flow_data(product_id, flow_number);
CREATE INDEX idx_experiments_product_id ON experiments(product_id);
CREATE INDEX idx_signals_experiment_id ON signals(experiment_id);
CREATE INDEX idx_decisions_product_id ON decisions(product_id);
CREATE INDEX idx_decisions_experiment_id ON decisions(experiment_id);
CREATE INDEX idx_final_verdicts_product_id ON final_verdicts(product_id);

-- =============================================================================
-- UPDATED_AT TRIGGER
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER flow_data_updated_at
  BEFORE UPDATE ON flow_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER experiments_updated_at
  BEFORE UPDATE ON experiments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (allow all operations for now)
-- =============================================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_verdicts ENABLE ROW LEVEL SECURITY;

-- Products
CREATE POLICY "Allow all on products" ON products
  FOR ALL USING (true) WITH CHECK (true);

-- Flow data
CREATE POLICY "Allow all on flow_data" ON flow_data
  FOR ALL USING (true) WITH CHECK (true);

-- Experiments
CREATE POLICY "Allow all on experiments" ON experiments
  FOR ALL USING (true) WITH CHECK (true);

-- Signals
CREATE POLICY "Allow all on signals" ON signals
  FOR ALL USING (true) WITH CHECK (true);

-- Decisions
CREATE POLICY "Allow all on decisions" ON decisions
  FOR ALL USING (true) WITH CHECK (true);

-- Final verdicts
CREATE POLICY "Allow all on final_verdicts" ON final_verdicts
  FOR ALL USING (true) WITH CHECK (true);
