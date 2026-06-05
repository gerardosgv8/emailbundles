-- Run against your app database (e.g. Supabase SQL editor) if the column is missing.
-- Pro products: set pro_subscription_months to 1, 3, 6, or 12 in the admin API or products UI.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS pro_subscription_months INTEGER;

COMMENT ON COLUMN products.pro_subscription_months IS
  'Prepaid Pro term in months (1, 3, 6, 12). NULL for non-Pro or downloadable products.';
