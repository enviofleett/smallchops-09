import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Clock, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface StatusUpdateHistoryProps {
  orderId: string;
}

interface StatusHistoryRecord {
  id: string;
  old_status: string;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  admin_name: string | null;
  admin_email: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-indigo-500',
  ready: 'bg-purple-500',
  out_for_delivery: 'bg-orange-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-gray-500';
}

function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] || status.replace('_', ' ');
}

export function StatusUpdateHistory({ orderId }: StatusUpdateHistoryProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['order-status-history', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_status_history')
        .select(`
          id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          profiles:changed_by (
            name,
            email
          )
        `)
        .eq('order_id', orderId)
        .order('changed_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(record => ({
        id: record.id,
        old_status: record.old_status,
        new_status: record.new_status,
        changed_by: record.changed_by,
        changed_at: record.changed_at,
        admin_name: Array.isArray(record.profiles) 
          ? record.profiles[0]?.name 
          : (record.profiles as any)?.name || null,
        admin_email: Array.isArray(record.profiles) 
          ? record.profiles[0]?.email 
          : (record.profiles as any)?.email || null,
      })) as StatusHistoryRecord[];
    },
    enabled: !!orderId,
    staleTime: 30000, // 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Status Update History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Status Update History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground text-sm">
            No status updates recorded yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          Status Update History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {history.map((record, index) => (
            <div
              key={record.id}
              className="relative flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {/* Timeline connector */}
              {index < history.length - 1 && (
                <div className="absolute left-[23px] top-[52px] w-0.5 h-[calc(100%+4px)] bg-border" />
              )}

              {/* Status change indicator */}
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${getStatusColor(record.old_status)} text-white text-xs px-2 py-0.5`}>
                  {getStatusLabel(record.old_status)}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <Badge className={`${getStatusColor(record.new_status)} text-white text-xs px-2 py-0.5`}>
                  {getStatusLabel(record.new_status)}
                </Badge>
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">
                    {record.admin_name || record.admin_email || 'System'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span>
                    {format(new Date(record.changed_at), 'MMM dd, yyyy - hh:mm a')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
