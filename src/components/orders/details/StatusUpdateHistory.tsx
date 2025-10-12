import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, User, Clock, ArrowRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow } from "@/components/ui/responsive-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

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

  const isMobile = useIsMobile();

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
              <Skeleton className="h-10 w-full" />
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
        <ResponsiveTable
          mobileComponent={
            <div className="space-y-3">
              {history.map((record) => (
                <MobileCard key={record.id}>
                  <MobileCardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${getStatusColor(record.old_status)} text-white text-xs`}>
                        {getStatusLabel(record.old_status)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge className={`${getStatusColor(record.new_status)} text-white text-xs`}>
                        {getStatusLabel(record.new_status)}
                      </Badge>
                    </div>
                  </MobileCardHeader>
                  <MobileCardContent>
                    <MobileCardRow
                      label="Changed By"
                      value={
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {record.admin_name || record.admin_email || 'System'}
                          </span>
                        </div>
                      }
                    />
                    <MobileCardRow
                      label="Date & Time"
                      value={
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(record.changed_at), 'MMM dd, yyyy - hh:mm a')}
                          </span>
                        </div>
                      }
                    />
                  </MobileCardContent>
                </MobileCard>
              ))}
            </div>
          }
        >
          <div className="rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Previous Status</TableHead>
                  <TableHead className="w-[180px]">New Status</TableHead>
                  <TableHead>Changed By</TableHead>
                  <TableHead className="w-[200px]">Date & Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Badge className={`${getStatusColor(record.old_status)} text-white`}>
                        {getStatusLabel(record.old_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Badge className={`${getStatusColor(record.new_status)} text-white`}>
                          {getStatusLabel(record.new_status)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {record.admin_name || record.admin_email || 'System'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(record.changed_at), 'MMM dd, yyyy - hh:mm a')}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ResponsiveTable>
      </CardContent>
    </Card>
  );
}
