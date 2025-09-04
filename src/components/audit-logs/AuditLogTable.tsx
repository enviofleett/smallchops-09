
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow } from "@/components/ui/responsive-table";

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

const PAGE_SIZE = 20;

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

      let query = supabase
        .from("audit_logs")
        .select(`
          *,
          profiles!audit_logs_user_id_fkey(role)
        `)
        .order("event_time", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // ADMIN-ONLY FILTER: Show only admin users + chudesyl@gmail.com + system activities
      query = query.or(
        `user_id.is.null,profiles.role.eq.admin,user_name.eq.chudesyl@gmail.com`
      );

      // Additional filters
      if (filters.category) query = query.eq("category", filters.category);
      if (filters.user) query = query.ilike("user_name", `%${filters.user}%`);
      if (filters.dateFrom) query = query.gte("event_time", filters.dateFrom);
      if (filters.dateTo) query = query.lte("event_time", filters.dateTo + "T23:59:59");
      if (filters.search) {
        // Only filter on searchable text columns for simplicity
        query = query.or(
          [
            `action.ilike.%${filters.search}%`,
            `entity_type.ilike.%${filters.search}%`,
            `message.ilike.%${filters.search}%`
          ].join(",")
        );
      }
      const { data, error } = await query;
      if (error) {
        setLogs([]);
        setHasMore(false);
        setLoading(false);
        return;
      }
      setLogs(data as AuditLogRow[]);
      setHasMore((data as AuditLogRow[]).length === PAGE_SIZE);
      setLoading(false);
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
                label="User" 
                value={log.user_name || log.user_id || <span className="text-gray-300">system</span>} 
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
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Note:</strong> Showing activities from admin users and system operations only.
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
            <TableHead>User</TableHead>
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
                  {log.user_name || log.user_id || <span className="text-gray-300">system</span>}
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
