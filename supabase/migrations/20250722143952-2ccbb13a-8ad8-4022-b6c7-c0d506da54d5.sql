
-- Phase 1: Core Infrastructure Tables
-- 1. Authentication & User Management

-- Create user roles enum
CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'staff', 'dispatch_rider');

-- Create user status enum  
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'pending');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  role public.user_role NOT NULL DEFAULT 'staff',
  status public.user_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create helper function for timestamps
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Add updated_at trigger to profiles
CREATE TRIGGER handle_updated_at_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- 2. Product Catalog System

-- Create product status enum
CREATE TYPE public.product_status AS ENUM ('active', 'archived', 'draft');

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  banner_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add updated_at trigger to categories
CREATE TRIGGER handle_updated_at_categories
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  price NUMERIC NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  ingredients TEXT,
  nutritional_info JSONB,
  status public.product_status NOT NULL DEFAULT 'draft',
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add updated_at trigger to products
CREATE TRIGGER handle_updated_at_products
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- 3. Order Management System

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partially_refunded');

-- Create order type enum
CREATE TYPE public.order_type AS ENUM ('delivery', 'pickup', 'dine_in');

-- Create customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at trigger to customers
CREATE TRIGGER handle_updated_at_customers
BEFORE UPDATE ON public.customers
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  order_type public.order_type NOT NULL DEFAULT 'delivery',
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_address TEXT,
  pickup_time TIMESTAMPTZ,
  delivery_time TIMESTAMPTZ,
  special_instructions TEXT,
  payment_method TEXT,
  payment_reference TEXT,
  assigned_rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add updated_at trigger to orders
CREATE TRIGGER handle_updated_at_orders
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE PROCEDURE public.set_current_timestamp_updated_at();

-- Create order items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL,
  total_price NUMERIC NOT NULL,
  customizations JSONB,
  special_instructions TEXT
);

-- 4. Security & Audit System

-- Create audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  category TEXT,
  entity_type TEXT,
  entity_id UUID,
  message TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT
);

-- Create indexes for audit logs
CREATE INDEX ON public.audit_logs (event_time DESC);
CREATE INDEX ON public.audit_logs (category);
CREATE INDEX ON public.audit_logs (user_id);
CREATE INDEX ON public.audit_logs (entity_type);
CREATE INDEX ON public.audit_logs (entity_id);

-- Security definer function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id_to_check UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
    SELECT role::TEXT FROM profiles WHERE id = user_id_to_check;
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid();
$$;

-- Create trigger function for new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  admin_count INTEGER;
  new_user_role public.user_role;
BEGIN
  -- Lock table to prevent race condition
  LOCK TABLE public.profiles IN EXCLUSIVE MODE;

  -- Check if any admin users exist
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'admin';

  -- If no admins exist, make this user an admin
  IF admin_count = 0 THEN
    new_user_role := 'admin';
  ELSE
    new_user_role := 'staff';
  END IF;

  -- Insert new profile
  INSERT INTO public.profiles (id, name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', new_user_role);
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin');

-- RLS Policies for categories
CREATE POLICY "Admins can manage categories"
ON public.categories FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can view categories"
ON public.categories FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policies for products
CREATE POLICY "Admins can manage products"
ON public.products FOR ALL
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Authenticated users can view products"
ON public.products FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS Policies for customers
CREATE POLICY "Staff and above can manage customers"
ON public.customers FOR ALL
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager', 'staff'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'manager', 'staff'));

-- RLS Policies for orders
CREATE POLICY "Admins and managers have full access to orders"
ON public.orders FOR ALL
USING (public.get_user_role(auth.uid()) IN ('admin', 'manager'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'manager'));

CREATE POLICY "Staff can view and create orders"
ON public.orders FOR SELECT
USING (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Staff can create orders"
ON public.orders FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'staff');

CREATE POLICY "Staff can update orders"
ON public.orders FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'staff');

-- RLS Policies for order items
CREATE POLICY "Order items access derived from parent order"
ON public.order_items FOR ALL
USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id));

-- RLS Policies for audit logs
CREATE POLICY "Admins can read all audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_admin());

CREATE POLICY "Anyone can insert logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true);

-- Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  order_count INTEGER;
  order_number TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO order_count FROM public.orders;
  order_number := 'ORD' || LPAD(order_count::TEXT, 6, '0');
  RETURN order_number;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_order_time ON public.orders(order_time DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_customers_email ON public.customers(email);
