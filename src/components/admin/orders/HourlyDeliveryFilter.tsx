import React, { useCallback, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar, AlertCircle, RefreshCw, Activity, Package, User, Phone, MapPin, DollarSign } from 'lucide-react';
import { format, addDays, isSameDay, parseISO } from 'date-fns';
import { OrderWithItems } from '@/api/orders';
import { OrderIdDisplay } from '@/components/ui/order-id-display';

interface HourlyDeliveryFilterProps {
  selectedDay: 'today' | 'tomorrow' | null;
  selectedHour: string | null;
  onDayChange: (day: 'today' | 'tomorrow' | null) => void;
  onHourChange: (hour: string | null) => void;
  orderCounts?: {
    today: Record<string, number>;
    tomorrow: Record<string, number>;
  };
  orders?: OrderWithItems[];
  loading?: boolean;
  error?: Error | null;
}

export const HourlyDeliveryFilter: React.FC<HourlyDeliveryFilterProps> = ({
  selectedDay,
  selectedHour,
  onDayChange,
  onHourChange,
  orderCounts,
  orders = [],
  loading = false,
  error = null
}) => {
  // Generate hourly slots from 8 AM to 10 PM with validation and memoization
  const generateHourlySlots = useCallback(() => {
    const slots = [];
    for (let hour = 8; hour <= 22; hour++) {
      try {
        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
        const testDate = new Date();
        testDate.setHours(hour, 0, 0, 0);
        const displayTime = format(testDate, 'h:mm a');
        slots.push({ value: timeSlot, label: displayTime, hour });
      } catch (error) {
        console.error('Error generating time slot for hour:', hour, error);
      }
    }
    return slots;
  }, []);

  const hourlySlots = useMemo(() => generateHourlySlots(), [generateHourlySlots]);
  
  const today = useMemo(() => new Date(), []);
  const tomorrow = useMemo(() => addDays(today, 1), [today]);

  // Group orders by delivery date and time slot
  const groupedOrders = useMemo(() => {
    try {
      const grouped: {
        today: Record<string, OrderWithItems[]>;
        tomorrow: Record<string, OrderWithItems[]>;
      } = {
        today: {},
        tomorrow: {}
      };

      orders.forEach(order => {
        // Only process orders with delivery schedules
        if (!order.delivery_schedule || !order.delivery_schedule.delivery_date) {
          return;
        }

        try {
          const deliveryDate = parseISO(order.delivery_schedule.delivery_date);
          const timeSlot = order.delivery_schedule.delivery_time_start;
          
          if (isSameDay(deliveryDate, today)) {
            if (!grouped.today[timeSlot]) grouped.today[timeSlot] = [];
            grouped.today[timeSlot].push(order);
          } else if (isSameDay(deliveryDate, tomorrow)) {
            if (!grouped.tomorrow[timeSlot]) grouped.tomorrow[timeSlot] = [];
            grouped.tomorrow[timeSlot].push(order);
          }
        } catch (dateError) {
          console.warn('Error parsing delivery date for order:', order.id, dateError);
        }
      });

      return grouped;
    } catch (error) {
      console.error('Error grouping orders by time slots:', error);
      return { today: {}, tomorrow: {} };
    }
  }, [orders, today, tomorrow]);

  // Get orders for selected filters
  const getFilteredOrders = useCallback(() => {
    if (!selectedDay) return [];
    
    const dayOrders = groupedOrders[selectedDay];
    if (!selectedHour) {
      // Return all orders for the day
      return Object.values(dayOrders).flat();
    }
    
    // Return orders for specific time slot
    return dayOrders[selectedHour] || [];
  }, [selectedDay, selectedHour, groupedOrders]);

  const clearFilters = useCallback(() => {
    onDayChange(null);
    onHourChange(null);
    
    // Track filter clear analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'filter_cleared', {
        event_category: 'order_management',
        event_label: 'hourly_delivery_filter'
      });
    }
  }, [onDayChange, onHourChange]);

  const getTotalCountForDay = useCallback((day: 'today' | 'tomorrow') => {
    if (!orderCounts || !orderCounts[day]) return 0;
    
    try {
      const counts = orderCounts[day];
      return Object.values(counts).reduce((sum, count) => {
        const numCount = typeof count === 'number' && !isNaN(count) ? count : 0;
        return sum + numCount;
      }, 0);
    } catch (error) {
      console.error('Error calculating total count for day:', day, error);
      return 0;
    }
  }, [orderCounts]);

  const handleDayChange = useCallback((day: 'today' | 'tomorrow') => {
    const newDay = selectedDay === day ? null : day;
    onDayChange(newDay);
    
    // Clear hour selection when changing day
    if (selectedDay === day) {
      onHourChange(null);
    }
    
    // Track day selection analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'day_filter_changed', {
        event_category: 'order_management',
        event_label: `hourly_delivery_filter_${newDay || 'cleared'}`,
        value: getTotalCountForDay(day)
      });
    }
  }, [selectedDay, onDayChange, onHourChange, getTotalCountForDay]);

  const handleHourChange = useCallback((hour: string | null) => {
    const newHour = selectedHour === hour ? null : hour;
    onHourChange(newHour);
    
    // Track hour selection analytics (production ready)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'hour_filter_changed', {
        event_category: 'order_management',
        event_label: `hourly_delivery_filter_${newHour || 'all_hours'}`,
        value: selectedDay && orderCounts?.[selectedDay]?.[hour || ''] || 0
      });
    }
  }, [selectedHour, onHourChange, selectedDay, orderCounts]);

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Failed to load delivery schedule data</p>
            <p className="text-sm opacity-75">Please refresh to try again</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="ml-auto border-destructive/30 hover:bg-destructive/10"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Day Selection - Mobile Responsive with Production Features */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Button
            variant={selectedDay === 'today' ? 'default' : 'outline'}
            onClick={() => handleDayChange('today')}
            className="flex-1 sm:flex-none relative transition-all duration-200 hover:scale-[1.02]"
            disabled={loading}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Today</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(today, 'MMM d')})
            </span>
            {orderCounts && (
              <Badge 
                variant={selectedDay === 'today' ? 'secondary' : 'outline'} 
                className={`ml-2 text-xs animate-in fade-in-50 ${getTotalCountForDay('today') === 0 ? 'opacity-50' : ''}`}
              >
                {getTotalCountForDay('today')}
              </Badge>
            )}
            {loading && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && !orderCounts && (
              <div className="ml-2 w-4 h-4 text-muted-foreground">
                <Activity className="w-4 h-4" />
              </div>
            )}
          </Button>
          
          <Button
            variant={selectedDay === 'tomorrow' ? 'default' : 'outline'}
            onClick={() => handleDayChange('tomorrow')}
            className="flex-1 sm:flex-none relative transition-all duration-200 hover:scale-[1.02]"
            disabled={loading}
          >
            <Calendar className="w-4 h-4 mr-2" />
            <span className="font-medium">Tomorrow</span>
            <span className="hidden sm:inline ml-1 text-xs opacity-75">
              ({format(tomorrow, 'MMM d')})
            </span>
            {orderCounts && (
              <Badge 
                variant={selectedDay === 'tomorrow' ? 'secondary' : 'outline'} 
                className={`ml-2 text-xs animate-in fade-in-50 ${getTotalCountForDay('tomorrow') === 0 ? 'opacity-50' : ''}`}
              >
                {getTotalCountForDay('tomorrow')}
              </Badge>
            )}
            {loading && (
              <div className="ml-2 w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {!loading && !orderCounts && (
              <div className="ml-2 w-4 h-4 text-muted-foreground">
                <Activity className="w-4 h-4" />
              </div>
            )}
          </Button>
        </div>

        {(selectedDay || selectedHour) && !loading && (
          <Button
            variant="ghost"
            onClick={clearFilters}
            className="w-full sm:w-auto transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Hour Selection - Show when day is selected */}
      {selectedDay && orderCounts && !loading && (
        <div className="space-y-2 animate-in slide-in-from-top-5 duration-300">
          {/* Orders Display for Selected Time Slot */}
          {(() => {
            const filteredOrders = getFilteredOrders();
            
            return (
              <div className="space-y-4">
                {/* Order Statistics */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {selectedHour ? `Orders for ${hourlySlots.find(s => s.value === selectedHour)?.label}` : 'All orders'}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
                  </Badge>
                </div>

                {/* Orders List */}
                {filteredOrders.length > 0 ? (
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-border">
                    {filteredOrders.map((order) => (
                      <Card key={order.id} className="hover:shadow-md transition-all duration-200 border-l-4 border-l-primary/20">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <OrderIdDisplay orderId={order.id} variant="compact" />
                              <Badge 
                                variant={
                                  order.status === 'delivered' ? 'default' :
                                  order.status === 'confirmed' ? 'secondary' :
                                  order.status === 'preparing' ? 'outline' :
                                  'destructive'
                                }
                                className="text-xs"
                              >
                                {order.status.replace('_', ' ')}
                              </Badge>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-medium text-primary">
                                ${typeof order.total_amount === 'number' ? order.total_amount.toFixed(2) : '0.00'}
                              </div>
                              {order.delivery_schedule && (
                                <div className="text-xs text-muted-foreground">
                                  {order.delivery_schedule.delivery_time_start} - {order.delivery_schedule.delivery_time_end}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {/* Customer Info */}
                            <div className="flex items-start gap-3">
                              <User className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{order.customer_name}</p>
                                <div className="flex items-center gap-4 mt-1">
                                  {order.customer_phone && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Phone className="w-3 h-3" />
                                      <span className="truncate">{order.customer_phone}</span>
                                    </div>
                                  )}
                                  {order.customer_email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <span className="truncate">{order.customer_email}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Delivery Address */}
                            {order.delivery_address && (
                              <div className="flex items-start gap-3">
                                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-muted-foreground truncate">
                                    {String(order.delivery_address || '')}
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Order Items Summary */}
                            <div className="flex items-start gap-3">
                              <Package className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                  {order.order_items?.length || 0} {(order.order_items?.length || 0) === 1 ? 'item' : 'items'}
                                </p>
                                {order.order_items && order.order_items.length > 0 && (
                                  <div className="mt-1 space-y-1">
                                    {order.order_items.slice(0, 2).map((item, index) => (
                                      <div key={index} className="text-xs text-muted-foreground">
                                        {item.quantity}x {item.product_name || 'Unknown Item'}
                                      </div>
                                    ))}
                                    {order.order_items.length > 2 && (
                                      <div className="text-xs text-muted-foreground opacity-75">
                                        +{order.order_items.length - 2} more items
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Special Instructions */}
                            {order.delivery_schedule?.special_instructions && (
                              <div className="bg-muted/50 rounded p-2 mt-2">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Special Instructions:</p>
                                <p className="text-xs">{order.delivery_schedule.special_instructions}</p>
                              </div>
                            )}

                            {/* Order Actions */}
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div className="text-xs text-muted-foreground">
                                Order placed: {format(new Date(order.created_at), 'MMM d, h:mm a')}
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="text-xs h-7 px-3"
                                onClick={() => {
                                  // Track order view analytics
                                  if (typeof window !== 'undefined' && (window as any).gtag) {
                                    (window as any).gtag('event', 'order_viewed_from_schedule', {
                                      event_category: 'order_management',
                                      event_label: 'hourly_delivery_filter',
                                      value: typeof order.total_amount === 'number' ? order.total_amount : 0
                                    });
                                  }
                                  // Navigate to order details - this would be handled by parent component
                                  console.log('View order:', order.id);
                                }}
                              >
                                View Details
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground animate-in fade-in-50">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <div className="space-y-1">
                      <p className="font-medium">No orders found</p>
                      <p className="text-sm">
                        {selectedHour 
                          ? `No orders scheduled for ${hourlySlots.find(s => s.value === selectedHour)?.label}`
                          : `No orders scheduled for ${selectedDay === 'today' ? 'today' : 'tomorrow'}`
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Delivery slots for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')} 
              ({getTotalCountForDay(selectedDay)} orders)
            </span>
          </div>
          
          {/* Always show time slots - production ready view */}
          <div className="space-y-4">
            {/* Desktop/Tablet: Select dropdown */}
              <div className="hidden sm:block">
                <Select
                  value={selectedHour || 'all'}
                  onValueChange={(value) => handleHourChange(value === 'all' ? null : value)}
                >
                  <SelectTrigger className="w-full sm:w-[280px] transition-all duration-200 hover:border-primary">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all" className="font-medium">
                      <div className="flex items-center justify-between w-full">
                        <span>All delivery slots</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {getTotalCountForDay(selectedDay)} orders
                        </Badge>
                      </div>
                    </SelectItem>
                    {hourlySlots.map((slot) => {
                      const slotCount = orderCounts[selectedDay]?.[slot.value] || 0;
                      
                      return (
                        <SelectItem key={slot.value} value={slot.value}>
                          <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{slot.label}</span>
                            <Badge 
                              variant={slotCount > 0 ? "default" : "secondary"} 
                              className={`ml-2 text-xs ${slotCount === 0 ? 'opacity-60' : ''}`}
                            >
                              {slotCount} {slotCount === 1 ? 'order' : 'orders'}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile: Scrollable buttons with improved UX */}
              <div className="sm:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
                  <Button
                    variant={!selectedHour ? 'default' : 'outline'}
                    onClick={() => handleHourChange(null)}
                    className="flex-shrink-0 transition-all duration-200"
                    size="sm"
                  >
                    All slots
                    <Badge variant="outline" className="ml-1 text-xs">
                      {getTotalCountForDay(selectedDay)}
                    </Badge>
                  </Button>
                  {hourlySlots.map((slot) => {
                    const slotCount = orderCounts[selectedDay]?.[slot.value] || 0;
                    
                    return (
                      <Button
                        key={slot.value}
                        variant={selectedHour === slot.value ? 'default' : slotCount > 0 ? 'outline' : 'ghost'}
                        onClick={() => handleHourChange(slot.value)}
                        className={`flex-shrink-0 transition-all duration-200 ${slotCount === 0 ? 'opacity-60' : ''}`}
                        size="sm"
                      >
                        <span className="font-medium">{slot.label}</span>
                        <Badge 
                          variant={selectedHour === slot.value ? 'secondary' : slotCount > 0 ? 'outline' : 'secondary'} 
                          className={`ml-1 text-xs ${slotCount === 0 ? 'opacity-70' : ''}`}
                        >
                          {slotCount}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              </div>
            
            {/* Day Summary Card - Production Feature */}
            {getTotalCountForDay(selectedDay) === 0 && (
              <div className="text-center py-6 text-muted-foreground animate-in fade-in-50 bg-muted/30 rounded-lg border-2 border-dashed border-muted-foreground/20">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <div className="space-y-1">
                  <p className="font-medium">No delivery orders scheduled</p>
                  <p className="text-sm text-muted-foreground/80">
                    for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    All time slots are available for new orders
                  </p>
                </div>
              </div>
            )}
            
            {getTotalCountForDay(selectedDay) > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-primary">
                      {getTotalCountForDay(selectedDay)} orders scheduled
                    </p>
                    <p className="text-sm text-muted-foreground">
                      for {selectedDay === 'today' ? format(today, 'EEEE, MMM d') : format(tomorrow, 'EEEE, MMM d')}
                    </p>
                  </div>
                  <Badge variant="default" className="text-sm px-3 py-1">
                    Active Day
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Loading state for hour selection */}
      {loading && selectedDay && (
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      )}

      {/* Active filters display with enhanced styling */}
      {(selectedDay || selectedHour) && !loading && (
        <div className="flex flex-wrap gap-2 animate-in slide-in-from-bottom-2">
          <span className="text-sm text-muted-foreground font-medium">Active filters:</span>
          {selectedDay && (
            <Badge variant="outline" className="transition-all duration-200 hover:bg-primary/10">
              📅 {selectedDay === 'today' ? format(today, 'MMM d') : format(tomorrow, 'MMM d')}
            </Badge>
          )}
          {selectedHour && (
            <Badge variant="outline" className="transition-all duration-200 hover:bg-primary/10">
              🕒 {hourlySlots.find(slot => slot.value === selectedHour)?.label}
            </Badge>
          )}
        </div>
      )}
      
      {/* Data freshness indicator (production feature) */}
      {orderCounts && !loading && (
        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          <div className="flex items-center justify-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Data updated {format(new Date(), 'h:mm a')}</span>
          </div>
        </div>
      )}
    </div>
  );
};