ALTER TABLE orders ALTER COLUMN exchange_rate DROP DEFAULT;

DELETE FROM app_settings
WHERE key = 'exchange_rate'
  AND NOT EXISTS (
    SELECT 1
    FROM app_settings
    WHERE key = 'exchange_rate_source'
      AND value #>> '{}' = 'BCV'
  );
