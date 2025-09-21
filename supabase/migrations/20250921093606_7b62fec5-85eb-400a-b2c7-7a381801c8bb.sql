-- URGENT FIX: Correct the field name in payment verification function
-- The error "record 'new' has no field 'updated_by_name'" indicates incorrect field reference

-- First, let's see the current function definition
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_name LIKE '%payment%' 
AND routine_type = 'FUNCTION'
AND routine_schema = 'public';