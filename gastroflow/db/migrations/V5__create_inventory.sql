CREATE TABLE inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  unit          TEXT NOT NULL DEFAULT 'unidad',
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_quantity  NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_tenant ON inventory_items(tenant_id);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_items
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
