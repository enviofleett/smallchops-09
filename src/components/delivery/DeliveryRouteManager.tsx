import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Route, Edit, Trash2, MapPin, Clock } from 'lucide-react';
import { useRouteManagement } from '@/hooks/useRouteManagement';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RouteFormData {
  driver_id?: string;
  route_date: string;
  total_orders: number;
  total_distance?: number;
  estimated_duration?: number;
  status: string;
}

interface DeliveryRouteManagerProps {
  selectedDate: Date;
}

export const DeliveryRouteManager: React.FC<DeliveryRouteManagerProps> = ({ selectedDate }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [formData, setFormData] = useState<RouteFormData>({
    route_date: format(selectedDate, 'yyyy-MM-dd'),
    total_orders: 0,
    status: 'planned'
  });

  const selectedDateString = format(selectedDate, 'yyyy-MM-dd');
  const { 
    routes, 
    loading: routesLoading, 
    addRoute, 
    updateRouteData,
    fetchRoutes 
  } = useRouteManagement(selectedDateString);
  
  const { drivers } = useDriverManagement();

  const handleSaveRoute = async () => {
    try {
      const routeData = {
        driver_id: formData.driver_id,
        route_date: formData.route_date,
        total_orders: formData.total_orders,
        total_distance: formData.total_distance,
        estimated_duration: formData.estimated_duration,
        status: formData.status,
      };

      if (editingRoute) {
        await updateRouteData(editingRoute.id, routeData);
        toast.success('Route updated successfully');
      } else {
        await addRoute(routeData);
        toast.success('Route created successfully');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRoutes();
    } catch (error) {
      console.error('Error saving route:', error);
      toast.error('Failed to save route');
    }
  };

  const handleEditRoute = (route: any) => {
    setEditingRoute(route);
    setFormData({
      driver_id: route.driver_id,
      route_date: route.route_date,
      total_orders: route.total_orders,
      total_distance: route.total_distance,
      estimated_duration: route.estimated_duration,
      status: route.status,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      route_date: format(selectedDate, 'yyyy-MM-dd'),
      total_orders: 0,
      status: 'planned'
    });
    setEditingRoute(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'secondary';
      case 'in_progress': return 'default';
      case 'completed': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getDriverName = (driverId?: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : 'Unassigned';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Delivery Routes</h2>
          <p className="text-muted-foreground">
            Manage delivery routes for {format(selectedDate, 'PPP')}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Route
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingRoute ? 'Edit Route' : 'Create New Route'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="driver_id">Assign Driver</Label>
                <Select value={formData.driver_id || ""} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, driver_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name} ({driver.vehicle_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="route_date">Route Date</Label>
                <Input
                  id="route_date"
                  type="date"
                  value={formData.route_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, route_date: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="total_orders">Expected Orders</Label>
                <Input
                  id="total_orders"
                  type="number"
                  min="0"
                  value={formData.total_orders}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_orders: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="estimated_duration">Estimated Duration (minutes)</Label>
                <Input
                  id="estimated_duration"
                  type="number"
                  min="0"
                  value={formData.estimated_duration || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, estimated_duration: parseInt(e.target.value) || undefined }))}
                  placeholder="120"
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => 
                  setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSaveRoute} className="flex-1">
                  {editingRoute ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Routes ({routes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {routesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading routes...</div>
          ) : routes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No routes planned for this date. Create your first route to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route) => (
                  <TableRow key={route.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {getDriverName(route.driver_id)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {route.total_orders} orders
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {route.estimated_duration ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {route.estimated_duration}min
                        </div>
                      ) : (
                        'TBD'
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(route.status)}>
                        {route.status?.replace(/_/g, ' ') || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditRoute(route)}
                        >
                          <Edit className="w-4 h-4" />
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