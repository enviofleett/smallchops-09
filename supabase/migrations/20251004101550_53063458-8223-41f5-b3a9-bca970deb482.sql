-- Mark old test orders as cancelled instead of deleting
UPDATE public.orders 
SET 
  status = 'cancelled',
  updated_at = now()
WHERE id IN (
  'b640d44d-6b87-46bf-9f7d-2516bf7083eb',
  'ffa58ef2-0658-44d0-8c8d-ec6a599e20ee',
  '15fb8b66-c7cf-45d7-8550-250fc654d508',
  '992b0085-d1a2-4636-b319-f17841ac11d8',
  '69b88bca-cc36-46d8-9e29-f8cef0a66f90'
) AND status = 'confirmed';