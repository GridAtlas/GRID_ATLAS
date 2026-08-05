ALTER TABLE cloud_lists ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE cloud_lists
SET sort_order = (
  SELECT COUNT(*)
  FROM cloud_lists AS other
  WHERE other.owner_id = cloud_lists.owner_id
    AND other.deleted_at IS NULL
    AND (
      other.updated_at > cloud_lists.updated_at
      OR (other.updated_at = cloud_lists.updated_at AND other.id < cloud_lists.id)
    )
)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cloud_lists_owner_sort
  ON cloud_lists (owner_id, sort_order, updated_at DESC, id);