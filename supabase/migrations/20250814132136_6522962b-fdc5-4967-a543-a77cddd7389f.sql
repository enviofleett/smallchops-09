-- Phase 1: Enhanced Driver Registration and Profile Integration

-- First, ensure we have the proper role enum updated
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'staff', 'dispatch_rider');
EXCEPTION
    WHEN duplicate_object THEN
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dispatch_rider';
END $$;

-- Create driver invitations table for secure onboarding
CREATE TABLE IF NOT EXISTS public.driver_invitations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    driver_data JSONB NOT NULL DEFAULT '{}',
    invitation_token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    invited_by UUID REFERENCES auth.users(id),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Enable RLS on driver invitations
ALTER TABLE public.driver_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for driver invitations
CREATE POLICY "Admins can manage driver invitations" 
ON public.driver_invitations 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

-- Create order assignments table for tracking rider assignments
CREATE TABLE IF NOT EXISTS public.order_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    rider_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'accepted', 'en_route', 'delivered', 'cancelled')),
    notes TEXT,
    estimated_delivery_time TIMESTAMP WITH TIME ZONE,
    actual_delivery_time TIMESTAMP WITH TIME ZONE,
    UNIQUE(order_id) -- One rider per order
);

-- Enable RLS on order assignments
ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for order assignments
CREATE POLICY "Admins can manage order assignments" 
ON public.order_assignments 
FOR ALL 
USING (is_admin()) 
WITH CHECK (is_admin());

CREATE POLICY "Riders can view and update their assignments" 
ON public.order_assignments 
FOR SELECT 
USING (rider_id IN (SELECT id FROM drivers WHERE profile_id = auth.uid()));

CREATE POLICY "Riders can update assignment status" 
ON public.order_assignments 
FOR UPDATE 
USING (rider_id IN (SELECT id FROM drivers WHERE profile_id = auth.uid()))
WITH CHECK (rider_id IN (SELECT id FROM drivers WHERE profile_id = auth.uid()));

-- Create dispatch rider analytics table
CREATE TABLE IF NOT EXISTS public.dispatch_analytics (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    rider_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_assignments INTEGER NOT NULL DEFAULT 0,
    completed_assignments INTEGER NOT NULL DEFAULT 0,
    cancelled_assignments INTEGER NOT NULL DEFAULT 0,
    average_completion_time_minutes INTEGER,
    total_distance_km NUMERIC(10,2) DEFAULT 0,
    customer_rating NUMERIC(3,2) CHECK (customer_rating >= 1 AND customer_rating <= 5),
    earnings NUMERIC(10,2) DEFAULT 0,
    fuel_cost NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(rider_id, date)
);

-- Enable RLS on dispatch analytics
ALTER TABLE public.dispatch_analytics ENABLE ROW LEVEL SECURITY;

-- Create policies for dispatch analytics
CREATE POLICY "Admins can view all dispatch analytics" 
ON public.dispatch_analytics 
FOR SELECT 
USING (is_admin());

CREATE POLICY "Riders can view their own analytics" 
ON public.dispatch_analytics 
FOR SELECT 
USING (rider_id IN (SELECT id FROM drivers WHERE profile_id = auth.uid()));

-- Create function to automatically update dispatch analytics
CREATE OR REPLACE FUNCTION update_dispatch_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update analytics when assignment status changes
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO dispatch_analytics (rider_id, date, total_assignments, completed_assignments, cancelled_assignments)
        VALUES (
            NEW.rider_id,
            CURRENT_DATE,
            CASE WHEN NEW.status = 'assigned' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'delivered' THEN 1 ELSE 0 END,
            CASE WHEN NEW.status = 'cancelled' THEN 1 ELSE 0 END
        )
        ON CONFLICT (rider_id, date)
        DO UPDATE SET
            total_assignments = dispatch_analytics.total_assignments + CASE WHEN NEW.status = 'assigned' AND OLD.status != 'assigned' THEN 1 ELSE 0 END,
            completed_assignments = dispatch_analytics.completed_assignments + CASE WHEN NEW.status = 'delivered' AND OLD.status != 'delivered' THEN 1 ELSE 0 END,
            cancelled_assignments = dispatch_analytics.cancelled_assignments + CASE WHEN NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN 1 ELSE 0 END,
            updated_at = now();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for dispatch analytics
