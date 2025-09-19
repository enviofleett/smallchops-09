-- Clean up duplicate business_settings records
-- Keep the most recently updated record and remove the older one
DELETE FROM public.business_settings 
WHERE id = '585b5423-67f4-43c6-aa1b-e0afee38c2d2';