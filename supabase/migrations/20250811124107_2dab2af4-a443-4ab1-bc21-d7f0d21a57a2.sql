-- Add a flag to track when we're using Auth email system temporarily
ALTER TABLE communication_events 
ADD COLUMN IF NOT EXISTS email_provider text DEFAULT 'smtp';

-- Update existing events to show they used SMTP
UPDATE communication_events 
SET email_provider = 'smtp' 
WHERE email_provider IS NULL;

-- Create an index for better performance when filtering by provider
CREATE INDEX IF NOT EXISTS idx_communication_events_provider 
ON communication_events(email_provider, created_at);

-- Add a comment to document the temporary nature
COMMENT ON COLUMN communication_events.email_provider IS 'Email provider used: smtp, supabase_auth (temporary fix), or resend';