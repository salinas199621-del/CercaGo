BEGIN;

CREATE TABLE store_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code VARCHAR(32) NOT NULL,
  discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  required_completed_orders INTEGER NOT NULL DEFAULT 0 CHECK (required_completed_orders >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, code),
  CHECK (discount_type <> 'percent' OR discount_value <= 100)
);
CREATE INDEX store_coupons_store_active_idx ON store_coupons(store_id, active, code);

ALTER TABLE orders
  ADD COLUMN coupon_id UUID REFERENCES store_coupons(id) ON DELETE SET NULL,
  ADD COLUMN coupon_code VARCHAR(32),
  ADD COLUMN discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES store_coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX coupon_redemptions_customer_idx ON coupon_redemptions(customer_id, created_at DESC);

COMMIT;
