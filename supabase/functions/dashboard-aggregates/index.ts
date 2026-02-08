import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 5000)) : 1000;
    const topLimit = typeof body.topLimit === 'number' ? Math.max(1, Math.min(body.topLimit, 25)) : 5;
    const interval = typeof body.interval === 'string' && ['day','week','month'].includes(body.interval) ? body.interval : 'day';
    const dateFrom = body.dateFrom || null;
    const dateTo = body.dateTo || null;

    // Healthcheck
    if (body.healthcheck) {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'dashboard-aggregates',
        timestamp: new Date().toISOString()
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Filters
    const ordersQuery = supabase.from('orders').select('id, total_amount, status, order_type, customer_id, customer_name, customer_email, created_at, assigned_rider_id, delivery_fee, delivery_zone_id');
    if (dateFrom) ordersQuery.gte('created_at', dateFrom);
    if (dateTo) ordersQuery.lte('created_at', dateTo);
    ordersQuery.limit(limit);

    const [
      { data: productsData, error: productsError },
      { data: customersData, error: customersError },
      { data: ordersData, error: ordersError },
      { data: orderItemsData, error: orderItemsError },
      { data: driversData, error: driversError },
      { data: zonesData, error: zonesError },
      { data: activeOrdersData, error: activeOrdersError },
      { data: efficiencyData, error: efficiencyError }
    ] = await Promise.all([
      supabase.from('products').select('id, name'),
      supabase.from('customers').select('id, name, email'),
      ordersQuery,
      supabase.from('order_items').select('order_id, product_id, quantity, unit_price, total_price, created_at').limit(limit),
      supabase.from('drivers').select('id, name'),
      supabase.from('delivery_zones').select('id, name'),
      // Active orders for overdue stats
      supabase.from('orders')
        .select('id, status, order_delivery_schedule(delivery_date, delivery_time_end)')
        .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']),
      // Efficiency stats
      supabase.from('driver_performance_analytics')
        .select('average_delivery_time_minutes, total_distance_km, orders_completed')
        .order('week_start_date', { ascending: false })
        .limit(20)
    ]);

    if (productsError) throw productsError;
    if (customersError) throw customersError;
    if (ordersError) throw ordersError;
    if (orderItemsError) throw orderItemsError;
    if (driversError) throw driversError;
    // Non-critical errors for new features can be ignored or logged, but let's throw for now to be safe
    if (zonesError) console.error('Zones error:', zonesError);

    // Stats
    const totalProducts = productsData?.length || 0;
    const totalOrders = ordersData?.length || 0;
    const totalCustomers = customersData?.length || 0;
    const totalRevenue = (ordersData || []).reduce((sum, o) => sum + (parseFloat(o.total_amount?.toString() || '0') || 0), 0);

    // Product Names map
    const productNameMap = new Map<string, string>();
    (productsData || []).forEach(p => { if (p?.id) productNameMap.set(p.id, p.name || 'Unknown'); });

    // Top products aggregation
    const productAgg = new Map<string, { id: string; name: string; quantity_sold: number; revenue: number; total_orders: number }>();
    (orderItemsData || []).forEach(item => {
      const key = item.product_id;
      if (!key) return;
      const existing = productAgg.get(key);
      const qty = Number(item.quantity) || 0;
      const rev = parseFloat(item.total_price?.toString() || '0') || 0;
      if (existing) {
        existing.quantity_sold += qty;
        existing.revenue += rev;
        existing.total_orders += 1;
      } else {
        productAgg.set(key, {
          id: key,
          name: productNameMap.get(key) || 'Unknown',
          quantity_sold: qty,
          revenue: rev,
          total_orders: 1
        });
      }
    });

    const topProducts = Array.from(productAgg.values())
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, topLimit);

    // Top customers aggregation
    const customerAgg = new Map<string, { id: string; name: string; email: string; total_orders: number; total_spent: number }>();
    (ordersData || []).forEach(order => {
      const key = order.customer_id;
      if (!key) return;
      const existing = customerAgg.get(key);
      const amt = parseFloat(order.total_amount?.toString() || '0') || 0;
      if (existing) {
        existing.total_orders += 1;
        existing.total_spent += amt;
      } else {
        customerAgg.set(key, {
          id: key,
          name: order.customer_name || 'Unknown',
          email: order.customer_email || '',
          total_orders: 1,
          total_spent: amt
        });
      }
    });

    const topCustomers = Array.from(customerAgg.values())
      .sort((a, b) => b.total_orders - a.total_orders)
      .slice(0, topLimit);

    const driverNameMap = new Map<string, string>();
    (driversData || []).forEach(d => { if (d?.id) driverNameMap.set(d.id, d.name || 'Unknown'); });
    
    // Driver Revenue
    const driverRevenueAgg: Array<{ interval_start: string; driver_id: string; driver_name: string; total_deliveries: number; total_revenue: number; total_delivery_fees: number; avg_delivery_fee: number }> = [];
    const driverKey = (ts: string, driverId: string) => `${ts}|${driverId}`;
    const driverMap = new Map<string, { interval_start: string; driver_id: string; driver_name: string; total_deliveries: number; total_revenue: number; total_delivery_fees: number; avg_delivery_fee_acc: number }>();
    (ordersData || []).forEach(o => {
      if (o.order_type !== 'delivery') return;
      if (!(o.status === 'delivered' || o.status === 'completed')) return;
      const ts = new Date(o.created_at);
      const it = interval === 'day' ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate()) :
        interval === 'week' ? new Date(ts.getFullYear(), ts.getMonth(), ts.getDate() - ts.getDay()) :
        new Date(ts.getFullYear(), ts.getMonth(), 1);
      const iso = it.toISOString();
      const did = o.assigned_rider_id || 'unassigned';
      const key = driverKey(iso, did);
      const name = driverNameMap.get(did) || 'Unassigned';
      const fee = parseFloat((o.delivery_fee ?? 0).toString()) || 0;
      const amt = parseFloat((o.total_amount ?? 0).toString()) || 0;
      const existing = driverMap.get(key);
      if (existing) {
        existing.total_deliveries += 1;
        existing.total_revenue += amt;
        existing.total_delivery_fees += fee;
        existing.avg_delivery_fee_acc += fee;
      } else {
        driverMap.set(key, {
          interval_start: iso,
          driver_id: did,
          driver_name: name,
          total_deliveries: 1,
          total_revenue: amt,
          total_delivery_fees: fee,
          avg_delivery_fee_acc: fee
        });
      }
    });
    driverMap.forEach(v => {
      const avg = v.total_deliveries > 0 ? v.avg_delivery_fee_acc / v.total_deliveries : 0;
      driverRevenueAgg.push({
        interval_start: v.interval_start,
        driver_id: v.driver_id,
        driver_name: v.driver_name,
        total_deliveries: v.total_deliveries,
        total_revenue: v.total_revenue,
        total_delivery_fees: v.total_delivery_fees,
        avg_delivery_fee: avg
      });
    });
    driverRevenueAgg.sort((a, b) => {
      const ad = new Date(a.interval_start).getTime();
      const bd = new Date(b.interval_start).getTime();
      if (bd !== ad) return bd - ad;
      return b.total_deliveries - a.total_deliveries;
    });

    // Zone Breakdown
    const zoneMap = new Map<string, { id: string; name: string; total_orders: number; total_fees: number }>();
    (ordersData || []).forEach(o => {
      if (o.order_type !== 'delivery') return;
      const zid = o.delivery_zone_id || 'unknown';
      const fee = parseFloat((o.delivery_fee ?? 0).toString()) || 0;
      const existing = zoneMap.get(zid);
      if (existing) {
        existing.total_orders++;
        existing.total_fees += fee;
      } else {
        const zName = zonesData?.find(z => z.id === zid)?.name || 'Unknown Zone';
        zoneMap.set(zid, { id: zid, name: zName, total_orders: 1, total_fees: fee });
      }
    });
    const zoneBreakdown = Array.from(zoneMap.values()).map(z => ({
      zone_id: z.id,
      zone_name: z.name,
      total_orders: z.total_orders,
      total_fees: z.total_fees,
      average_fee: z.total_orders > 0 ? z.total_fees / z.total_orders : 0
    })).sort((a, b) => b.total_orders - a.total_orders);

    // Overdue Stats
    let overdueStats = { critical: 0, moderate: 0, recent: 0, total_overdue: 0 };
    const now = new Date();
    (activeOrdersData || []).forEach(o => {
      const schedule = o.order_delivery_schedule;
      // Handle both array and single object response from Supabase
      const schedList = Array.isArray(schedule) ? schedule : (schedule ? [schedule] : []);
      const sched = schedList[0];
      
      if (sched && sched.delivery_date && sched.delivery_time_end) {
        const deadline = new Date(`${sched.delivery_date}T${sched.delivery_time_end}`);
        if (!isNaN(deadline.getTime()) && now > deadline) {
          const diff = (now.getTime() - deadline.getTime()) / 60000; // minutes
          if (diff > 30) overdueStats.critical++;
          else if (diff > 10) overdueStats.moderate++;
          else overdueStats.recent++;
          overdueStats.total_overdue++;
        }
      }
    });

    // Efficiency Stats
    let effTotalTime = 0;
    let effTotalDist = 0;
    let effTotalCompleted = 0;
    (efficiencyData || []).forEach(e => {
      const completed = Number(e.orders_completed) || 0;
      effTotalTime += (Number(e.average_delivery_time_minutes) || 0) * completed;
      effTotalDist += Number(e.total_distance_km) || 0;
      effTotalCompleted += completed;
    });
    const efficiencyStats = {
      average_delivery_time_minutes: effTotalCompleted > 0 ? effTotalTime / effTotalCompleted : 0,
      orders_per_driver_avg: efficiencyData && efficiencyData.length > 0 ? effTotalCompleted / efficiencyData.length : 0,
      total_distance_km: effTotalDist
    };

    // Fulfillment stats
    const deliveryOrders = (ordersData || []).filter(o => o.order_type === 'delivery').length;
    const pickupOrders = (ordersData || []).filter(o => o.order_type === 'pickup').length;
    const totalFulfillment = deliveryOrders + pickupOrders;
    const fulfillmentStats = {
      delivery_orders: deliveryOrders,
      pickup_orders: pickupOrders,
      delivery_percentage: totalFulfillment > 0 ? Math.round((deliveryOrders / totalFulfillment) * 100) : 0,
      pickup_percentage: totalFulfillment > 0 ? Math.round((pickupOrders / totalFulfillment) * 100) : 0,
      total_fulfillment_orders: totalFulfillment
    };

    // Delivery summary (basic)
    const deliveredCount = (ordersData || []).filter(o => o.status === 'delivered').length;
    const outForDeliveryCount = (ordersData || []).filter(o => o.status === 'out_for_delivery').length;
    const preparingCount = (ordersData || []).filter(o => o.status === 'preparing').length;

    const deliverySummary = {
      delivered: deliveredCount,
      out_for_delivery: outForDeliveryCount,
      preparing: preparingCount
    };

    const advancedSummary = {
      period: { from: dateFrom, to: dateTo },
      revenue: totalRevenue,
      orders: totalOrders
    };

    const response = {
      stats: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue
      },
      topProducts,
      topCustomers,
      fulfillmentStats,
      deliverySummary,
      advancedSummary,
      driverRevenue: driverRevenueAgg,
      zoneBreakdown,
      overdueStats,
      efficiencyStats,
      meta: {
        dateFrom,
        dateTo,
        limit,
        topLimit,
        interval,
        generatedAt: new Date().toISOString()
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});