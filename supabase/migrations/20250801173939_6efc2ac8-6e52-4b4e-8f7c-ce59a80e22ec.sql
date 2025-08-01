-- Fix function parameter issue by dropping and recreating
DROP FUNCTION IF EXISTS public.get_user_role(uuid);

-- Recreate function with proper search path
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
  SELECT role::text FROM public.profiles WHERE id = user_id;
$function$;

-- Add audit log for production configuration completion
INSERT INTO public.audit_logs (action, category, message, new_values)
VALUES (
  'production_configuration_completed',
  'System Configuration',
  'Paystack production configuration system fully implemented',
  jsonb_build_object(
    'features_added', ARRAY[
      'Live API keys configuration',
      'Production testing suite',
      'Real-time monitoring',
      'Production readiness checker',
      'Enhanced checklist management'
    ],
    'security_improvements', ARRAY[
      'Webhook IP validation',
      'Signature verification',
      'Secure key storage',
      'Audit logging'
    ]
  )
);