DROP TRIGGER IF EXISTS update_dispatch_analytics_trigger ON order_assignments;
CREATE TRIGGER update_dispatch_analytics_trigger
    AFTER INSERT OR UPDATE ON order_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_dispatch_analytics();

-- Create function to assign rider to order and update order table
CREATE OR REPLACE FUNCTION assign_rider_to_order(
    p_order_id UUID,
    p_rider_id UUID,
    p_assigned_by UUID DEFAULT auth.uid()
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment_id UUID;
BEGIN
    -- Check if admin is making the assignment
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can assign riders to orders';
    END IF;
    
    -- Check if order exists and is in assignable status
    IF NOT EXISTS (
        SELECT 1 FROM orders 
        WHERE id = p_order_id 
        AND status IN ('confirmed', 'preparing', 'ready')
    ) THEN
        RAISE EXCEPTION 'Order not found or not in assignable status';
    END IF;
    
    -- Check if rider exists and is active
    IF NOT EXISTS (
        SELECT 1 FROM drivers 
        WHERE id = p_rider_id 
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Rider not found or not active';
    END IF;
    
    -- Remove any existing assignment for this order
    DELETE FROM order_assignments WHERE order_id = p_order_id;
    
    -- Create new assignment
    INSERT INTO order_assignments (order_id, rider_id, assigned_by)
    VALUES (p_order_id, p_rider_id, p_assigned_by)
    RETURNING id INTO v_assignment_id;
    
    -- Update the order with assigned rider
    UPDATE orders 
    SET assigned_rider_id = p_rider_id,
        updated_at = now()
    WHERE id = p_order_id;
    
    -- Log the assignment action
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, new_values
    ) VALUES (
        'rider_assigned',
        'Order Management',
        'Rider assigned to order',
        p_assigned_by,
        p_order_id,
        jsonb_build_object(
            'order_id', p_order_id,
            'rider_id', p_rider_id,
            'assignment_id', v_assignment_id
        )
    );
    
    RETURN v_assignment_id;
END;
$$;

-- Create function to handle driver profile creation
CREATE OR REPLACE FUNCTION create_driver_with_profile(
    p_driver_data JSONB,
    p_create_profile BOOLEAN DEFAULT false,
    p_send_invitation BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_driver_id UUID;
    v_profile_id UUID;
    v_invitation_id UUID;
    v_email TEXT;
    v_name TEXT;
    v_result JSONB;
BEGIN
    -- Check if admin is creating the driver
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can create drivers';
    END IF;
    
    -- Extract email and name from driver data
    v_email := p_driver_data->>'email';
    v_name := p_driver_data->>'name';
    
    -- Validate required fields
    IF v_name IS NULL OR length(trim(v_name)) = 0 THEN
        RAISE EXCEPTION 'Driver name is required';
    END IF;
    
    -- Create driver record
    INSERT INTO drivers (
        name, phone, email, license_number, vehicle_type, 
        vehicle_brand, vehicle_model, license_plate, is_active
    ) VALUES (
        v_name,
        p_driver_data->>'phone',
        v_email,
        p_driver_data->>'license_number',
        (p_driver_data->>'vehicle_type')::vehicle_type,
        p_driver_data->>'vehicle_brand',
        p_driver_data->>'vehicle_model',
        p_driver_data->>'license_plate',
        COALESCE((p_driver_data->>'is_active')::boolean, true)
    ) RETURNING id INTO v_driver_id;
    
    v_result := jsonb_build_object(
        'driver_id', v_driver_id,
        'profile_created', false,
        'invitation_sent', false
    );
    
    -- Create invitation if email provided and requested
    IF p_send_invitation AND v_email IS NOT NULL AND length(trim(v_email)) > 0 THEN
        INSERT INTO driver_invitations (
            email, driver_data, invited_by
        ) VALUES (
            v_email, 
            p_driver_data || jsonb_build_object('driver_id', v_driver_id),
            auth.uid()
        ) RETURNING id INTO v_invitation_id;
        
        v_result := v_result || jsonb_build_object(
            'invitation_sent', true,
            'invitation_id', v_invitation_id
        );
    END IF;
    
    -- Log the action
    INSERT INTO audit_logs (
        action, category, message, user_id, entity_id, new_values
    ) VALUES (
        'driver_created_with_profile',
        'Driver Management',
        'Driver created with profile integration: ' || v_name,
        auth.uid(),
        v_driver_id,
        v_result
    );
    
    RETURN v_result;
END;
$$;