CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'store', 'driver', 'customer');
CREATE TYPE order_status AS ENUM ('placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled');
CREATE TYPE delivery_status AS ENUM ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(32),
  driver_identity_hash CHAR(64),
  driver_identity_encrypted TEXT,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'customer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_auth_method_check CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL)
);
CREATE INDEX users_role_active_idx ON users(role, active);
CREATE UNIQUE INDEX users_phone_unique_idx ON users(phone) WHERE phone IS NOT NULL AND phone <> '';
CREATE UNIQUE INDEX users_driver_identity_hash_unique_idx ON users(driver_identity_hash) WHERE driver_identity_hash IS NOT NULL;

CREATE TABLE password_reset_codes (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  icon_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO categories(name) VALUES
  ('Restaurantes'), ('Supermercados'), ('Farmacias'), ('Tiendas'), ('Cafeterías'),
  ('Comidas'), ('Bodegas'), ('Repuestos')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  image_url TEXT,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 2.99 CHECK (delivery_fee >= 0),
  has_own_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
  payment_bank VARCHAR(100),
  payment_document VARCHAR(32),
  payment_phone VARCHAR(32),
  estimated_delivery_minutes INTEGER NOT NULL DEFAULT 30 CHECK (estimated_delivery_minutes > 0),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (commission_rate BETWEEN 0 AND 100),
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX stores_category_active_idx ON stores(category_id, active, approved);
CREATE INDEX stores_geo_idx ON stores(latitude, longitude);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 1 CHECK (stock_quantity >= 0),
  image_url TEXT,
  in_stock BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX products_store_active_idx ON products(store_id, active, in_stock);

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

CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL DEFAULT 'Casa',
  address_line TEXT NOT NULL,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  instructions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX addresses_user_idx ON addresses(user_id, created_at DESC);
CREATE UNIQUE INDEX addresses_one_default_per_user_idx ON addresses(user_id) WHERE is_default = TRUE;

CREATE TABLE driver_locations (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX driver_locations_geo_idx ON driver_locations(latitude, longitude);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  delivery_address TEXT NOT NULL,
  delivery_latitude NUMERIC(10,7),
  delivery_longitude NUMERIC(10,7),
  status order_status NOT NULL DEFAULT 'placed',
  subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  coupon_id UUID REFERENCES store_coupons(id) ON DELETE SET NULL,
  coupon_code VARCHAR(32),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  exchange_rate NUMERIC(14,4) NOT NULL CHECK (exchange_rate > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX orders_customer_created_idx ON orders(customer_id, created_at DESC);
CREATE INDEX orders_store_status_created_idx ON orders(store_id, status, created_at DESC);
CREATE INDEX orders_status_created_idx ON orders(status, created_at DESC);

CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES store_coupons(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX coupon_redemptions_customer_idx ON coupon_redemptions(customer_id, created_at DESC);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(160) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(12,2) NOT NULL CHECK (line_total >= 0)
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status delivery_status NOT NULL DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX deliveries_driver_status_idx ON deliveries(driver_id, status);
CREATE INDEX deliveries_status_created_idx ON deliveries(status, created_at);

CREATE TABLE order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  message TEXT NOT NULL DEFAULT '' CHECK (length(message) <= 2000),
  attachment_url TEXT,
  payment_reference VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (message <> '' OR attachment_url IS NOT NULL OR payment_reference IS NOT NULL)
);
CREATE INDEX order_messages_order_created_idx ON order_messages(order_id, created_at);

CREATE TABLE reviews (
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
CREATE INDEX reviews_store_created_idx ON reviews(store_id, created_at DESC);
CREATE INDEX reviews_driver_created_idx ON reviews(driver_id, created_at DESC);

CREATE TABLE app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_settings(key, value) VALUES ('default_commission_rate', '10'::jsonb)
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings(key, value) VALUES ('delivery_zone_radius_km', '15'::jsonb)
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings(key, value) VALUES ('exchange_rate', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;
