import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  CheckCircle, 
  ChefHat, 
  Truck, 
  ShoppingBag, 
  XCircle,
  User,
  UserX,
  Edit,
  CreditCard,
  Clock,
  Search,
  Filter,
  FileDown,
  AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { Button } from '@/components/ui/button';

interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  category: string;
  entity_type?: string;
  entity_id?: string;
  message: string;
  old_values?: any;
  new_values?: any;
  event_time: string;
  created_at: string;
}

interface OrderHistoryTabProps {
  detailedOrderData?: {
    audit_logs?: AuditLog[];
  };
  isLoading: boolean;
  error?: any;
  order: {
    id: string;
    order_number: string;
  };
}

const getActionIcon = (action: string, newValues?: any) => {
  // Status-specific icons
  if (action === 'order_status_updated' && newValues?.status) {
    const status = newValues.status;
    if (status === 'pending') return <Package className="w-4 h-4" />;
    if (status === 'confirmed') return <CheckCircle className="w-4 h-4" />;
    if (status === 'preparing') return <ChefHat className="w-4 h-4" />;
    if (status === 'ready') return <ShoppingBag className="w-4 h-4" />;
    if (status === 'out_for_delivery' || status === 'in_transit') return <Truck className="w-4 h-4" />;
    if (status === 'delivered' || status === 'completed') return <CheckCircle className="w-4 h-4" />;
    if (status === 'cancelled') return <XCircle className="w-4 h-4" />;
  }
  
  // Action-specific icons
  if (action === 'rider_assigned' || action === 'rider_reassigned') return <Truck className="w-4 h-4" />;
  if (action === 'rider_unassigned') return <UserX className="w-4 h-4" />;
  if (action === 'order_updated') return <Edit className="w-4 h-4" />;
  if (action === 'payment_updated') return <CreditCard className="w-4 h-4" />;
  if (action === 'order_cancelled') return <XCircle className="w-4 h-4" />;
  
  return <Clock className="w-4 h-4" />;
};

const getActionColor = (action: string, newValues?: any) => {
  if (action === 'order_status_updated' && newValues?.status) {
    const status = newValues.status;
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (status === 'confirmed') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (status === 'preparing') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (status === 'ready') return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (status === 'out_for_delivery' || status === 'in_transit') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (status === 'delivered' || status === 'completed') return 'bg-green-100 text-green-800 border-green-200';
    if (status === 'cancelled') return 'bg-red-100 text-red-800 border-red-200';
  }
  
  if (action === 'rider_assigned' || action === 'rider_reassigned') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (action === 'rider_unassigned') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (action === 'payment_updated') return 'bg-green-100 text-green-800 border-green-200';
  if (action === 'order_cancelled') return 'bg-red-100 text-red-800 border-red-200';
  
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const formatActionName = (action: string) => {
  return action
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const ChangeComparison: React.FC<{ oldValues?: any; newValues?: any }> = ({ oldValues, newValues }) => {
  if (!oldValues && !newValues) return null;
  
  const renderValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">None</span>;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-md border border-border/50 space-y-2">
      {oldValues && (
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">From: </span>
          <span className="text-foreground/80">{renderValue(oldValues)}</span>
        </div>
      )}
      {newValues && (
        <div className="text-xs">
          <span className="font-medium text-muted-foreground">To: </span>
          <span className="text-foreground font-medium">{renderValue(newValues)}</span>
        </div>
      )}
    </div>
  );
};

export const OrderHistoryTab: React.FC<OrderHistoryTabProps> = ({ 
  detailedOrderData, 
  isLoading, 
  error, 
  order 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [adminFilter, setAdminFilter] = useState<string>('all');

  const auditLogs = detailedOrderData?.audit_logs || [];

  // Get unique actions and admins for filters
  const uniqueActions = useMemo(() => {
    const actions = new Set(auditLogs.map(log => log.action));
    return Array.from(actions);
  }, [auditLogs]);

  const uniqueAdmins = useMemo(() => {
    const admins = new Set(auditLogs.map(log => log.user_name));
    return Array.from(admins);
  }, [auditLogs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = searchQuery === '' || 
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.user_name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesAdmin = adminFilter === 'all' || log.user_name === adminFilter;

      return matchesSearch && matchesAction && matchesAdmin;
    });
  }, [auditLogs, searchQuery, actionFilter, adminFilter]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: { [key: string]: AuditLog[] } = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    filteredLogs.forEach(log => {
      const date = new Date(log.event_time || log.created_at);
      if (isToday(date)) {
        groups.today.push(log);
      } else if (isYesterday(date)) {
        groups.yesterday.push(log);
      } else if (isThisWeek(date)) {
        groups.thisWeek.push(log);
      } else {
        groups.older.push(log);
      }
    });

    return groups;
  }, [filteredLogs]);

  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Admin', 'Action', 'Message', 'Old Values', 'New Values'].join(','),
      ...filteredLogs.map(log => [
        log.event_time || log.created_at,
        log.user_name,
        log.action,
        `"${log.message}"`,
        log.old_values ? `"${JSON.stringify(log.old_values)}"` : '',
        log.new_values ? `"${JSON.stringify(log.new_values)}"` : ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `order-${order.order_number}-history.csv`;
    a.click();
  };

  if (isLoading) {
    return (
      <Card className="rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-3 text-muted-foreground">Loading order history...</span>
        </div>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-center py-10 text-destructive">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>Error loading order history</span>
        </div>
      </Card>
    );
  }

  if (auditLogs.length === 0) {
    return (
      <Card className="rounded-lg border shadow-sm p-6">
        <div className="text-center py-10 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No activity history available</p>
          <p className="text-xs mt-1">Order changes will appear here</p>
        </div>
      </Card>
    );
  }

  const renderDateGroup = (title: string, logs: AuditLog[]) => {
    if (logs.length === 0) return null;

    return (
      <div key={title} className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background py-2">
          {title}
        </h4>
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${getActionColor(log.action, log.new_values)}`}>
              {getActionIcon(log.action, log.new_values)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs font-medium">
                    {formatActionName(log.action)}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {log.user_name}
                  </span>
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(log.event_time || log.created_at), { addSuffix: true })}
                </time>
              </div>
              <p className="text-sm text-foreground mb-1">{log.message}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(log.event_time || log.created_at), 'MMM dd, yyyy • h:mm:ss a')}
              </p>
              {(log.old_values || log.new_values) && (
                <ChangeComparison oldValues={log.old_values} newValues={log.new_values} />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="rounded-lg border shadow-sm">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">Order Activity History</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Complete audit trail of all changes ({filteredLogs.length} events)
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>
                  {formatActionName(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={adminFilter} onValueChange={setAdminFilter}>
            <SelectTrigger>
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Admins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Admins</SelectItem>
              {uniqueAdmins.map(admin => (
                <SelectItem key={admin} value={admin}>
                  {admin}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Timeline */}
        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
          {renderDateGroup('Today', groupedLogs.today)}
          {renderDateGroup('Yesterday', groupedLogs.yesterday)}
          {renderDateGroup('This Week', groupedLogs.thisWeek)}
          {renderDateGroup('Older', groupedLogs.older)}
        </div>

        {filteredLogs.length === 0 && searchQuery && (
          <div className="text-center py-10 text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No results found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </Card>
  );
};
