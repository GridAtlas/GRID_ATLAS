CREATE TABLE IF NOT EXISTS cloud_accounts (
  owner_id TEXT PRIMARY KEY,
  auth_provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cloud_accounts_provider_subject
  ON cloud_accounts (auth_provider, provider_subject);

CREATE TABLE IF NOT EXISTS cloud_entitlements (
  owner_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  source TEXT NOT NULL DEFAULT 'none',
  external_customer_id TEXT,
  external_subscription_id TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES cloud_accounts (owner_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_entitlements_status
  ON cloud_entitlements (status, current_period_end);

CREATE TABLE IF NOT EXISTS cloud_billing_events (
  source TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payload_hash TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  PRIMARY KEY (source, external_event_id)
);
