import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useQuery } from '@tanstack/react-query';
import { getOrders, updateOrder } from '@/api/orders';
import { AdminOrderStatusBadge } from '@/components/admin/AdminOrderStatusBadge';
import { OrderReceiptModal } from '@/components/customer/OrderReceiptModal';
import { DeliveryAssignmentDialog } from './DeliveryAssignmentDialog';
import { OrderDetailsModal } from './OrderDetailsModal';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { 
  Package, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Truck,
  AlertCircle,
  CheckCircle2,
  Printer,
  Eye,
  Settings,
  Filter,
  ChevronDown,
  Search
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface UnifiedDeliveryManagementProps {
  mode: 'ready' | 'all';
  selectedDate?: Date;
  typeFilter?: 'all' | 'delivery' | 'pickup';
  statusFilter?: string[];
  ordersOverride?: any[]; // For passing pre-filtered orders (e.g., delivery window filtered)
}

export function UnifiedDeliveryManagement({ 
  mode, 
  selectedDate, 
  typeFilter = 'all',
  statusFilter = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'],
  ordersOverride
}: UnifiedDeliveryManagementProps) {
  const [localStatusFilter, setLocalStatusFilter] = useState<string[]>(statusFilter);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<any>(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [typeLocal, setTypeLocal] = useState<'all' | 'delivery' | 'pickup'>(typeFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const { drivers } = useDriverManagement();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for delivery' },
    { value: 'delivered', label: 'Delivered' },
  ];

  // Build query parameters based on mode
  const queryParams = useMemo(() => {
    const params: any = {
      page: 1,
      pageSize: 1000,
    };

    if (mode === 'ready') {
      params.status = 'ready';
    } else {
      // For 'all' mode, don't set status to get multiple statuses
      if (selectedDate) {
        const dateString = format(selectedDate, 'yyyy-MM-dd');
        params.startDate = dateString;
        params.endDate = dateString;
      }
    }

    return params;
  }, [mode, selectedDate]);

  // Fetch orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['unified-orders', mode, selectedDate?.toISOString(), typeFilter, statusFilter],
    queryFn: () => getOrders(queryParams),
    refetchInterval: mode === 'ready' ? 30000 : undefined, // Auto-refresh ready orders
  });

  // Filter orders based on mode and filters
  const filteredOrders = useMemo(() => {
    // Use override if provided (for pre-filtered orders like delivery window filter)
    if (ordersOverride) {
      return ordersOverride;
    }

    let orders = ordersData?.orders || [];

    // Apply type filter
    if (typeLocal !== 'all') {
      orders = orders.filter(order => order.order_type === typeLocal);
    }

    // Apply status filter for 'all' mode
    if (mode === 'all') {
      orders = orders.filter(order => localStatusFilter.includes(order.status));
    }

    // Only show paid orders
    orders = orders.filter(order => order.payment_status === 'paid');

    // Apply search filter
    if (debouncedQuery) {
      orders = orders.filter(order => 
        (order.order_number || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_name || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_email || '').toLowerCase().includes(debouncedQuery) ||
        (order.customer_phone || '').toLowerCase().includes(debouncedQuery)
      );
    }

    return orders;
  }, [ordersData?.orders, typeLocal, localStatusFilter, mode, ordersOverride, debouncedQuery]);

  // Handle status change with validation
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const order = filteredOrders.find(o => o.id === orderId);
      
      // Validate status transitions
      if (newStatus === 'out_for_delivery' && !order?.assigned_rider_id) {
        toast.error('Cannot move to "Out for Delivery" without assigning a driver. Please assign a driver first.');
        return;
      }
      
      await updateOrder(orderId, { status: newStatus as any });
      toast.success('Order status updated successfully');
      refetch();
    } catch (error) {
      toast.error('Failed to update order status');
      console.error('Status update error:', error);
    }
  };

  // Handle driver assignment
  const handleAssignDriver = async (orderIds: string[], driverId: string) => {
    try {
      // Use the updated assignment method that handles profile_id mapping
      const promises = orderIds.map(orderId => 
        updateOrder(orderId, { assigned_rider_id: driverId }) // driverId is now profile_id
      );
      
      await Promise.all(promises);
      toast.success(`${orderIds.length} order(s) assigned successfully`);
      refetch();
      setSelectedOrders([]);
    } catch (error) {
      toast.error('Failed to assign driver');
      console.error('Assignment error:', error);
    }
  };

  // Handle print
  const handlePrint = (order: any) => {
    setPrintingOrder(order);
    setIsReceiptModalOpen(true);
  };

  // Handle bulk print
  const handleBulkPrint = () => {
    if (selectedOrders.length === 0) return;
    
    const ordersForPrint = filteredOrders.filter(order => 
      selectedOrders.includes(order.id)
    );
    
    // Create a print window with multiple receipts
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Order Receipts</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .receipt { border: 1px solid #ccc; margin-bottom: 20px; padding: 20px; page-break-after: always; }
            .receipt:last-child { page-break-after: auto; }
            h2 { margin-top: 0; }
            @media print { .receipt { page-break-after: always; } }
          </style>
        </head>
        <body>
          ${ordersForPrint.map(order => `
            <div class="receipt">
              <h2>Order Receipt #${order.order_number}</h2>
              <p><strong>Customer:</strong> ${order.customer_name}</p>
              <p><strong>Email:</strong> ${order.customer_email}</p>
              <p><strong>Phone:</strong> ${order.customer_phone || 'N/A'}</p>
              <p><strong>Type:</strong> ${order.order_type}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Total:</strong> ₦${order.total_amount.toLocaleString()}</p>
              <p><strong>Date:</strong> ${format(new Date(order.created_at), 'PPpp')}</p>
              ${order.delivery_address ? `<p><strong>Address:</strong> ${typeof order.delivery_address === 'object' ? JSON.stringify(order.delivery_address) : order.delivery_address}</p>` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle2 className="w-4 h-4" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4" />;
      case 'ready': return <Package className="w-4 h-4" />;
      case 'preparing': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
