
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, User } from "lucide-react";
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow } from "@/components/ui/responsive-table";

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
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);

      try {
        // PRODUCTION SECURITY: Query admin activities with optimized approach
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

        // PRODUCTION FILTER: Show all admin activities and system operations
        // First get all profiles with admin role for enhanced display
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
          // If no admins found, only show system operations
          query = query.is('user_id', null);
        }

        // Additional production filters
        if (filters.category) {
          query = query.eq("category", filters.category);
        }
        
        if (filters.user) {
          query = query.ilike("user_name", `%${filters.user}%`);
        }
        
        if (filters.dateFrom) {
          query = query.gte("event_time", filters.dateFrom);
        }
        
        if (filters.dateTo) {
          query = query.lte("event_time", filters.dateTo + "T23:59:59");
        }
        
        if (filters.search) {
          // Enhanced search across multiple fields
          query = query.or(
            [
              `action.ilike.%${filters.search}%`,
              `entity_type.ilike.%${filters.search}%`,
              `message.ilike.%${filters.search}%`,
              `category.ilike.%${filters.search}%`,
              `user_name.ilike.%${filters.search}%`
            ].join(",")
          );
        }

        const { data, error } = await query;
        
        if (error) {
          console.error('Error fetching audit logs:', error);
          throw error;
        }

        // PRODUCTION ENHANCEMENT: Enrich logs with admin profile information
        const enrichedLogs = (data as AuditLogRow[]).map(log => ({
          ...log,
          // Add admin profile information for enhanced display
          admin_profile: log.user_id ? adminProfilesMap.get(log.user_id) : undefined,
          // Mask sensitive IP addresses partially for privacy
          ip_address: log.ip_address ? 
            log.ip_address.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.xxx.xxx') : 
            null,
          // Ensure user_agent doesn't contain sensitive info
          user_agent: log.user_agent ? 
            log.user_agent.substring(0, 100) + (log.user_agent.length > 100 ? '...' : '') : 
            null
        }));

        setLogs(enrichedLogs);
        setHasMore(enrichedLogs.length === PAGE_SIZE);
        
      } catch (error) {
        console.error('Error in fetchLogs:', error);
        setLogs([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, [filters, page]);

  const mobileComponent = (
    <div className="space-y-3">
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
                  <span className="capitalize font-semibold text-blue-700">{log.action}</span>
                </p>
                <p className="text-sm text-gray-600">{new Date(log.event_time).toLocaleString()}</p>
              </div>
              <div className="text-right">
                {log.category && (
                  <span className="inline-block px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                    {log.category}
                  </span>
                )}
              </div>
            </MobileCardHeader>
            
            <MobileCardContent>
              <MobileCardRow 
                label="Admin User" 
                value={<MobileAdminUserDisplay log={log} />} 
              />
              {log.entity_type && (
                <MobileCardRow 
                  label="Entity" 
                  value={log.entity_type} 
                />
              )}
              {log.message && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-600">Message:</span>
                  <div className="text-sm text-gray-900 mt-1 whitespace-pre-line break-words">
                    {log.message}
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
          disabled={page === 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {page}
        </span>
        <button
          className="px-4 py-2 bg-gray-100 rounded text-sm w-full sm:w-auto disabled:opacity-50"
          disabled={!hasMore || loading}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <h3 className="text-sm font-semibold text-blue-800">Production Security Monitor</h3>
        </div>
        <p className="text-sm text-blue-700">
          Tracking all administrative activities and system operations. IP addresses are partially masked for privacy compliance.
          {logs.length > 0 && (
            <span className="block mt-1 font-medium">
              Currently showing {logs.length} recent admin activities.
            </span>
          )}
        </p>
      </div>
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
            <TableHead>IP</TableHead>
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
                No logs found for these filters.
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {new Date(log.event_time).toLocaleString()}
                </TableCell>
                <TableCell>
                  <span className="font-medium text-gray-900">
                    {extractUsername(log)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="capitalize font-semibold text-blue-700">{log.action}</span>
                </TableCell>
                <TableCell>{log.category}</TableCell>
                <TableCell>{log.entity_type}</TableCell>
                <TableCell>
                  <div className="whitespace-pre-line break-all max-w-[260px]">
                    {log.message}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{log.ip_address || "-"}</span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {/* Pagination */}
      <div className="p-3 flex items-center justify-end gap-2">
        <button
          className="px-3 py-1 bg-gray-100 rounded text-sm disabled:opacity-50"
          disabled={page === 1 || loading}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        <span className="text-sm text-gray-500">
          Page {page}
        </span>
        <button
          className="px-3 py-1 bg-gray-100 rounded text-sm disabled:opacity-50"
          disabled={!hasMore || loading}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
      </ResponsiveTable>
    </div>
  );
};

export default AuditLogTable;
