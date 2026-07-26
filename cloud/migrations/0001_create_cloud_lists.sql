CREATE TABLE IF NOT EXISTS cloud_lists (
  id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  payload_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (owner_id, id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_lists_owner_updated
  ON cloud_lists (owner_id, updated_at DESC);
