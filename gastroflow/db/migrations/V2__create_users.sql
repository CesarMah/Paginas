CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cognito_sub  TEXT NOT NULL UNIQUE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  email        TEXT NOT NULL,
  name         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
