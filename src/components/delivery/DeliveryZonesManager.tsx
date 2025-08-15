import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { getDeliveryZonesWithFees, upsertDeliveryZoneWithFee, deleteDeliveryZone, DeliveryZoneWithFee } from '@/api/delivery';

interface ZoneFormData {
  id?: string;
  name: string;
  description: string;
  base_fee: number;
  fee_per_km: number;
  min_order_for_free_delivery: number;
}

export const DeliveryZonesManager: React.FC = () => {
  const [zones, setZones] = useState<DeliveryZoneWithFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZoneWithFee | null>(null);
  const [formData, setFormData] = useState<ZoneFormData>({
    name: '',
    description: '',
    base_fee: 0,
    fee_per_km: 0,
    min_order_for_free_delivery: 0
  });

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      setLoading(true);
      const data = await getDeliveryZonesWithFees();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones:', error);
      toast.error('Failed to load delivery zones');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZone = async () => {
    if (!formData.name.trim()) {
      toast.error('Zone name is required');
      return;
    }

    if (formData.base_fee < 0) {
      toast.error('Base fee cannot be negative');
      return;
    }

    try {
      const zoneData = {
        id: editingZone?.id,
        name: formData.name,
        description: formData.description,
        area: { type: 'polygon', coordinates: [] } // Basic GeoJSON structure
      };

      const feeData = {
        id: editingZone?.delivery_fees?.id,
        base_fee: formData.base_fee,
        fee_per_km: formData.fee_per_km || null,
        min_order_for_free_delivery: formData.min_order_for_free_delivery || null
      };

      await upsertDeliveryZoneWithFee({ zone: zoneData, fee: feeData });
      
      toast.success(editingZone ? 'Zone updated successfully' : 'Zone created successfully');
      setDialogOpen(false);
      resetForm();
      fetchZones();
    } catch (error) {
      console.error('Error saving zone:', error);
      toast.error('Failed to save zone');
    }
  };

  const handleEditZone = (zone: DeliveryZoneWithFee) => {
    setEditingZone(zone);
    setFormData({
      id: zone.id,
      name: zone.name,
      description: zone.description || '',
      base_fee: zone.delivery_fees?.base_fee || 0,
      fee_per_km: zone.delivery_fees?.fee_per_km || 0,
      min_order_for_free_delivery: zone.delivery_fees?.min_order_for_free_delivery || 0
    });
    setDialogOpen(true);
  };

  const handleDeleteZone = async (zoneId: string, zoneName: string) => {
    if (!confirm(`Are you sure you want to delete "${zoneName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDeliveryZone(zoneId);
      toast.success('Zone deleted successfully');
      fetchZones();
    } catch (error) {
      console.error('Error deleting zone:', error);
      toast.error('Failed to delete zone');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      base_fee: 0,
      fee_per_km: 0,
      min_order_for_free_delivery: 0
    });
    setEditingZone(null);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Delivery Zones</h2>
          <p className="text-muted-foreground">Manage delivery zones and pricing</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Zone
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingZone ? 'Edit Zone' : 'Create New Zone'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Zone Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Downtown, Airport Area"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the zone"
                />
              </div>
              <div>
                <Label htmlFor="base_fee">Base Delivery Fee (₦) *</Label>
                <Input
                  id="base_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.base_fee}
                  onChange={(e) => setFormData(prev => ({ ...prev, base_fee: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="fee_per_km">Fee per KM (₦)</Label>
                <Input
                  id="fee_per_km"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.fee_per_km}
                  onChange={(e) => setFormData(prev => ({ ...prev, fee_per_km: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="min_order">Min Order for Free Delivery (₦)</Label>
                <Input
                  id="min_order"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.min_order_for_free_delivery}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_order_for_free_delivery: parseFloat(e.target.value) || 0 }))}
                  placeholder="0.00"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={handleDialogClose} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveZone} className="flex-1">
                  {editingZone ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Zone List ({zones.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading zones...</div>
          ) : zones.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No delivery zones configured yet. Create your first zone to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zone Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Base Fee</TableHead>
                  <TableHead>Per KM</TableHead>
                  <TableHead>Free Delivery Min</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {zones.map((zone) => (
                  <TableRow key={zone.id}>
                    <TableCell className="font-medium">{zone.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {zone.description || 'No description'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        ₦{zone.delivery_fees?.base_fee?.toFixed(2) || '0.00'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {zone.delivery_fees?.fee_per_km ? 
                        `₦${zone.delivery_fees.fee_per_km.toFixed(2)}` : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      {zone.delivery_fees?.min_order_for_free_delivery ? 
                        `₦${zone.delivery_fees.min_order_for_free_delivery.toFixed(2)}` : 
                        'N/A'
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditZone(zone)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteZone(zone.id, zone.name)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};