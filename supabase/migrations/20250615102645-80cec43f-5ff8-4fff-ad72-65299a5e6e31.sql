
-- Enable pg_cron extension if not already enabled, used for scheduling tasks.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for making HTTP requests from the database to call the edge function.
CREATE EXTENSION IF NOT EXISTS pg_net;

-- As a security best practice, we revoke execution rights on pg_net from the public role.
REVOKE EXECUTE ON FUNCTION net.http_get, net.http_post FROM public;

-- Then, we grant specific permissions to the 'postgres' role, which pg_cron uses to run jobs.
GRANT USAGE ON SCHEMA net TO postgres;
GRANT EXECUTE ON FUNCTION net.http_post TO postgres;

-- Schedule the new cron job to run every 2 minutes.
SELECT cron.schedule(
  'process-communication-queue-job', -- A unique name for our job
  '*/2 * * * *', -- Standard cron syntax for "every 2 minutes"
  $$
  SELECT net.http_post(
    url := 'https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/process-communication-queue',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwY3ZpeWpkc2dnaHZ1ZGR0aHhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzk1ODYsImV4cCI6MjA2NDYxNTU4Nn0.n0GJZKxcr8kyzGNrcfdUdWadC0x6PUuYUe3jQg5qg_M"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
