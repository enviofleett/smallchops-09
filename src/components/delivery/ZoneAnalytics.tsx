import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, DollarSign, Package, TrendingUp } from 'lucide-react';
import { getDeliveryZonesWithFees, DeliveryZoneWithFee } from '@/api/delivery';
import { supabase } from '@/integrations/supabase/client';

interface ZoneStats {
  zone_id: string;
  zone_name: string;
  total_orders: number;
  total_revenue: number;
  avg_delivery_fee: number;
}

export const ZoneAnalytics: React.FC = () => {
  const [zones, setZones] = useState<DeliveryZoneWithFee[]>([]);
  const [zoneStats, setZoneStats] = useState<ZoneStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchZoneAnalytics();
  }, []);

  const fetchZoneAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch zones
      const zonesData = await getDeliveryZonesWithFees();
      setZones(zonesData);

      // Fetch zone statistics from orders - using two-step approach to avoid relation errors
      const { data: orders, error } = await supabase
        .from('orders')
        .select('delivery_zone_id, total_amount, delivery_fee')
        .not('delivery_zone_id', 'is', null)
        .eq('status', 'delivered');

      if (error) throw error;

      // Get zone names separately
      const zoneIds = [...new Set(orders?.map(o => o.delivery_zone_id).filter(Boolean) || [])];
      const { data: zoneNames } = await supabase
        .from('delivery_zones')
        .select('id, name')
        .in('id', zoneIds);

      const zoneNameMap = new Map(zoneNames?.map(z => [z.id, z.name]) || []);

      // Process statistics by zone
      const statsMap = new Map<string, ZoneStats>();
      
      orders?.forEach(order => {
        const zoneId = order.delivery_zone_id;
        const zoneName = zoneNameMap.get(zoneId) || 'Unknown Zone';
        
        if (!statsMap.has(zoneId)) {
          statsMap.set(zoneId, {
            zone_id: zoneId,
            zone_name: zoneName,
            total_orders: 0,
            total_revenue: 0,
            avg_delivery_fee: 0,
          });
        }
        
        const zoneData = statsMap.get(zoneId)!;
        zoneData.total_orders += 1;
        zoneData.total_revenue += order.total_amount || 0;
        zoneData.avg_delivery_fee += order.delivery_fee || 0;
      });

      // Calculate averages and convert to array
      const processedStats = Array.from(statsMap.values()).map(zone => ({
        ...zone,
        avg_delivery_fee: zone.total_orders > 0 ? zone.avg_delivery_fee / zone.total_orders : 0
      }));

      setZoneStats(processedStats);
    } catch (error) {
      console.error('Error fetching zone analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, index) => (
          <Card key={index} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const totalZones = zones.length;
  const activeZones = zoneStats.length;
  const totalZoneRevenue = zoneStats.reduce((sum, zone) => sum + zone.total_revenue, 0);
  const totalZoneOrders = zoneStats.reduce((sum, zone) => sum + zone.total_orders, 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalZones}</div>
            <p className="text-xs text-muted-foreground">configured zones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Zones</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeZones}</div>
            <p className="text-xs text-muted-foreground">with deliveries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zone Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalZoneRevenue)}</div>
            <p className="text-xs text-muted-foreground">total delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zone Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalZoneOrders}</div>
            <p className="text-xs text-muted-foreground">completed orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Zone Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Zone Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Revenue and order statistics by delivery zone
          </p>
        </CardHeader>
        <CardContent>
          {zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery zones configured yet. Create your first delivery zone to start tracking performance.
            </div>
          ) : activeZones === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No completed deliveries yet. Zone performance will appear here once orders are delivered.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {zones.map((zone) => {
                const stats = zoneStats.find(s => s.zone_id === zone.id);
                const baseFee = zone.base_fee || 0;
                
                return (
                  <Card key={zone.id} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{zone.name}</CardTitle>
                        <Badge variant={stats ? "default" : "secondary"}>
                          {stats ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {/* Simplified - no description */}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Base Fee:</span>
                        <span className="font-medium">{formatCurrency(baseFee)}</span>
                      </div>
                      
                      {stats ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Orders:</span>
                            <span className="font-medium">{stats.total_orders}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Revenue:</span>
                            <span className="font-medium">{formatCurrency(stats.total_revenue)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Avg. Delivery Fee:</span>
                            <span className="font-medium">{formatCurrency(stats.avg_delivery_fee)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          No completed deliveries
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};