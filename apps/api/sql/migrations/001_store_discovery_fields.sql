ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS rating NUMERIC(2,1) NOT NULL DEFAULT 0
    CHECK (rating BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 2.99
    CHECK (delivery_fee >= 0),
  ADD COLUMN IF NOT EXISTS estimated_delivery_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (estimated_delivery_minutes > 0);
