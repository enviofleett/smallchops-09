import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';

export type DeliveryFilterType = 'all' | 'today' | 'tomorrow' | 'future' | 'due_today' | 'upcoming' | 'past_due' | 'this_week' | 'next_week';
export type DayFilterType = 'today' | 'tomorrow' | null;

export interface AdminOrderFilters {
  searchQuery: string;
  statusFilter: 'all' | OrderStatus;
  deliveryFilter: DeliveryFilterType;
  selectedDay: DayFilterType;
  selectedHour: string | null;
}

export interface DeliverySchedule {
  id: string;
  order_id: string;
  delivery_date: string;
  delivery_time_start?: string;
  delivery_time_end?: string;
  special_instructions?: string;
  requested_at?: string;
  created_at?: string;
}

export interface OrderCounts {
  all: number;
  confirmed: number;
  preparing: number;
  ready: number;
  out_for_delivery: number;
  delivered: number;
}

export interface HourlyOrderCounts {
  today: Record<string, number>;
  tomorrow: Record<string, number>;
}

export interface FilteredOrdersResult {
  orders: OrderWithItems[];
  totalCount: number;
  hasActiveFilters: boolean;
}

export interface OrderFilterWarning {
  type: 'missing_schedule' | 'invalid_date' | 'payment_pending';
  orderId: string;
  orderNumber: string;
  message: string;
}

export interface AdminOrdersState {
  selectedOrder: OrderWithItems | null;
  isDialogOpen: boolean;
  currentPage: number;
  activeTab: string;
  showDeliveryReport: boolean;
  useSimpleMode: boolean;
}
