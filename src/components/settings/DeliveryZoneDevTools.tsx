import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  DollarSign, 
  TestTube, 
  Database, 
  ShoppingCart,
  FileText,
  CheckCircle,
  AlertCircle,
  Code
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDeliveryZonesWithFees, upsertDeliveryZoneWithFee } from "@/api/delivery";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export const DeliveryZoneDevTools = () => {
  const [testZoneName, setTestZoneName] = useState("");
  const [testZoneFee, setTestZoneFee] = useState("");
  const [testOrderValue, setTestOrderValue] = useState("1000");
  const queryClient = useQueryClient();

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['delivery-zones-dev'],
    queryFn: getDeliveryZonesWithFees,
  });

  const createTestZone = useMutation({
    mutationFn: async () => {
      if (!testZoneName || !testZoneFee) {
        throw new Error("Zone name and fee are required");
      }

      return upsertDeliveryZoneWithFee({
        zone: {
          name: testZoneName,
          description: `Test zone: ${testZoneName}`,
          area: {},
        },
        fee: {
          base_fee: parseFloat(testZoneFee),
          min_order_for_free_delivery: 5000,
        }
      });
    },
    onSuccess: () => {
      toast.success("Test zone created successfully");
      setTestZoneName("");
      setTestZoneFee("");
      queryClient.invalidateQueries({ queryKey: ['delivery-zones-dev'] });
    },
    onError: (error) => {
      toast.error(`Failed to create test zone: ${error.message}`);
    }
  });

  const generateSampleZones = useMutation({
    mutationFn: async () => {
      const sampleZones = [
        { name: "Downtown", fee: 500, description: "Central business district" },
        { name: "Airport", fee: 1500, description: "Airport vicinity" },
        { name: "Suburbs", fee: 800, description: "Suburban areas" },
      ];

      for (const zone of sampleZones) {
        await upsertDeliveryZoneWithFee({
          zone: {
            name: zone.name,
            description: zone.description,
            area: {},
          },
          fee: {
            base_fee: zone.fee,
            min_order_for_free_delivery: 5000,
          }
        });
      }
    },
    onSuccess: () => {
      toast.success("Sample zones created successfully");
      queryClient.invalidateQueries({ queryKey: ['delivery-zones-dev'] });
    },
    onError: (error) => {
      toast.error(`Failed to create sample zones: ${error.message}`);
    }
  });

  const testCheckoutCalculation = () => {
    const orderValue = parseFloat(testOrderValue);
    const taxRate = 0.08; // 8% tax
    const selectedZone = zones[0]; // Use first zone for demo
    
    if (!selectedZone) {
      toast.error("No zones available for testing");
      return;
    }

    const productSubtotal = orderValue;
    const tax = productSubtotal * taxRate;
    const shippingFee = selectedZone.delivery_fees?.base_fee || 0;
    const total = productSubtotal + tax + shippingFee;

    toast.success(`Test Calculation Complete:
    Product Subtotal: ₦${productSubtotal.toLocaleString()}
    Tax (8%): ₦${tax.toLocaleString()}
    Shipping - ${selectedZone.name}: ₦${shippingFee.toLocaleString()}
    Total: ₦${total.toLocaleString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="w-5 h-5" />
            <span>Delivery Zone System Overview</span>
          </CardTitle>
          <CardDescription>
            Development tools and testing utilities for the delivery zone pricing system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <Database className="w-8 h-8 text-blue-500" />
              <div>
                <div className="font-medium">Current Zones</div>
                <div className="text-2xl font-bold">{zones.length}</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <DollarSign className="w-8 h-8 text-green-500" />
              <div>
                <div className="font-medium">Active Zones</div>
                <div className="text-2xl font-bold">{zones.length}</div>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
              <div>
                <div className="font-medium">System Status</div>
                <div className="text-sm font-medium text-green-600">Operational</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Zone Creation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TestTube className="w-5 h-5" />
            <span>Quick Zone Testing</span>
          </CardTitle>
          <CardDescription>
            Create test zones and generate sample data for development
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="test-zone-name">Zone Name</Label>
                <Input
                  id="test-zone-name"
                  value={testZoneName}
                  onChange={(e) => setTestZoneName(e.target.value)}
                  placeholder="e.g., Test Zone 1"
                />
              </div>
              <div>
                <Label htmlFor="test-zone-fee">Base Fee (₦)</Label>
                <Input
                  id="test-zone-fee"
                  type="number"
                  value={testZoneFee}
                  onChange={(e) => setTestZoneFee(e.target.value)}
                  placeholder="e.g., 500"
                />
              </div>
              <Button 
                onClick={() => createTestZone.mutate()}
                disabled={createTestZone.isPending || !testZoneName || !testZoneFee}
                className="w-full"
              >
                Create Test Zone
              </Button>
            </div>
            <div className="space-y-3">
              <Button 
                onClick={() => generateSampleZones.mutate()}
                disabled={generateSampleZones.isPending}
                variant="outline"
                className="w-full"
              >
                Generate Sample Zones
              </Button>
              <div className="text-sm text-muted-foreground">
                Creates Downtown (₦500), Airport (₦1,500), and Suburbs (₦800) zones
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Testing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5" />
            <span>Checkout Flow Testing</span>
          </CardTitle>
          <CardDescription>
            Test the checkout calculation with different order values
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-4 items-end">
            <div className="flex-1">
              <Label htmlFor="test-order-value">Test Order Value (₦)</Label>
              <Input
                id="test-order-value"
                type="number"
                value={testOrderValue}
                onChange={(e) => setTestOrderValue(e.target.value)}
                placeholder="e.g., 1000"
              />
            </div>
            <Button 
              onClick={testCheckoutCalculation}
              disabled={!testOrderValue || zones.length === 0}
            >
              Test Calculation
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            This will simulate the checkout calculation using the first available zone
          </div>
        </CardContent>
      </Card>

      {/* Current Zones */}
      <Card>
        <CardHeader>
          <CardTitle>Current Delivery Zones</CardTitle>
          <CardDescription>
            Overview of all configured delivery zones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Loading zones...</div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery zones configured. Create some test zones above.
            </div>
          ) : (
            <div className="space-y-3">
              {zones.map((zone) => (
                <div key={zone.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{zone.name}</div>
                      <div className="text-sm text-muted-foreground">{zone.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="default">
                      Active
                    </Badge>
                    <div className="text-right">
                      <div className="font-medium">₦{zone.delivery_fees?.base_fee?.toLocaleString() || 0}</div>
                      <div className="text-xs text-muted-foreground">Base Fee</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Code className="w-5 h-5" />
            <span>API Documentation</span>
          </CardTitle>
          <CardDescription>
            Key API endpoints and database schema for delivery zones
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Database Tables</h4>
            <div className="space-y-2 text-sm font-mono">
              <div>• delivery_zones (id, name, description, is_active)</div>
              <div>• delivery_fees (zone_id, base_fee, minimum_order_for_free_delivery)</div>
              <div>• orders (delivery_zone_id, shipping_fee)</div>
            </div>
          </div>
          
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Key API Functions</h4>
            <div className="space-y-2 text-sm font-mono">
              <div>• getDeliveryZonesWithFees() - Fetch all zones with fees</div>
              <div>• upsertDeliveryZoneWithFee() - Create/update zone</div>
              <div>• calculateDeliveryFee() - Calculate fee for zone</div>
            </div>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-medium mb-2">Implementation Files</h4>
            <div className="space-y-2 text-sm font-mono">
              <div>• /api/delivery.ts - API functions</div>
              <div>• /components/delivery/DeliveryZoneSelector.tsx - Customer selection</div>
              <div>• /components/checkout/CheckoutFlow.tsx - Invoice breakdown</div>
              <div>• /components/delivery/ZoneAnalytics.tsx - Analytics</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};