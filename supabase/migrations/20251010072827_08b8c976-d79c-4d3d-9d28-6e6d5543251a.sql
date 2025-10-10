-- Fix: Add RLS policy to allow users to read their own roles
-- This breaks the circular dependency causing NULL role returns

CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Log the security fix
INSERT INTO audit_logs (
    action, 
    category, 
    message, 
    new_values
) VALUES (
    'rls_policy_fix_applied',
    'Security',
    'Added self-read RLS policy to user_roles table to fix recursive permission deadlock',
    jsonb_build_object(
        'policy_name', 'Users can view their own roles',
        'affected_roles', ARRAY['support_staff', 'staff', 'account_manager', 'admin_manager'],
        'issue', 'recursive_rls_deadlock',
        'fixed_at', now()
    )
);