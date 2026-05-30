-- Migration: Add policy_rules table for versioning
-- This table tracks policy rule definitions with version history,
-- allowing rollback to previous versions and audit trail of changes.

CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id TEXT NOT NULL,  -- Stable identifier for the rule (e.g., "required.empty", "claims.superlative")
  version INTEGER NOT NULL,  -- Version number for this rule definition
  rule_definition JSONB NOT NULL,  -- Full rule definition (code, severity, message, pattern, etc.)
  severity TEXT NOT NULL CHECK (severity IN ('block', 'warn', 'clean')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,  -- User or system that created this version
  active BOOLEAN NOT NULL DEFAULT FALSE,  -- Whether this version is currently active
  notes TEXT,  -- Optional notes about this version (why it was changed)
  
  CONSTRAINT unique_rule_version UNIQUE (rule_id, version)
);

-- Index for looking up active rules efficiently
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(rule_id) WHERE active = TRUE;

-- Index for rule history lookups
CREATE INDEX IF NOT EXISTS idx_policy_rules_rule_id ON policy_rules(rule_id, version DESC);

-- RLS policies
ALTER TABLE policy_rules ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access" ON policy_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No access for authenticated users (policy rules are system-managed)
CREATE POLICY "No user access" ON policy_rules
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Function to activate a specific rule version and deactivate others for the same rule_id
CREATE OR REPLACE FUNCTION activate_rule_version(rule_id_param TEXT, version_param INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Deactivate all versions of this rule
  UPDATE policy_rules
  SET active = FALSE
  WHERE rule_id = rule_id_param;
  
  -- Activate the specified version
  UPDATE policy_rules
  SET active = TRUE
  WHERE rule_id = rule_id_param AND version = version_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get the active version of a rule
CREATE OR REPLACE FUNCTION get_active_rule(rule_id_param TEXT)
RETURNS policy_rules AS $$
  SELECT * FROM policy_rules
  WHERE rule_id = rule_id_param AND active = TRUE
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Function to create a new rule version (increments version automatically)
CREATE OR REPLACE FUNCTION create_rule_version(
  rule_id_param TEXT,
  rule_definition_param JSONB,
  severity_param TEXT,
  created_by_param TEXT DEFAULT NULL,
  notes_param TEXT DEFAULT NULL
)
RETURNS policy_rules AS $$
DECLARE
  max_version INTEGER;
  new_version INTEGER;
  new_rule policy_rules;
BEGIN
  -- Get the max version for this rule_id
  SELECT COALESCE(MAX(version), 0) INTO max_version
  FROM policy_rules
  WHERE rule_id = rule_id_param;
  
  -- Increment version
  new_version := max_version + 1;
  
  -- Insert new version (not active by default)
  INSERT INTO policy_rules (rule_id, version, rule_definition, severity, created_by, notes, active)
  VALUES (rule_id_param, new_version, rule_definition_param, severity_param, created_by_param, notes_param, FALSE)
  RETURNING * INTO new_rule;
  
  RETURN new_rule;
END;
$$ LANGUAGE plpgsql;
