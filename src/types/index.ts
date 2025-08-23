/**
 * Comprehensive Type Definitions for Production Readiness
 * This file contains all the necessary type definitions to ensure type safety across the application
 */

// Re-export existing type modules for centralized access
export * from './auth';
export * from './customers';
export * from './database';
export * from './orders';
export * from './products';

// Core application types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error handling types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
  statusCode?: number;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: any;
}

// Payment processing types
export interface PaymentConfiguration {
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
  testMode: boolean;
  environment: 'test' | 'live';
}

export interface PaymentRequest {
  amount: number;
  email: string;
  currency?: string;
  reference?: string;
  metadata?: Record<string, any>;
  callback_url?: string;
}

export interface PaymentResponse {
  success: boolean;
  authorization_url?: string;
  access_code?: string;
  reference?: string;
  payment_url?: string;
  error?: string;
}

// Business configuration types
export interface BusinessSettings {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  website_url?: string;
  default_vat_rate?: number;
  created_at: string;
  updated_at: string;
}

// System health and monitoring types
export interface SystemHealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'down';
  message: string;
  responseTime?: number;
  timestamp: string;
}

export interface ProductionMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  activeUsers: number;
  timestamp: string;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

export interface FormState<T = any> {
  data: T;
  errors: ValidationError[];
  isSubmitting: boolean;
  isValid: boolean;
}

// Environment configuration types
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  VITE_PAYSTACK_PUBLIC_KEY?: string;
  VITE_APP_URL?: string;
}

// Audit and security types
export interface SecurityAuditResult {
  score: number;
  issues: SecurityIssue[];
  recommendations: string[];
  lastAuditDate: string;
}

export interface SecurityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  recommendation: string;
}

// Database operation types
export interface DatabaseOperation<T = any> {
  operation: 'select' | 'insert' | 'update' | 'delete';
  table: string;
  data?: T;
  conditions?: Record<string, any>;
  timestamp: string;
}

// Utility types for better type safety
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Status types used across the application
export type Status = 'active' | 'inactive' | 'pending' | 'suspended' | 'archived';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';

// Component prop types for consistent interfaces
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
  'data-testid'?: string;
}

export interface LoadingState {
  isLoading: boolean;
  loadingText?: string;
}

export interface ErrorState {
  error?: Error | string;
  onRetry?: () => void;
}

// API client configuration
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
}

// Feature flag types
export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  rolloutPercentage?: number;
}

// Notification types
export interface NotificationConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Export utility type guards
export const isApiError = (error: any): error is AppError => {
  return error && typeof error.code === 'string' && typeof error.message === 'string';
};

export const isValidationError = (error: any): error is ValidationError => {
  return error && typeof error.field === 'string' && typeof error.message === 'string';
};

// Type-safe environment variable access
export const getEnvironmentConfig = (): EnvironmentConfig => {
  return {
    NODE_ENV: (import.meta.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    VITE_PAYSTACK_PUBLIC_KEY: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    VITE_APP_URL: import.meta.env.VITE_APP_URL,
  };
};