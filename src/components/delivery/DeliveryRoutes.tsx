import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Route, 
  MapPin, 
  Clock, 
  Truck,
  Edit,
  Users,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useRouteManagement } from "@/hooks/useRouteManagement";
import { useDriverManagement } from "@/hooks/useDriverManagement";

interface DeliveryRoutesProps {
  className?: string;
}

interface RouteFormData {
  driver_id?: string;
  route_date: string;
  total_orders: number;
  estimated_duration?: number;
  status: string;
}

export function DeliveryRoutes({ className }: DeliveryRoutesProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const [formData, setFormData] = useState<RouteFormData>({
    route_date: format(new Date(), 'yyyy-MM-dd'),
    total_orders: 0,
    estimated_duration: 120,
    status: 'planned'
  });

  const formattedDate = format(selectedDate, 'yyyy-MM-dd');
  const { routes, loading, addRoute, updateRouteData } = useRouteManagement(formattedDate);
  const { drivers } = useDriverManagement();

  const handleSaveRoute = async () => {
    if (editingRoute) {
      await updateRouteData(editingRoute.id, formData);
    } else {
      await addRoute(formData);
    }
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEditRoute = (route: any) => {
    setEditingRoute(route);
    setFormData({
      driver_id: route.driver_id || '',
      route_date: route.route_date,
      total_orders: route.total_orders,
      estimated_duration: route.estimated_duration || 120,
      status: route.status
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingRoute(null);
    setFormData({
      route_date: format(selectedDate, 'yyyy-MM-dd'),
      total_orders: 0,
      estimated_duration: 120,
      status: 'planned'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDriverName = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    return driver ? driver.name : 'Unassigned';
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header with Date Picker and Add Route */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Delivery Routes</h2>
          <p className="text-muted-foreground">
            Manage delivery routes for {format(selectedDate, 'PPP')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                New Route
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingRoute ? 'Edit Route' : 'Create New Route'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="driver">Driver</Label>
                  <Select 
                    value={formData.driver_id || 'unassigned'} 
                    onValueChange={(value) => setFormData({...formData, driver_id: value === 'unassigned' ? '' : value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {drivers.filter(d => d.is_active).map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.name} ({driver.vehicle_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Route Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.route_date}
                    onChange={(e) => setFormData({...formData, route_date: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orders">Number of Orders</Label>
                  <Input
                    id="orders"
                    type="number"
                    min="0"
                    value={formData.total_orders}
                    onChange={(e) => setFormData({...formData, total_orders: parseInt(e.target.value) || 0})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Estimated Duration (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="30"
                    value={formData.estimated_duration || 120}
                    onChange={(e) => setFormData({...formData, estimated_duration: parseInt(e.target.value) || 120})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(value) => setFormData({...formData, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveRoute}>
                    {editingRoute ? 'Update Route' : 'Create Route'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Routes List */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Routes</CardTitle>
          <p className="text-sm text-muted-foreground">
            {routes.length} routes planned for {format(selectedDate, 'PP')}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground">Loading routes...</p>
              </div>
            </div>
          ) : routes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Route className="h-12 w-12 mx-auto opacity-50" />
              <p className="font-medium">No routes planned</p>
              <p className="text-sm">Create your first delivery route for {format(selectedDate, 'PP')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {routes.map((route) => (
                <div key={route.id} className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Route className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-semibold text-lg">
                            Route #{route.id.slice(-8)}
                          </h3>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getStatusColor(route.status))}
                        >
                          {route.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Driver: {getDriverName(route.driver_id || '')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span>{route.total_orders} orders</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>~{route.estimated_duration || 120} minutes</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRoute(route)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                  </div>

                  {/* Route Details */}
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Distance: {route.total_distance ? `${route.total_distance}km` : 'TBD'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            Duration: {route.actual_duration ? `${route.actual_duration}min` : 'Estimated'}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Created: {format(new Date(route.created_at), 'HH:mm')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}