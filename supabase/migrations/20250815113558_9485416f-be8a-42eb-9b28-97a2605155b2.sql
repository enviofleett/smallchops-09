-- Phase 1: Data Cleanup - Consolidate duplicate delivery zones
-- Fix Gwarinpa/Gwarimpa spelling inconsistency by consolidating them
UPDATE delivery_zones 
SET name = 'Gwarinpa'
WHERE name = 'Gwarimpa';

-- Consolidate duplicate 'Apo' zones by keeping the one with most reasonable fee structure
-- Delete duplicates, keeping the main one with ID 'eebcf4bc-448c-472e-8197-df33ce4ea379'
DELETE FROM delivery_fees WHERE zone_id IN (
  'fbdc425a-38c3-4a59-b442-bdf62d7ceb08',
  'beb9cf4e-5905-40ee-9f60-79e35fc73472', 
  'cb863a97-c8f6-4648-9cbf-03297087fd71'
);

DELETE FROM delivery_zones WHERE id IN (
  'fbdc425a-38c3-4a59-b442-bdf62d7ceb08',
  'beb9cf4e-5905-40ee-9f60-79e35fc73472',
  'cb863a97-c8f6-4648-9cbf-03297087fd71'
);

-- Update the remaining Apo zone with comprehensive description
UPDATE delivery_zones 
SET description = 'Apo - Mechanic Village, Primary School, NEPA, Legislative Quarters, Resettlement, Shoprite Extension, Wumba'
WHERE id = 'eebcf4bc-448c-472e-8197-df33ce4ea379';

-- Consolidate duplicate 'Asokoro' zones by keeping the main one
DELETE FROM delivery_fees WHERE zone_id = 'd6964e2d-b973-4534-bd6f-ef65b782d571';
DELETE FROM delivery_zones WHERE id = 'd6964e2d-b973-4534-bd6f-ef65b782d571';

UPDATE delivery_zones 
SET description = 'Asokoro - DIA, All Barracks, NAF Valley Area and Beyond'
WHERE id = 'ec6c2fd1-2f7e-4ed3-ac87-bc5963d54c9d';

-- Consolidate duplicate 'Idu' zones by keeping the main one
DELETE FROM delivery_fees WHERE zone_id IN (
  'efa1c756-d95a-46ec-b6a5-a12de21c818b',
  'fe0e8683-2d82-4edc-9496-71e1fa0e5fc5',
  '2af95676-18b0-4fc4-8b0c-7120f862b266'
);

DELETE FROM delivery_zones WHERE id IN (
  'efa1c756-d95a-46ec-b6a5-a12de21c818b',
  'fe0e8683-2d82-4edc-9496-71e1fa0e5fc5',
  '2af95676-18b0-4fc4-8b0c-7120f862b266'
);

UPDATE delivery_zones 
SET description = 'Idu - Paradise Estate, Ochacho, EFCC Area'
WHERE id = '1fe8dd51-f433-4baf-a103-6f6503defbf7';

-- Set free delivery thresholds for all zones (₦20,000 minimum for free delivery)
UPDATE delivery_fees 
SET min_order_for_free_delivery = 20000
WHERE min_order_for_free_delivery IS NULL;

-- Add basic geographic boundaries (placeholder coordinates - to be refined)
UPDATE delivery_zones 
SET area = jsonb_build_object(
  'type', 'polygon',
  'coordinates', ARRAY[ARRAY[
    ARRAY[7.398, 9.057], ARRAY[7.405, 9.057], 
    ARRAY[7.405, 9.065], ARRAY[7.398, 9.065], 
    ARRAY[7.398, 9.057]
  ]]
)
WHERE area IS NULL OR area = '{"type": "polygon", "coordinates": []}'::jsonb;

-- Create audit trail for zone consolidation
INSERT INTO audit_logs (
  action, category, message, new_values
) VALUES (
  'delivery_zones_consolidated',
  'Delivery Management',
  'Consolidated duplicate delivery zones and standardized data',
  jsonb_build_object(
    'consolidated_zones', ARRAY['Apo', 'Asokoro', 'Idu', 'Gwarinpa'],
    'free_delivery_threshold_set', 20000,
    'geographic_boundaries_added', true
  )
);