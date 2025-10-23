
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, User, AlertTriangle, Clock } from "lucide-react";
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow } from "@/components/ui/responsive-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SafeHtml } from "@/components/ui/safe-html";
import { useToast } from "@/hooks/use-toast";
import { 
  secureAuditLogData, 
  sanitizeSearchFilters, 
  checkAuditLogRateLimit,
  logAuditLogAccess,
  type SecureAuditLogRow 
} from "@/utils/auditLogSecurity";

interface AdminProfile {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
}

interface AuditLogRow {
  id: string;
  event_time: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  message: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  admin_profile?: AdminProfile;
}

interface Props {
  filters: {
    category: string;
    user: string;
    dateFrom: string;
    dateTo: string;
    search: string;
  };
}

/**
 * PRODUCTION UTILITY: Convert technical action codes to user-friendly messages
 * Maps audit log actions to readable descriptions for admin dashboard
 */
const getActionMessage = (action: string, category?: string | null, entityType?: string | null): string => {
  const actionMessages: Record<string, string> = {
    // Authentication & User Management
    'admin_login': 'Admin logged in',
    'admin_logout': 'Admin logged out',
    'admin_signup': 'New admin account created',
    'user_created': 'User account created',
    'user_updated': 'User profile updated',
    'user_deleted': 'User account deleted',
    'password_reset': 'Password reset initiated',
    'email_verified': 'Email address verified',
    
    // Order Management
    'order_created': 'New order placed',
    'order_updated': 'Order details updated',
    'order_status_changed': 'Order status changed',
    'order_status_updated': 'Order status updated',
    'order_cancelled': 'Order cancelled',
    'order_confirmed': 'Order confirmed',
    'order_completed': 'Order completed',
    'order_refunded': 'Order refunded',
    'payment_confirmed': 'Payment confirmed',
    'payment_failed': 'Payment failed',
    
    // Product Management
    'product_created': 'Product added',
    'product_updated': 'Product updated',
    'product_deleted': 'Product removed',
    'product_price_changed': 'Product price changed',
    'inventory_updated': 'Inventory updated',
    
    // System Administration
    'settings_updated': 'System settings changed',
    'permissions_updated': 'User permissions changed',
    'email_sent': 'Email notification sent',
    'backup_created': 'System backup created',
    'maintenance_mode': 'Maintenance mode toggled',
    
    // Security Events
    'login_attempt_failed': 'Failed login attempt',
    'session_expired': 'User session expired',
    'suspicious_activity': 'Suspicious activity detected',
    'rate_limit_exceeded': 'Rate limit exceeded',
    'access_denied': 'Access denied',
    
    // Data Management
    'data_export': 'Data exported',
    'data_import': 'Data imported',
    'bulk_update': 'Bulk data update',
    'data_cleanup': 'Data cleanup performed',
    
    // Communication
    'email_template_updated': 'Email template updated',
    'notification_sent': 'Notification sent',
    'sms_sent': 'SMS message sent',
    
    // Delivery Management
    'rider_assigned': 'Delivery rider assigned',
    'delivery_scheduled': 'Delivery scheduled',
    'delivery_completed': 'Delivery completed',
    'delivery_failed': 'Delivery failed',
    
    // Financial
    'payment_processed': 'Payment processed',
    'refund_issued': 'Refund issued',
    'transaction_created': 'Transaction created',
    'invoice_generated': 'Invoice generated',
  };
  
  // Try exact match first
  if (actionMessages[action]) {
    return actionMessages[action];
  }
  
  // Try pattern matching for dynamic actions
  if (action.includes('_created') && entityType) {
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} created`;
  }
  if (action.includes('_updated') && entityType) {
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} updated`;
  }
  if (action.includes('_deleted') && entityType) {
    return `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} deleted`;
  }
  
  // Category-based fallbacks
  if (category) {
    switch (category.toLowerCase()) {
      case 'user management':
        return `User ${action.replace('_', ' ')}`;
      case 'order processing':
        return `Order ${action.replace('_', ' ')}`;
      case 'security':
        return `Security: ${action.replace('_', ' ')}`;
      case 'system maintenance':
        return `System ${action.replace('_', ' ')}`;
      default:
        return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
  
  // Default: humanize the action string
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * PRODUCTION UTILITY: Extract clean username from email or display name
 * Handles various username formats for audit log display
 */
const extractUsername = (log: AuditLogRow): string => {
  // System operations
  if (!log.user_id) {
    return "System";
  }

  // Admin profile email - extract username part
  if (log.admin_profile?.email) {
    const emailParts = log.admin_profile.email.split("@");
    return emailParts[0] || log.admin_profile.email;
  }

  // Fallback to user_name - extract username if it's an email
  if (log.user_name) {
    if (log.user_name.includes("@")) {
      const emailParts = log.user_name.split("@");
      return emailParts[0] || log.user_name;
    }
    return log.user_name;
  }

  // Last resort - show truncated user ID
  return `admin_${log.user_id.substring(0, 6)}`;
};

const PAGE_SIZE = 20;

/**
 * PRODUCTION COMPONENT: Enhanced Admin User Display
 * Shows admin user information with role badges and proper fallbacks
 */
const AdminUserDisplay: React.FC<{ log: AuditLogRow }> = ({ log }) => {
  // System operation (no user)
  if (!log.user_id) {
    return (
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400 font-medium">System</span>
      </div>
    );
  }

  // Admin user with profile
  if (log.admin_profile) {
    return (
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-blue-600" />
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900">
              {log.admin_profile.email}
            </span>
            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200">
              {log.admin_profile.role.toUpperCase()}
            </Badge>
          </div>
          {log.user_name && log.user_name !== log.admin_profile.email && (
            <span className="text-xs text-gray-500">
              Display: {log.user_name}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Fallback for admin without profile (should not happen in production)
  return (
    <div className="flex items-center gap-2">
      <User className="w-4 h-4 text-orange-500" />
      <div className="flex flex-col gap-1">
        <span className="font-medium text-gray-900">
          {log.user_name || `User ${log.user_id?.substring(0, 8)}...`}
        </span>
        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">
          ADMIN
        </Badge>
      </div>
    </div>
  );
};

/**
 * PRODUCTION COMPONENT: Mobile Admin User Display (Compact Version)
 */
const MobileAdminUserDisplay: React.FC<{ log: AuditLogRow }> = ({ log }) => {
  // System operation
  if (!log.user_id) {
    return (
      <div className="flex items-center gap-2">
        <Shield className="w-3 h-3 text-gray-400" />
        <span className="text-gray-400 text-sm">System</span>
      </div>
    );
  }

  // Admin user with profile
  if (log.admin_profile) {
    return (
      <div className="flex items-center gap-2">
        <User className="w-3 h-3 text-blue-600" />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">
            {log.admin_profile.email}
          </span>
          <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 border-blue-200 w-fit">
            {log.admin_profile.role.toUpperCase()}
          </Badge>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="flex items-center gap-2">
      <User className="w-3 h-3 text-orange-500" />
      <div className="flex flex-col">
        <span className="text-sm font-medium">
          {log.user_name || `User ${log.user_id?.substring(0, 8)}...`}
        </span>
        <Badge variant="outline" className="text-xs text-orange-600 border-orange-300 w-fit">
          ADMIN
        </Badge>
      </div>
    </div>
  );
};

const AuditLogTable: React.FC<Props> = ({ filters }) => {
  const [logs, setLogs] = useState<SecureAuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const { toast } = useToast();

  // Memoize sanitized filters to prevent unnecessary re-renders
  const sanitizedFilters = useMemo(() => sanitizeSearchFilters(filters), [filters]);

  // Rate limit retry timer
  useEffect(() => {
    if (retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter(prev => {
          if (prev <= 1) {
            setRateLimited(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [retryAfter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [sanitizedFilters]);

  // Enhanced fetch function with security measures
  const fetchLogs = useCallback(async () => {
    if (rateLimited) {
      return;
    }

    setLoading(true);

    try {
      // Check rate limits before proceeding
      const { data: user } = await supabase.auth.getUser();
      const rateLimitCheck = await checkAuditLogRateLimit(user.user?.id || null);
      
      if (!rateLimitCheck.allowed) {
        setRateLimited(true);
        setRetryAfter(rateLimitCheck.retryAfter || 60);
        toast({
          title: "Rate Limit Exceeded",
          description: rateLimitCheck.reason || "Please wait before requesting more audit logs.",
          variant: "destructive",
        });
        return;
      }

      // PRODUCTION SECURITY: Query admin activities with enhanced security
      let query = supabase
        .from("audit_logs")
        .select(`
          id,
          event_time,
          user_id,
          user_name,
          action,
          category,
          entity_type,
          entity_id,
          message,
          old_values,
          new_values,
          ip_address,
          user_agent
        `)
        .order("event_time", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // Get admin profiles for enhanced display
      const { data: adminProfiles, error: adminError } = await supabase
        .from('profiles')
        .select('id, email, role, is_active')
        .eq('role', 'admin')
        .eq('is_active', true);

      if (adminError) {
        console.error('Error fetching admin profiles:', adminError);
        throw adminError;
      }

      const adminIds = adminProfiles?.map(p => p.id) || [];
      const adminProfilesMap = new Map(
        adminProfiles?.map(profile => [profile.id, profile]) || []
      );
      
      // Filter for admin users OR system operations (null user_id)
      if (adminIds.length > 0) {
        query = query.or(`user_id.is.null,user_id.in.(${adminIds.join(',')})`);
      } else {
        query = query.is('user_id', null);
      }

      // Apply sanitized filters safely
      if (sanitizedFilters.category) {
        query = query.eq("category", sanitizedFilters.category);
      }
      
      if (sanitizedFilters.user) {
        query = query.ilike("user_name", `%${sanitizedFilters.user}%`);
      }
      
      if (sanitizedFilters.dateFrom) {
        query = query.gte("event_time", sanitizedFilters.dateFrom);
      }
      
      if (sanitizedFilters.dateTo) {
        query = query.lte("event_time", sanitizedFilters.dateTo + "T23:59:59");
      }
      
      if (sanitizedFilters.search) {
        // Enhanced search with length limits
        const searchTerm = sanitizedFilters.search.substring(0, 50);
        query = query.or(
          [
            `action.ilike.%${searchTerm}%`,
            `entity_type.ilike.%${searchTerm}%`,
            `message.ilike.%${searchTerm}%`,
            `category.ilike.%${searchTerm}%`,
            `user_name.ilike.%${searchTerm}%`
          ].join(",")
        );
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching audit logs:', error);
        throw error;
      }

      // PRODUCTION SECURITY: Process logs with security utilities
      const secureEnrichedLogs = (data as AuditLogRow[]).map(log => {
        const enrichedLog: SecureAuditLogRow = {
          ...log,
          admin_profile: log.user_id ? adminProfilesMap.get(log.user_id) : undefined,
        };
        
        // Apply comprehensive security processing
        return secureAuditLogData(enrichedLog);
      });

      setLogs(secureEnrichedLogs);
      setHasMore(secureEnrichedLogs.length === PAGE_SIZE);
      
      // Log audit log access for monitoring
      await logAuditLogAccess(user.user?.id || null, sanitizedFilters, secureEnrichedLogs.length);
        
    } catch (error) {
      console.error('Error in fetchLogs:', error);
      setLogs([]);
      setHasMore(false);
      toast({
        title: "Error Loading Audit Logs",
        description: "Failed to load audit logs. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [rateLimited, page, sanitizedFilters, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Enhanced secure mobile component
  const mobileComponent = (
    <div className="space-y-3">
      {rateLimited && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Rate limit exceeded. Please wait {retryAfter} seconds before requesting more data.
          </AlertDescription>
        </Alert>
      )}
      
      {loading ? (
        <div className="flex justify-center py-7">
          <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No logs found for these filters.</p>
        </div>
      ) : (
        logs.map((log) => (
          <MobileCard key={log.id}>
            <MobileCardHeader>
              <div>
                 <p className="font-medium text-gray-800">
                   <SafeHtml className="capitalize font-semibold text-blue-700">
                     {getActionMessage(log.action, log.category, log.entity_type)}
                   </SafeHtml>
                 </p>
                <p className="text-sm text-gray-600">{new Date(log.event_time).toLocaleString()}</p>
              </div>
              <div className="text-right">
                {log.category && (
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    <SafeHtml>{log.category}</SafeHtml>
                  </span>
                )}
              </div>
            </MobileCardHeader>
            
            <MobileCardContent>
              <MobileCardRow 
                label="Admin User" 
                value={<MobileAdminUserDisplay log={log as AuditLogRow} />} 
              />
              {log.entity_type && (
                <MobileCardRow 
                  label="Entity" 
                  value={<SafeHtml>{log.entity_type}</SafeHtml>} 
                />
              )}
              {log.message && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-600">Message:</span>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-line break-words">
                    <SafeHtml>{log.message}</SafeHtml>
                  </div>
                </div>
              )}
              {log.ip_address && (
                <MobileCardRow 
                  label="IP Address" 
                  value={<span className="text-xs font-mono">{log.ip_address}</span>} 
                />
              )}
            </MobileCardContent>
          </MobileCard>
        ))
      )}
      
      {/* Mobile Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          className="px-4 py-2 bg-gray-100 rounded text-sm w-full sm:w-auto disabled:opacity-50"
          disabled={page === 1 || loading || rateLimited}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {page}
        </span>
        <button
          className="px-4 py-2 bg-gray-100 rounded text-sm w-full sm:w-auto disabled:opacity-50"
          disabled={!hasMore || loading || rateLimited}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Enhanced Production Security Status */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-blue-800">Production Security Monitor - LIVE</h3>
        </div>
        <p className="text-sm text-blue-700">
          Comprehensive audit trail with enhanced security measures: XSS protection, rate limiting, 
          IP masking, and data sanitization enabled.
          {logs.length > 0 && (
            <span className="block mt-1 font-medium">
              Showing {logs.length} secure admin activities with privacy compliance.
            </span>
          )}
        </p>
      </div>

      {/* Rate Limit Warning */}
      {rateLimited && (
        <Alert className="mb-4">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Rate limit active. Next request available in {retryAfter} seconds. 
            This protects system resources and prevents abuse.
          </AlertDescription>
        </Alert>
      )}

      <ResponsiveTable
        className="relative border rounded-xl overflow-x-auto bg-white"
        mobileComponent={mobileComponent}
      >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-32">Date/Time</TableHead>
            <TableHead>Admin User</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>IP (Masked)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7}>
                <div className="flex justify-center py-7">
                  <Loader2 className="animate-spin h-5 w-5 text-gray-400" />
                </div>
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-gray-400 py-7 text-center">
                {rateLimited ? "Rate limited - please wait" : "No logs found for these filters."}
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {new Date(log.event_time).toLocaleString()}
                </TableCell>
                <TableCell>
                  <AdminUserDisplay log={log as AuditLogRow} />
                </TableCell>
                <TableCell>
                  <SafeHtml className="capitalize font-semibold text-blue-700">
                    {getActionMessage(log.action, log.category, log.entity_type)}
                  </SafeHtml>
                </TableCell>
                <TableCell>
                  <SafeHtml>{log.category || '-'}</SafeHtml>
                </TableCell>
                <TableCell>
                  <SafeHtml>{log.entity_type || '-'}</SafeHtml>
                </TableCell>
                <TableCell>
                  <div className="whitespace-pre-line break-all max-w-[260px]">
                    <SafeHtml>{log.message || '-'}</SafeHtml>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono">{log.ip_address || "-"}</span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Enhanced Pagination with Rate Limiting */}
      <div className="p-3 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {rateLimited && (
            <span className="text-orange-600">⏱ Rate limited: {retryAfter}s</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1 bg-gray-100 rounded text-sm disabled:opacity-50"
            disabled={page === 1 || loading || rateLimited}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page}
          </span>
          <button
            className="px-3 py-1 bg-gray-100 rounded text-sm disabled:opacity-50"
            disabled={!hasMore || loading || rateLimited}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
      </ResponsiveTable>
    </div>
  );
};

export default AuditLogTable;
