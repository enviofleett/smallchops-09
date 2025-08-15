import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle, MapPin, DollarSign } from 'lucide-react';
import { getDeliveryZonesWithFees, DeliveryZoneWithFee } from '@/api/delivery';
import { supabase } from '@/integrations/supabase/client';

interface ZoneHealthIssue {
  zoneId: string;
  zoneName: string;
  severity: 'error' | 'warning' | 'info';
  issue: string;
  description: string;
}

export const DeliveryZoneHealthMonitor: React.FC = () => {
  const [zones, setZones] = useState<DeliveryZoneWithFee[]>([]);
  const [issues, setIssues] = useState<ZoneHealthIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalZones: 0,
    activeZones: 0,
    zonesWithIssues: 0,
    validZones: 0
  });

  useEffect(() => {
    analyzeDeliveryZones();
  }, []);

  const analyzeDeliveryZones = async () => {
    try {
      setLoading(true);
      
      // Get all zones (including inactive ones for admin review)
      const { data: allZones, error } = await supabase
        .from('delivery_zones')
        .select(`
          *,
          delivery_fees(*)
        `)
        .order('name');

      if (error) throw error;

      const processedZones = allZones.map(zone => ({
        ...zone,
        delivery_fees: Array.isArray(zone.delivery_fees) && zone.delivery_fees.length > 0 ? zone.delivery_fees[0] : null,
      })) as DeliveryZoneWithFee[];

      setZones(processedZones);

      // Analyze for issues
      const detectedIssues: ZoneHealthIssue[] = [];
      let validZoneCount = 0;

      processedZones.forEach(zone => {
        let hasIssues = false;

        // Check if zone has no delivery fees configured
        if (!zone.delivery_fees) {
          detectedIssues.push({
            zoneId: zone.id,
            zoneName: zone.name,
            severity: 'error',
            issue: 'No delivery fees configured',
            description: 'This zone has no delivery fee structure defined, making it unusable for orders.'
          });
          hasIssues = true;
        } else {
          // Check for negative or zero base fee
          if (zone.delivery_fees.base_fee <= 0) {
            detectedIssues.push({
              zoneId: zone.id,
              zoneName: zone.name,
              severity: 'warning',
              issue: 'Zero or negative base fee',
              description: 'Base delivery fee should be greater than zero for sustainable operations.'
            });
            hasIssues = true;
          }

          // Check for unrealistic fee per km
          if (zone.delivery_fees.fee_per_km && zone.delivery_fees.fee_per_km > 100) {
            detectedIssues.push({
              zoneId: zone.id,
              zoneName: zone.name,
              severity: 'warning',
              issue: 'High per-kilometer fee',
              description: `Fee per km (₦${zone.delivery_fees.fee_per_km}) seems unusually high.`
            });
            hasIssues = true;
          }

          // Check for unrealistic free delivery threshold
          if (zone.delivery_fees.min_order_for_free_delivery && zone.delivery_fees.min_order_for_free_delivery > 50000) {
            detectedIssues.push({
              zoneId: zone.id,
              zoneName: zone.name,
              severity: 'info',
              issue: 'High free delivery threshold',
              description: `Free delivery threshold (₦${zone.delivery_fees.min_order_for_free_delivery}) may be too high for most customers.`
            });
            hasIssues = true;
          }
        }

        // Check for inactive zones
        if (zone.is_active === false) {
          detectedIssues.push({
            zoneId: zone.id,
            zoneName: zone.name,
            severity: 'info',
            issue: 'Zone inactive',
            description: 'This zone is currently disabled and not available to customers.'
          });
          hasIssues = true;
        }

        // Check for empty geographic area
        if (!zone.area || 
            (typeof zone.area === 'object' && 
             zone.area !== null && 
             'coordinates' in zone.area && 
             (!zone.area.coordinates || (Array.isArray(zone.area.coordinates) && zone.area.coordinates.length === 0)))) {
          detectedIssues.push({
            zoneId: zone.id,
            zoneName: zone.name,
            severity: 'warning',
            issue: 'No geographic boundaries',
            description: 'Zone has no defined geographic area for automatic address validation.'
          });
          hasIssues = true;
        }

        if (!hasIssues && zone.is_active !== false) {
          validZoneCount++;
        }
      });

      setIssues(detectedIssues);
      setStats({
        totalZones: processedZones.length,
        activeZones: processedZones.filter(z => z.is_active !== false).length,
        zonesWithIssues: new Set(detectedIssues.map(i => i.zoneId)).size,
        validZones: validZoneCount
      });

    } catch (error) {
      console.error('Error analyzing delivery zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Delivery Zone Health Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            Analyzing delivery zones...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Zones</p>
                <p className="text-xl font-semibold">{stats.totalZones}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Active Zones</p>
                <p className="text-xl font-semibold">{stats.activeZones}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">With Issues</p>
                <p className="text-xl font-semibold">{stats.zonesWithIssues}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Production Ready</p>
                <p className="text-xl font-semibold">{stats.validZones}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Zone Health Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>All delivery zones are healthy!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.map((issue, index) => (
                <Alert key={index} className={
                  issue.severity === 'error' ? 'border-red-200 bg-red-50' :
                  issue.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }>
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{issue.zoneName}</span>
                        <Badge variant="outline" className={
                          issue.severity === 'error' ? 'border-red-300 text-red-700' :
                          issue.severity === 'warning' ? 'border-yellow-300 text-yellow-700' :
                          'border-blue-300 text-blue-700'
                        }>
                          {issue.issue}
                        </Badge>
                      </div>
                      <AlertDescription className="text-sm">
                        {issue.description}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Production Readiness Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Production Readiness</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span>Zones with delivery fees configured</span>
              <Badge variant={zones.filter(z => z.delivery_fees).length === zones.length ? 'default' : 'destructive'}>
                {zones.filter(z => z.delivery_fees).length}/{zones.length}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span>Zones with valid pricing</span>
              <Badge variant={zones.filter(z => z.delivery_fees && z.delivery_fees.base_fee > 0).length === zones.length ? 'default' : 'destructive'}>
                {zones.filter(z => z.delivery_fees && z.delivery_fees.base_fee > 0).length}/{zones.length}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <span>Active zones</span>
              <Badge variant={stats.activeZones > 0 ? 'default' : 'destructive'}>
                {stats.activeZones}/{stats.totalZones}
              </Badge>
            </div>

            {stats.validZones === stats.activeZones && stats.activeZones > 0 ? (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <AlertDescription className="text-green-700">
                  🎉 All active delivery zones are production-ready!
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <AlertDescription className="text-yellow-700">
                  Some zones need attention before they're production-ready. Please review the issues above.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};