import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Filter, Search } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  category: string;
  entity_type: string;
  entity_id: string;
  message: string;
  event_time: string;
  ip_address?: string;
  user_agent?: string;
}

export const AdminActionsLog = () => {
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-users-for-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'admin');
      
      if (error) throw error;
      return data;
    }
  });

  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['audit-logs', selectedUser, selectedAction, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('event_time', { ascending: false })
        .limit(100);

      if (selectedUser !== "all") {
        query = query.eq('user_id', selectedUser);
      }

      if (selectedAction !== "all") {
        query = query.eq('action', selectedAction);
      }

      if (searchTerm) {
        query = query.or(`message.ilike.%${searchTerm}%,entity_type.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data as AuditLog[];
    }
  });

  const getActionBadgeVariant = (action: string) => {
    switch (action.toLowerCase()) {
      case 'insert':
      case 'create':
        return 'default';
      case 'update':
      case 'edit':
        return 'secondary';
      case 'delete':
      case 'remove':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'settings':
        return 'default';
      case 'products':
        return 'secondary';
      case 'orders':
        return 'outline';
      case 'users':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Admin Actions Log
        </CardTitle>
        <CardDescription>
          View detailed logs of all admin user actions and system changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search actions, entities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="min-w-[150px]">
            <label className="text-sm font-medium mb-2 block">Admin User</label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {adminUsers?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || 'Unnamed Admin'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[120px]">
            <label className="text-sm font-medium mb-2 block">Action</label>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="INSERT">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedUser("all");
              setSelectedAction("all");
              setSearchTerm("");
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Clear Filters
          </Button>
        </div>

        {/* Audit Log Table */}
        <div className="rounded-md border">
          {isLoading ? (
            <div className="p-8 text-center">Loading audit logs...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.event_time), 'MMM dd, HH:mm:ss')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.user_name || 'System'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCategoryBadgeVariant(log.category)}>
                        {log.category || 'System'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.entity_type}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {log.message}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {log.ip_address && (
                          <div>IP: {log.ip_address}</div>
                        )}
                        {log.entity_id && (
                          <div className="font-mono">ID: {log.entity_id.slice(0, 8)}...</div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {auditLogs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No audit logs found matching your criteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {auditLogs && auditLogs.length > 0 && (
          <div className="text-sm text-muted-foreground text-center">
            Showing {auditLogs.length} most recent actions
          </div>
        )}
      </CardContent>
    </Card>
  );
};