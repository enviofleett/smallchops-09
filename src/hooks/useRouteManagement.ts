import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  getRoutes, 
  createRoute, 
  updateRoute, 
  assignOrdersToRoute,
  getRouteAssignments,
  updateDeliveryStatus,
  type DeliveryRoute,
  type RouteOrderAssignment
} from '@/api/routes';

export const useRouteManagement = (selectedDate?: string) => {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [assignments, setAssignments] = useState<Record<string, RouteOrderAssignment[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRoutes(selectedDate);
      setRoutes(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch routes';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const addRoute = async (routeData: Omit<DeliveryRoute, 'id' | 'created_at' | 'updated_at'>): Promise<DeliveryRoute | null> => {
    try {
      const newRoute = await createRoute(routeData);
      setRoutes(prev => [...prev, newRoute]);
      toast.success('Route created successfully');
      return newRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create route';
      toast.error(errorMessage);
      return null;
    }
  };

  const updateRouteData = async (id: string, updates: Partial<DeliveryRoute>): Promise<DeliveryRoute | null> => {
    try {
      const updatedRoute = await updateRoute(id, updates);
      setRoutes(prev => prev.map(route => 
        route.id === id ? updatedRoute : route
      ));
      toast.success('Route updated successfully');
      return updatedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update route';
      toast.error(errorMessage);
      return null;
    }
  };

  const assignOrders = async (routeId: string, orderIds: string[]): Promise<boolean> => {
    try {
      const newAssignments = await assignOrdersToRoute(routeId, orderIds);
      setAssignments(prev => ({
        ...prev,
        [routeId]: newAssignments
      }));
      toast.success(`${orderIds.length} orders assigned to route`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign orders';
      toast.error(errorMessage);
      return false;
    }
  };

  const fetchRouteAssignments = async (routeId: string): Promise<RouteOrderAssignment[]> => {
    try {
      const data = await getRouteAssignments(routeId);
      setAssignments(prev => ({
        ...prev,
        [routeId]: data
      }));
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch route assignments';
      toast.error(errorMessage);
      return [];
    }
  };

  const updateAssignmentStatus = async (
    assignmentId: string, 
    routeId: string,
    status: 'pending' | 'en_route' | 'delivered' | 'failed',
    notes?: string
  ): Promise<boolean> => {
    try {
      await updateDeliveryStatus(assignmentId, status, notes);
      
      // Update local state
      setAssignments(prev => ({
        ...prev,
        [routeId]: prev[routeId]?.map(assignment =>
          assignment.id === assignmentId
            ? { ...assignment, delivery_status: status, delivery_notes: notes }
            : assignment
        ) || []
      }));
      
      toast.success('Delivery status updated');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      toast.error(errorMessage);
      return false;
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [selectedDate]);

  return {
    routes,
    assignments,
    loading,
    error,
    fetchRoutes,
    addRoute,
    updateRouteData,
    assignOrders,
    fetchRouteAssignments,
    updateAssignmentStatus
  };
};