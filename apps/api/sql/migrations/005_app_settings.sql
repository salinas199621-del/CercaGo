CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings(key, value) VALUES
  ('default_commission_rate', '10'::jsonb),
  ('delivery_zone_radius_km', '15'::jsonb),
  ('exchange_rate', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
