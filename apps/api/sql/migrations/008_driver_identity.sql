ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_identity_hash CHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_identity_encrypted TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_driver_identity_hash_unique_idx
  ON users(driver_identity_hash)
  WHERE driver_identity_hash IS NOT NULL;
