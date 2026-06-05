-- Support tickets (subscriber-submitted; managed via FastAPI JWT, not Supabase anon RLS).
-- Run in Supabase SQL Editor if the table is not created automatically by the API (SQLAlchemy create_all).

CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(32) NOT NULL DEFAULT 'general',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  priority VARCHAR(32) NOT NULL DEFAULT 'normal',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS ux_support_tickets_one_active_per_user
  ON support_tickets(user_id)
  WHERE status <> 'closed';

COMMENT ON TABLE support_tickets IS 'Subscriber support tickets; API enforces user_id / admin access.';
