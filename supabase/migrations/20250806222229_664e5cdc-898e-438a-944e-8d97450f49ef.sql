-- Add applicable_days column to promotions table for production-ready day selection logic
ALTER TABLE promotions ADD COLUMN applicable_days text[] DEFAULT ARRAY[]::text[];

-- Create index for performance on applicable_days queries
CREATE INDEX idx_promotions_applicable_days ON promotions USING GIN(applicable_days);

-- Add comment for clarity
COMMENT ON COLUMN promotions.applicable_days IS 'Days of the week when promotion is applicable (monday, tuesday, etc.). Empty array means all days.';

-- Add constraint to ensure only valid day names
ALTER TABLE promotions ADD CONSTRAINT valid_applicable_days 
CHECK (
  applicable_days <@ ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
);