import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface JobOrderDataSourcesProps {
  order: OrderWithItems;
  items?: any[];
  deliverySchedule?: any;
  pickupPoint?: any;
  detailedOrderData?: any;
  enrichedItems?: any[];
}

export const JobOrderDataSources: React.FC<JobOrderDataSourcesProps> = ({
  order,
  items = [],
  deliverySchedule,
  pickupPoint,
  detailedOrderData,
  enrichedItems = []
}) => {
  const orderItems = items.length > 0 ? items : order.order_items || [];
  
  const getDataSource = (value: any, sources: string[]) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return { value: 'Not available', sources: ['N/A'], status: 'missing' };
    }
    return { value, sources, status: 'available' };
  };

  const getDeliveryInfo = () => {
    if (order.order_type === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || 'Pickup Point',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled',
        sources: ['pickup_points table', 'delivery_schedule table']
      };
    } else if (order.order_type === 'delivery') {
      return {
        type: 'Delivery',
        address: order.delivery_address || 'Not provided',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled',
        sources: ['orders.delivery_address', 'delivery_schedule table']
      };
    }
    return { 
      type: 'Unknown', 
      address: 'Not provided', 
      time: 'Not scheduled',
      sources: ['Fallback default'] 
    };
  };

  const deliveryInfo = getDeliveryInfo();

  const dataSourceSections = [
    {
      title: 'Order Header Information',
      items: [
        {
          field: 'Order Number',
          ...getDataSource(order.order_number, ['orders.order_number'])
        },
        {
          field: 'Order Date',
          ...getDataSource(order.order_time, ['orders.order_time'])
        },
        {
          field: 'Order Status',
          ...getDataSource(order.status, ['orders.status'])
        },
        {
          field: 'Payment Status', 
          ...getDataSource(order.payment_status, ['orders.payment_status'])
        }
      ]
    },
    {
      title: 'Customer Information',
      items: [
        {
          field: 'Customer Name',
          ...getDataSource(order.customer_name, ['orders.customer_name'])
        },
        {
          field: 'Customer Phone',
          ...getDataSource(order.customer_phone, ['orders.customer_phone'])
        },
        {
          field: 'Customer Email',
          ...getDataSource(order.customer_email, ['orders.customer_email'])
        }
      ]
    },
    {
      title: 'Fulfillment Information',
      items: [
        {
          field: 'Order Type',
          ...getDataSource(order.order_type, ['orders.order_type'])
        },
        {
          field: 'Delivery/Pickup Address',
          ...getDataSource(deliveryInfo.address, deliveryInfo.sources)
        },
        {
          field: 'Scheduled Time',
          ...getDataSource(deliveryInfo.time, ['delivery_schedule.scheduled_date', 'Calculated fallback'])
        }
      ]
    },
    {
      title: 'Order Items',
      items: [
        {
          field: 'Items Data Source',
          ...getDataSource(
            orderItems.length > 0 ? `${orderItems.length} items loaded` : 'No items',
            items.length > 0 
              ? ['detailedOrderData.items (RPC: get_detailed_order_with_products)']
              : enrichedItems.length > 0
              ? ['enrichedItems (useEnrichedOrderItems hook)', 'products table JOIN']
              : order.order_items?.length > 0
              ? ['orders.order_items (direct from order)']
              : ['No items source']
          )
        },
        {
          field: 'Product Features',
          ...getDataSource(
            orderItems.some((item: any) => item.product?.features) ? 'Available' : 'Not available',
            orderItems.some((item: any) => item.product?.features) 
              ? ['products.features', 'RPC enrichment', 'JOIN with products table']
              : ['Product features not loaded']
          )
        }
      ]
    },
    {
      title: 'Financial Information',
      items: [
        {
          field: 'Subtotal',
          ...getDataSource(order.subtotal, ['orders.subtotal', 'Calculated from items'])
        },
        {
          field: 'Delivery Fee',
          ...getDataSource(order.delivery_fee, ['orders.delivery_fee'])
        },
        {
          field: 'VAT Amount',
          ...getDataSource(order.total_vat, ['orders.total_vat', 'Calculated (7.5%)'])
        },
        {
          field: 'Discount Amount',
          ...getDataSource(order.discount_amount, ['orders.discount_amount', 'promotions system'])
        },
        {
          field: 'Total Amount',
          ...getDataSource(order.total_amount, ['orders.total_amount', 'Sum of all components'])
        }
      ]
    },
    {
      title: 'Schedule & Instructions',
      items: [
        {
          field: 'Order Special Instructions',
          ...getDataSource(order.special_instructions, ['orders.special_instructions'])
        },
        {
          field: 'Delivery Schedule Instructions',
          ...getDataSource(deliverySchedule?.special_instructions, ['delivery_schedule.special_instructions'])
        },
        {
          field: 'Delivery Schedule Data',
          ...getDataSource(
            deliverySchedule ? 'Loaded' : 'Not available',
            deliverySchedule 
              ? ['delivery_schedule table', 'getDeliveryScheduleByOrderId API', 'React Query cache']
              : ['Schedule not found', 'Fallback to order fields']
          )
        }
      ]
    },
    {
      title: 'Pickup Point Information (if applicable)',
      items: [
        {
          field: 'Pickup Point Data',
          ...getDataSource(
            pickupPoint ? `${pickupPoint.name || 'Pickup Point'}` : 'Not applicable',
            pickupPoint 
              ? ['pickup_points table', 'usePickupPoint hook', 'orders.pickup_point_id']
              : ['N/A - Not a pickup order']
          )
        }
      ]
    },
    {
      title: 'Data Loading Hooks & APIs',
      items: [
        {
          field: 'useDetailedOrderData',
          ...getDataSource(
            detailedOrderData ? 'Loaded successfully' : 'Failed/Loading',
            ['RPC: get_detailed_order_with_products', 'Fallback: Direct table queries', 'orders + order_items + products JOIN']
          )
        },
        {
          field: 'useEnrichedOrderItems',
          ...getDataSource(
            enrichedItems.length > 0 ? `${enrichedItems.length} enriched items` : 'No enriched data',
            ['products table JOIN', 'Product features enhancement', 'React Query cache']
          )
        },
        {
          field: 'Delivery Schedule API',
          ...getDataSource(
            deliverySchedule ? 'Loaded' : 'Not loaded',
            ['getDeliveryScheduleByOrderId', 'delivery_schedule table', 'order_id FK relationship']
          )
        }
      ]
    }
  ];

  return (
    <div className="job-order-data-sources space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Job Order Data Sources</h2>
        <p className="text-muted-foreground">
          Complete breakdown of all data sources used in Job Order #{order.order_number}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Generated on {format(new Date(), 'PPP p')}
        </p>
      </div>

      {dataSourceSections.map((section, sectionIndex) => (
        <Card key={sectionIndex} className="w-full">
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {section.items.map((item, itemIndex) => (
              <div key={itemIndex}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{item.field}:</span>
                      <Badge 
                        variant={item.status === 'available' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {item.status === 'available' ? 'Available' : 'Missing'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      <strong>Value:</strong> {
                        typeof item.value === 'object' 
                          ? JSON.stringify(item.value, null, 2)
                          : String(item.value)
                      }
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <strong>Data Sources:</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.sources.map((source, sourceIndex) => (
                          <Badge key={sourceIndex} variant="outline" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {itemIndex < section.items.length - 1 && <Separator className="mt-3" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg text-primary">Data Flow Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><strong>Primary Data Source:</strong> orders table (order #{order.order_number})</div>
          <div><strong>Items Enhancement:</strong> RPC get_detailed_order_with_products → Fallback to direct queries</div>
          <div><strong>Product Details:</strong> products table JOIN with order_items</div>
          <div><strong>Schedule Data:</strong> delivery_schedule table via getDeliveryScheduleByOrderId</div>
          <div><strong>Pickup Points:</strong> pickup_points table via usePickupPoint hook</div>
          <div><strong>Caching:</strong> React Query for all API calls with stale-while-revalidate</div>
          <div><strong>Error Handling:</strong> Circuit breaker pattern with fallbacks</div>
        </CardContent>
      </Card>
    </div>
  );
};