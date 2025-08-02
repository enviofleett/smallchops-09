import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MapPin, Plus, Edit, Trash2, Star, Home, Building, MapIcon, Loader2 } from 'lucide-react';
import { useCustomerAddresses } from '@/hooks/useCustomerProfile';
import type { CustomerAddress } from '@/api/customerProfile';

const addressSchema = z.object({
  address_type: z.enum(['delivery', 'billing', 'other']),
  address_line_1: z.string().min(5, 'Address is required'),
  address_line_2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postal_code: z.string().min(3, 'Postal code is required'),
  country: z.string().default('Nigeria'),
  is_default: z.boolean().default(false),
  delivery_instructions: z.string().optional(),
  landmark: z.string().optional(),
  phone_number: z.string().optional(),
});

type AddressFormData = z.infer<typeof addressSchema>;

export function AddressManager() {
  const { addresses, addAddress, updateAddress, deleteAddress, isAdding, isUpdating, isDeleting } = useCustomerAddresses();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);

  const form = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      address_type: 'delivery',
      country: 'Nigeria',
      is_default: false,
    },
  });

  const onSubmit = (data: AddressFormData) => {
    if (editingAddress) {
      updateAddress({ id: editingAddress.id, updates: data });
    } else {
      addAddress(data as any);
    }
    setIsDialogOpen(false);
    setEditingAddress(null);
    form.reset();
  };

  const handleEdit = (address: CustomerAddress) => {
    setEditingAddress(address);
    form.reset({
      address_type: address.address_type as 'delivery' | 'billing' | 'other',
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || '',
      city: address.city,
      state: address.state,
      postal_code: address.postal_code,
      country: address.country,
      is_default: address.is_default,
      delivery_instructions: address.delivery_instructions || '',
      landmark: address.landmark || '',
      phone_number: address.phone_number || '',
    });
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingAddress(null);
    form.reset({
      address_type: 'delivery',
      country: 'Nigeria',
      is_default: false,
    });
    setIsDialogOpen(true);
  };

  const getAddressIcon = (type: string) => {
    switch (type) {
      case 'delivery':
        return <Home className="w-4 h-4" />;
      case 'billing':
        return <Building className="w-4 h-4" />;
      default:
        return <MapIcon className="w-4 h-4" />;
    }
  };

  const getAddressTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery':
        return 'Delivery';
      case 'billing':
        return 'Billing';
      default:
        return 'Other';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Delivery Addresses</h2>
          <p className="text-muted-foreground">
            Manage your delivery and billing addresses
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Address
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="address_type">Address Type</Label>
                  <Select
                    value={form.watch('address_type')}
                    onValueChange={(value) => form.setValue('address_type', value as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delivery">Delivery Address</SelectItem>
                      <SelectItem value="billing">Billing Address</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 pt-6">
                  <Switch
                    id="is_default"
                    checked={form.watch('is_default')}
                    onCheckedChange={(checked) => form.setValue('is_default', checked)}
                  />
                  <Label htmlFor="is_default">Set as default address</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="address_line_1">Address Line 1 *</Label>
                <Input
                  id="address_line_1"
                  {...form.register('address_line_1')}
                  className="mt-1"
                  placeholder="Street address, building number"
                />
                {form.formState.errors.address_line_1 && (
                  <p className="text-sm text-destructive mt-1">
                    {form.formState.errors.address_line_1.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="address_line_2">Address Line 2</Label>
                <Input
                  id="address_line_2"
                  {...form.register('address_line_2')}
                  className="mt-1"
                  placeholder="Apartment, suite, floor (optional)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    {...form.register('city')}
                    className="mt-1"
                  />
                  {form.formState.errors.city && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.city.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    {...form.register('state')}
                    className="mt-1"
                  />
                  {form.formState.errors.state && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.state.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="postal_code">Postal Code *</Label>
                  <Input
                    id="postal_code"
                    {...form.register('postal_code')}
                    className="mt-1"
                  />
                  {form.formState.errors.postal_code && (
                    <p className="text-sm text-destructive mt-1">
                      {form.formState.errors.postal_code.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="landmark">Landmark</Label>
                  <Input
                    id="landmark"
                    {...form.register('landmark')}
                    className="mt-1"
                    placeholder="Nearby landmark"
                  />
                </div>

                <div>
                  <Label htmlFor="phone_number">Contact Phone</Label>
                  <Input
                    id="phone_number"
                    {...form.register('phone_number')}
                    className="mt-1"
                    placeholder="Phone number for delivery"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="delivery_instructions">Delivery Instructions</Label>
                <Textarea
                  id="delivery_instructions"
                  {...form.register('delivery_instructions')}
                  className="mt-1 resize-none"
                  rows={3}
                  placeholder="Special instructions for delivery..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isAdding || isUpdating}>
                  {(isAdding || isUpdating) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editingAddress ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    editingAddress ? 'Update Address' : 'Add Address'
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Addresses List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {addresses.map((address) => (
          <Card key={address.id} className={address.is_default ? 'ring-2 ring-primary' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getAddressIcon(address.address_type)}
                  <CardTitle className="text-lg">
                    {getAddressTypeLabel(address.address_type)} Address
                  </CardTitle>
                  {address.is_default && (
                    <Badge variant="default" className="flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(address)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Address</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this address? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAddress(address.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <p className="font-medium">{address.address_line_1}</p>
                {address.address_line_2 && (
                  <p className="text-muted-foreground">{address.address_line_2}</p>
                )}
                <p className="text-muted-foreground">
                  {address.city}, {address.state} {address.postal_code}
                </p>
                <p className="text-muted-foreground">{address.country}</p>
              </div>

              {(address.landmark || address.delivery_instructions || address.phone_number) && (
                <>
                  <Separator />
                  <div className="space-y-1 text-sm">
                    {address.landmark && (
                      <p><span className="font-medium">Landmark:</span> {address.landmark}</p>
                    )}
                    {address.phone_number && (
                      <p><span className="font-medium">Phone:</span> {address.phone_number}</p>
                    )}
                    {address.delivery_instructions && (
                      <p><span className="font-medium">Instructions:</span> {address.delivery_instructions}</p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {addresses.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <MapPin className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No addresses yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first delivery address to get started with orders.
            </p>
            <Button onClick={handleAdd}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}