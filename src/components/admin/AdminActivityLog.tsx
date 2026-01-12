import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, UserPlus, UserMinus, Edit } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AuditLog {
  id: string;
  action: string;
  message: string;
  user_name: string;
  category: string;
  event_time: string;
}

const actionIcons: Record<string, any> = {
  role_assigned: Shield,
  role_updated: Edit,
  role_revoked: UserMinus,
  admin_user_created: UserPlus,
  admin_user_activated: UserPlus,
  admin_user_deactivated: UserMinus,
};

const actionColors: Record<string, string> = {
  role_assigned: 'bg-blue-500',
  role_updated: 'bg-yellow-500',
  role_revoked: 'bg-red-500',
  admin_user_created: 'bg-green-500',
  admin_user_activated: 'bg-green-500',
  admin_user_deactivated: 'bg-red-500',
};

export function AdminActivityLog() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['admin-activity-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('audit_logs')
        .select('id, action, message, user_name, category, event_time')
        .eq('category', 'User Management')
        .order('event_time', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity logs found</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Performed By</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const Icon = actionIcons[log.action] || Shield;
            const color = actionColors[log.action] || 'bg-gray-500';
            
            return (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge className={color}>
                    <Icon className="h-3 w-3 mr-1" />
                    {log.action.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{log.message}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {log.user_name || 'System'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(log.event_time), { addSuffix: true })}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
