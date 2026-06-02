CREATE TABLE menu_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  category    TEXT,
  image_key   TEXT,
  available   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_menu_tenant ON menu_items(tenant_id, available);

-- RLS
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON menu_items
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
