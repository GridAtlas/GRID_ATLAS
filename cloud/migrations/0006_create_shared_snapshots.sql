CREATE TABLE IF NOT EXISTS cloud_shared_snapshots (
  share_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cloud_shared_snapshots_owner
  ON cloud_shared_snapshots(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cloud_shared_snapshots_expiry
  ON cloud_shared_snapshots(expires_at);
