CREATE TABLE IF NOT EXISTS cloud_assets (
  owner_id TEXT NOT NULL,
  list_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  media_type TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  byte_length INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (owner_id, list_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_cloud_assets_owner_list
  ON cloud_assets (owner_id, list_id);
