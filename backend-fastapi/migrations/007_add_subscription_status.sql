-- Add subscription_status column to users table
-- This column tracks the current status of a user's subscription
-- Valid values: 'active', 'expired', 'cancelled'

-- Add the column with a default value of 'active' for existing users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(20) DEFAULT 'active' NOT NULL;

-- Add a comment to document the column
COMMENT ON COLUMN users.subscription_status IS 'Current status of the user subscription. Valid values: active, expired, cancelled.';

-- Add a CHECK constraint to ensure only valid status values are allowed
-- Drop constraint if it exists first, then recreate it
ALTER TABLE users
DROP CONSTRAINT IF EXISTS check_subscription_status;

ALTER TABLE users
ADD CONSTRAINT check_subscription_status 
CHECK (subscription_status IN ('active', 'expired', 'cancelled'));

-- Create an index for faster queries on subscription status
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(subscription_status);

-- Update existing users to have 'active' status if they have a valid subscription
-- Users with expiration dates in the future or no expiration date are considered active
UPDATE users 
SET subscription_status = 'active'
WHERE subscription_status = 'active' 
  AND (subscription_expiration_date IS NULL OR subscription_expiration_date > NOW());

-- Note: You may want to run a separate query to set 'expired' status for users
-- whose subscription_expiration_date has passed:
-- UPDATE users 
-- SET subscription_status = 'expired'
-- WHERE subscription_expiration_date IS NOT NULL 
--   AND subscription_expiration_date <= NOW()
--   AND subscription_status = 'active';
