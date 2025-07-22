
import React, { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getCommunicationLogs, CommunicationLog } from '@/api/communications';
import { CommunicationLogStatus } from '@/types/communications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, HelpCircle, Mail, MessageSquare, XCircle, SkipForward } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"


const statusOptions: (CommunicationLogStatus | 'all')[] = ['all', 'sent', 'failed', 'skipped', 'delivered', 'bounced'];

const statusMeta: Record<CommunicationLogStatus, { icon: React.ElementType; color: string; label: string }> = {
  sent: { icon: CheckCircle, color: 'text-blue-500', label: 'Sent' },
  delivered: { icon: CheckCircle, color: 'text-green-500', label: 'Delivered' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  bounced: { icon: AlertCircle, color: 'text-yellow-500', label: 'Bounced' },
  skipped: { icon: SkipForward, color: 'text-gray-500', label: 'Skipped' },
};


const PAGE_SIZE = 15;

const CommunicationLogsTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<CommunicationLogStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [debounceSearch, setDebounceSearch] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(debounceSearch);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [debounceSearch]);

  const { data, isLoading, isError, error } = useQuery<{
    logs: CommunicationLog[];
    count: number;
  }>({
    queryKey: ['communicationLogs', { currentPage, statusFilter, searchQuery }],
    queryFn: () => getCommunicationLogs({ page: currentPage, pageSize: PAGE_SIZE, status: statusFilter, searchQuery }),
    placeholderData: keepPreviousData,
  });

  const logs = data?.logs ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Communication Logs</CardTitle>
        <p className="text-sm text-muted-foreground">
          An audit trail of all automated notifications sent to customers.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Input 
            placeholder="Search by recipient, order ID, or error..."
            value={debounceSearch}
            onChange={(e) => setDebounceSearch(e.target.value)}
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setCurrentPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead className="w-[100px]">Channel</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : isError ? (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center text-red-500 py-8">
                      Error loading logs: {error.message}
                    </TableCell>
                  </TableRow>
              ) : logs.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No communication logs found.
                    </TableCell>
                  </TableRow>
              ) : (
                logs.map(log => {
                  const meta = statusMeta[log.status as CommunicationLogStatus] || { icon: HelpCircle, color: 'text-gray-400', label: log.status };
                  const Icon = meta.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1.5">
                          {log.channel === 'email' ? <Mail className="h-3 w-3" /> : <MessageSquare className="h-3 w-3" />}
                          {log.channel.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.recipient}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'failed' ? 'destructive' : 'secondary'} className={`flex items-center gap-1.5 ${meta.color}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                             <Button variant="ghost" size="sm">View</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Log Details</DialogTitle>
                              <DialogDescription>Full details for communication log ID: {log.id}</DialogDescription>
                            </DialogHeader>
                            <div className="text-sm space-y-2 max-h-[60vh] overflow-y-auto pr-4">
                              <p><strong>Order ID:</strong> {log.order_id}</p>
                              <p><strong>Template:</strong> {log.template_name || 'N/A'}</p>
                              {log.channel === 'email' && <p><strong>Subject:</strong> {log.subject || 'N/A'}</p>}
                              {log.error_message && <p><strong>Error:</strong> <span className="text-red-600">{log.error_message}</span></p>}
                              <p><strong>Provider Response:</strong></p>
                              <pre className="bg-gray-100 p-2 rounded-md text-xs">
                                {JSON.stringify(log.provider_response, null, 2) || 'N/A'}
                              </pre>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalCount)} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} results
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}>
              Previous
            </Button>
            <span>Page {currentPage} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages}>
              Next
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
};

export default CommunicationLogsTab;
