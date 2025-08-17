-- Insert sample delivery schedule data for testing
DO $$
DECLARE
  sample_order_id UUID;
  sample_pickup_point_id UUID;
BEGIN
  -- Insert a sample pickup point if none exists
  INSERT INTO pickup_points (
    id,
    name,
    address,
    contact_phone,
    operating_hours,
    instructions,
    is_active
  ) VALUES (
    gen_random_uuid(),
    'Gwani Mall Pickup Center',
    '62 Road Gwarinpa, Abuja FCT 81002',
    '09120020048',
    '{"monday": "8:00 AM - 8:00 PM", "tuesday": "8:00 AM - 8:00 PM", "wednesday": "8:00 AM - 8:00 PM", "thursday": "8:00 AM - 8:00 PM", "friday": "8:00 AM - 8:00 PM", "saturday": "9:00 AM - 7:00 PM", "sunday": "10:00 AM - 6:00 PM"}',
    'Please call ahead for large orders. Parking available in front of the store.',
    true
  ) RETURNING id INTO sample_pickup_point_id;
  
  -- Log the pickup point creation
  RAISE NOTICE 'Created sample pickup point with ID: %', sample_pickup_point_id;
  
  -- Update any existing pickup orders to use this pickup point
  UPDATE orders 
  SET pickup_point_id = sample_pickup_point_id
  WHERE order_type = 'pickup' AND pickup_point_id IS NULL;
  
  -- Insert sample delivery schedules for existing orders if they don't have them
  INSERT INTO order_delivery_schedule (
    order_id,
    delivery_date,
    delivery_time_start,
    delivery_time_end,
    is_flexible,
    special_instructions
  )
  SELECT 
    o.id,
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    '12:00:00',
    false,
    CASE 
      WHEN o.order_type = 'pickup' THEN 'Please bring a valid ID for pickup verification'
      ELSE 'Please ensure someone is available to receive the delivery'
    END
  FROM orders o
  WHERE NOT EXISTS (
    SELECT 1 FROM order_delivery_schedule ods WHERE ods.order_id = o.id
  )
  AND o.status IN ('confirmed', 'preparing', 'ready', 'out_for_delivery')
  LIMIT 5;
  
  RAISE NOTICE 'Sample data inserted successfully';
END $$;