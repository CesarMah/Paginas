CREATE TABLE orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  items        JSONB NOT NULL,
  total        NUMERIC(10,2) GENERATED ALWAYS AS (
                 (SELECT COALESCE(SUM(
                    (item->>'price')::numeric * (item->>'quantity')::int
                  ), 0)
                  FROM jsonb_array_elements(items) AS item)
               ) STORED,
  status       TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','cooking','ready','delivered','cancelled')),
  table_number TEXT,
  notes        TEXT,
  customer_email TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_tenant_status  ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
