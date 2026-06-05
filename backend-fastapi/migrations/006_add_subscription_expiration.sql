-- Add subscription_expiration_date column to users table
-- This column tracks when a user's subscription tier expires
-- NULL means the subscription never expires (lifetime access)

-- Add the column (nullable, so existing users without expiration dates are valid)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_expiration_date TIMESTAMP NULL;

-- Add a comment to document the column
COMMENT ON COLUMN users.subscription_expiration_date IS 'Date when the user subscription tier expires. NULL means lifetime access (no expiration).';

-- Create an index for faster queries on expiration dates
CREATE INDEX IF NOT EXISTS idx_users_subscription_expiration ON users(subscription_expiration_date);

-- Note: Partial indexes with CURRENT_TIMESTAMP are not allowed in PostgreSQL
-- because CURRENT_TIMESTAMP is not immutable. Use a regular index instead.
-- You can filter expired subscriptions in your queries using:
-- WHERE subscription_expiration_date IS NULL OR subscription_expiration_date > NOW()
