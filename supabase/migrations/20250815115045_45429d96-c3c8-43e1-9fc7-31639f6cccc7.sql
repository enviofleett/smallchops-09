-- Safe Delivery Zones Reset Migration
-- Phase 1: Preparation - Create backup and analysis tables

-- Create backup of current zones
CREATE TABLE delivery_zones_backup AS 
SELECT * FROM delivery_zones;

CREATE TABLE delivery_fees_backup AS 
SELECT * FROM delivery_fees;

-- Create analysis table for zone consolidation
CREATE TABLE zone_consolidation_map (
  old_zone_id UUID,
  new_zone_id UUID,
  zone_name TEXT,
  consolidation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phase 2: Create New Clean Zones with standardized data

-- First, let's identify unique zone names and create clean versions
INSERT INTO delivery_zones (id, name, description, area, is_active, created_at)
VALUES 
  (gen_random_uuid(), 'Lagos Island', 'Central Lagos Island including VI, Ikoyi, and Lekki', '{}', true, NOW()),
  (gen_random_uuid(), 'Lagos Mainland', 'Lagos Mainland areas including Ikeja, Surulere, and Yaba', '{}', true, NOW()),
  (gen_random_uuid(), 'Lekki Peninsula', 'Lekki Peninsula including Ajah, VGC, and environs', '{}', true, NOW()),
  (gen_random_uuid(), 'Ikeja GRA', 'Government Reserved Area Ikeja and surrounding areas', '{}', true, NOW()),
  (gen_random_uuid(), 'Victoria Island', 'Victoria Island business and residential district', '{}', true, NOW()),
  (gen_random_uuid(), 'Ikoyi', 'Ikoyi residential and business area', '{}', true, NOW()),
  (gen_random_uuid(), 'Surulere', 'Surulere and adjacent areas', '{}', true, NOW()),
  (gen_random_uuid(), 'Yaba', 'Yaba technology district and surroundings', '{}', true, NOW()),
  (gen_random_uuid(), 'Gbagada', 'Gbagada and nearby areas', '{}', true, NOW()),
  (gen_random_uuid(), 'Ajah', 'Ajah and Sangotedo areas', '{}', true, NOW());

-- Create standardized delivery fees for new zones
INSERT INTO delivery_fees (zone_id, base_fee, fee_per_km, min_order_for_free_delivery, created_at)
SELECT 
  dz.id,
  CASE 
    WHEN dz.name IN ('Lagos Island', 'Victoria Island', 'Ikoyi') THEN 800.00
    WHEN dz.name IN ('Lekki Peninsula', 'Ajah') THEN 1200.00
    WHEN dz.name IN ('Ikeja GRA') THEN 600.00
    ELSE 500.00
  END as base_fee,
  100.00 as fee_per_km,
  5000.00 as min_order_for_free_delivery,
  NOW()
FROM delivery_zones dz 
WHERE dz.name IN (
  'Lagos Island', 'Lagos Mainland', 'Lekki Peninsula', 'Ikeja GRA',
  'Victoria Island', 'Ikoyi', 'Surulere', 'Yaba', 'Gbagada', 'Ajah'
)
AND dz.created_at > NOW() - INTERVAL '1 minute';

-- Phase 3: Create consolidation mapping
-- Map old zones to new clean zones based on name similarity and location

-- Create the consolidation mapping for migration
WITH old_zones AS (
  SELECT id, name FROM delivery_zones_backup
),
new_zones AS (
  SELECT id, name FROM delivery_zones 
  WHERE created_at > NOW() - INTERVAL '1 minute'
)
INSERT INTO zone_consolidation_map (old_zone_id, new_zone_id, zone_name, consolidation_reason)
SELECT 
  oz.id as old_zone_id,
  nz.id as new_zone_id,
  nz.name as zone_name,
  CASE 
    WHEN LOWER(oz.name) LIKE '%lagos island%' OR LOWER(oz.name) LIKE '%island%' THEN 'Consolidated to Lagos Island'
    WHEN LOWER(oz.name) LIKE '%mainland%' OR LOWER(oz.name) LIKE '%ikeja%' AND LOWER(oz.name) NOT LIKE '%gra%' THEN 'Consolidated to Lagos Mainland'
    WHEN LOWER(oz.name) LIKE '%lekki%' OR LOWER(oz.name) LIKE '%peninsula%' THEN 'Consolidated to Lekki Peninsula'
    WHEN LOWER(oz.name) LIKE '%ikeja%' AND LOWER(oz.name) LIKE '%gra%' THEN 'Consolidated to Ikeja GRA'
    WHEN LOWER(oz.name) LIKE '%victoria%' OR LOWER(oz.name) LIKE '%vi%' THEN 'Consolidated to Victoria Island'
    WHEN LOWER(oz.name) LIKE '%ikoyi%' THEN 'Consolidated to Ikoyi'
    WHEN LOWER(oz.name) LIKE '%surulere%' THEN 'Consolidated to Surulere'
    WHEN LOWER(oz.name) LIKE '%yaba%' THEN 'Consolidated to Yaba'
    WHEN LOWER(oz.name) LIKE '%gbagada%' THEN 'Consolidated to Gbagada'
    WHEN LOWER(oz.name) LIKE '%ajah%' OR LOWER(oz.name) LIKE '%sangotedo%' THEN 'Consolidated to Ajah'
    ELSE 'Default mapping to Lagos Mainland'
  END as consolidation_reason
FROM old_zones oz
CROSS JOIN new_zones nz
WHERE 
  CASE 
    WHEN LOWER(oz.name) LIKE '%lagos island%' OR LOWER(oz.name) LIKE '%island%' THEN nz.name = 'Lagos Island'
    WHEN LOWER(oz.name) LIKE '%mainland%' OR (LOWER(oz.name) LIKE '%ikeja%' AND LOWER(oz.name) NOT LIKE '%gra%') THEN nz.name = 'Lagos Mainland'
    WHEN LOWER(oz.name) LIKE '%lekki%' OR LOWER(oz.name) LIKE '%peninsula%' THEN nz.name = 'Lekki Peninsula'
    WHEN LOWER(oz.name) LIKE '%ikeja%' AND LOWER(oz.name) LIKE '%gra%' THEN nz.name = 'Ikeja GRA'
    WHEN LOWER(oz.name) LIKE '%victoria%' OR LOWER(oz.name) LIKE '%vi%' THEN nz.name = 'Victoria Island'
    WHEN LOWER(oz.name) LIKE '%ikoyi%' THEN nz.name = 'Ikoyi'
    WHEN LOWER(oz.name) LIKE '%surulere%' THEN nz.name = 'Surulere'
    WHEN LOWER(oz.name) LIKE '%yaba%' THEN nz.name = 'Yaba'
    WHEN LOWER(oz.name) LIKE '%gbagada%' THEN nz.name = 'Gbagada'
    WHEN LOWER(oz.name) LIKE '%ajah%' OR LOWER(oz.name) LIKE '%sangotedo%' THEN nz.name = 'Ajah'
    ELSE nz.name = 'Lagos Mainland'
  END;

-- Phase 4: Data Migration - Update existing orders to use new clean zone IDs
UPDATE orders 
SET delivery_zone_id = zcm.new_zone_id
FROM zone_consolidation_map zcm
WHERE orders.delivery_zone_id = zcm.old_zone_id;

-- Phase 5: Cleanup - Remove old zones and fees
DELETE FROM delivery_fees 
WHERE zone_id IN (SELECT old_zone_id FROM zone_consolidation_map);

DELETE FROM delivery_zones 
WHERE id IN (SELECT old_zone_id FROM zone_consolidation_map);

-- Verification and logging
INSERT INTO audit_logs (
  action,
  category, 
  message,
  new_values
) VALUES (
  'delivery_zones_safe_migration_completed',
  'System Migration',
  'Successfully completed safe delivery zones migration with data consolidation',
  jsonb_build_object(
    'zones_before', (SELECT COUNT(*) FROM delivery_zones_backup),
    'zones_after', (SELECT COUNT(*) FROM delivery_zones WHERE name IN (
      'Lagos Island', 'Lagos Mainland', 'Lekki Peninsula', 'Ikeja GRA',
      'Victoria Island', 'Ikoyi', 'Surulere', 'Yaba', 'Gbagada', 'Ajah'
    )),
    'orders_migrated', (SELECT COUNT(*) FROM zone_consolidation_map),
    'migration_completed_at', NOW()
  )
);

-- Create summary report
CREATE VIEW delivery_zones_migration_summary AS
SELECT 
  'Migration Summary' as report_type,
  (SELECT COUNT(*) FROM delivery_zones_backup) as original_zones_count,
  (SELECT COUNT(*) FROM delivery_zones WHERE created_at > NOW() - INTERVAL '5 minutes') as new_zones_count,
  (SELECT COUNT(*) FROM zone_consolidation_map) as zones_consolidated,
  (SELECT COUNT(*) FROM orders WHERE delivery_zone_id IS NOT NULL) as orders_with_zones,
  (SELECT COUNT(*) FROM orders WHERE delivery_zone_id IS NULL) as orders_without_zones;