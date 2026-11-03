ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS has_own_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_bank VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_document VARCHAR(32),
  ADD COLUMN IF NOT EXISTS payment_phone VARCHAR(32);

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 1
  CHECK (stock_quantity >= 0);

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_default_per_user_idx
  ON addresses(user_id) WHERE is_default = TRUE;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(14,4);

CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 2000),
  attachment_url TEXT,
  payment_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (message <> '' OR attachment_url IS NOT NULL OR payment_reference IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS order_messages_order_created_idx ON order_messages(order_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 2000),
  driver_rating SMALLINT CHECK (driver_rating BETWEEN 1 AND 5),
  driver_comment TEXT NOT NULL DEFAULT '' CHECK (length(driver_comment) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reviews_store_created_idx ON reviews(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_driver_created_idx ON reviews(driver_id, created_at DESC);

INSERT INTO app_settings(key, value, updated_at)
VALUES ('exchange_rate', 'null'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

INSERT INTO categories(name) VALUES ('Comidas'), ('Bodegas'), ('Repuestos')
ON CONFLICT (name) DO NOTHING;
