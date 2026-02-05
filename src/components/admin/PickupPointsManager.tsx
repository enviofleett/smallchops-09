import React, { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, MapPin, Phone, Clock, User } from "lucide-react";

interface PickupPoint {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code?: string;
  phone?: string;
  email?: string;
  operating_hours?: Record<string, any>;
  is_active: boolean;
  instructions?: string;
  contact_person?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

interface PickupPointFormData {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  contact_person: string;
  instructions: string;
  is_active: boolean;
  operating_hours: {
    monday: { open: string; close: string; closed: boolean };
    tuesday: { open: string; close: string; closed: boolean };
    wednesday: { open: string; close: string; closed: boolean };
    thursday: { open: string; close: string; closed: boolean };
    friday: { open: string; close: string; closed: boolean };
    saturday: { open: string; close: string; closed: boolean };
    sunday: { open: string; close: string; closed: boolean };
  };
}

const defaultFormData: PickupPointFormData = {
  name: '',
  address: '',
  city: '',
  state: 'Lagos',
  postal_code: '',
  phone: '',
  email: '',
  contact_person: '',
  instructions: '',
  is_active: true,
  operating_hours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '18:00', closed: false },
    sunday: { open: '10:00', close: '16:00', closed: false },
  }
};

export function PickupPointsManager() {
  const [pickupPoints, setPickupPoints] = useState<PickupPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PickupPoint | null>(null);
  const [formData, setFormData] = useState<PickupPointFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPickupPoints();
  }, []);

  const fetchPickupPoints = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('pickup_points')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPickupPoints((data as unknown as PickupPoint[]) || []);
    } catch (error) {
      console.error('Error fetching pickup points:', error);
      toast({
        title: "Error",
        description: "Failed to fetch pickup points",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.address.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const pickupPointData = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state,
        postal_code: formData.postal_code.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        contact_person: formData.contact_person.trim() || null,
        instructions: formData.instructions.trim() || null,
        is_active: formData.is_active,
        operating_hours: formData.operating_hours,
      };

      if (editingPoint) {
        const { error } = await (supabase as any)
          .from('pickup_points')
          .update(pickupPointData)
          .eq('id', editingPoint.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pickup point updated successfully",
        });
      } else {
        const { error } = await (supabase as any)
          .from('pickup_points')
          .insert([pickupPointData]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pickup point created successfully",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchPickupPoints();
    } catch (error) {
      console.error('Error saving pickup point:', error);
      toast({
        title: "Error",
        description: "Failed to save pickup point",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (point: PickupPoint) => {
    setEditingPoint(point);
    setFormData({
      name: point.name,
      address: point.address,
      city: point.city,
      state: point.state,
      postal_code: point.postal_code || '',
      phone: point.phone || '',
      email: point.email || '',
      contact_person: point.contact_person || '',
      instructions: point.instructions || '',
      is_active: point.is_active,
      operating_hours: (point.operating_hours as typeof defaultFormData.operating_hours) || defaultFormData.operating_hours,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (pointId: string) => {
    if (!confirm('Are you sure you want to delete this pickup point?')) return;

    try {
      const { error } = await (supabase as any)
        .from('pickup_points')
        .delete()
        .eq('id', pointId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pickup point deleted successfully",
      });
      fetchPickupPoints();
    } catch (error) {
      console.error('Error deleting pickup point:', error);
      toast({
        title: "Error",
        description: "Failed to delete pickup point",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingPoint(null);
  };

  const formatOperatingHours = (hours: any) => {
    if (!hours) return 'Not specified';
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = dayNames[new Date().getDay()];
    const todayHours = hours[today];
    
    if (todayHours?.closed) return 'Closed today';
    return `Today: ${todayHours?.open || '09:00'} - ${todayHours?.close || '18:00'}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Pickup Points</h2>
          <p className="text-muted-foreground">Manage store locations for customer pickup</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pickup Point
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPoint ? 'Edit Pickup Point' : 'Add New Pickup Point'}
              </DialogTitle>
              <DialogDescription>
                Configure a new pickup location for customer orders
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Store Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Main Store Lagos"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Store manager name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Full street address"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g., Lagos"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g., Lagos"
                  />
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="100001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+234 801 234 5678"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="store@example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="instructions">Pickup Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="e.g., Main entrance, ask for pickup counter"
                  rows={2}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Active (visible to customers)</Label>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Pickup Point'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading pickup points...</div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pickup Locations ({pickupPoints.length})</CardTitle>
            <CardDescription>
              Manage your store locations where customers can collect their orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pickupPoints.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pickup points configured yet. Add your first location to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickupPoints.map((point) => (
                    <TableRow key={point.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{point.name}</div>
                          {point.contact_person && (
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {point.contact_person}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3" />
                          <span>{point.address}, {point.city}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {point.phone && (
                            <div className="text-sm flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {point.phone}
                            </div>
                          )}
                          {point.email && (
                            <div className="text-xs text-muted-foreground">{point.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={point.is_active ? "default" : "secondary"}>
                          {point.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatOperatingHours(point.operating_hours)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(point)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(point.id)}
                          >
                            <Trash2 className="h-3 w-3" />
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
      )}
    </div>
  );
}