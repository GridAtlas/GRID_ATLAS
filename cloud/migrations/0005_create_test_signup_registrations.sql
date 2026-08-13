CREATE TABLE IF NOT EXISTS test_signup_registrations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  grid_name TEXT NOT NULL,
  auth_user_id TEXT,
  tester_owner_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_test_signup_registrations_created
  ON test_signup_registrations (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_test_signup_registrations_email_status
  ON test_signup_registrations (email, status);
