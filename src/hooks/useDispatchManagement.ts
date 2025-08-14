import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  createDispatchDriver, 
  getActiveDispatchRiders,
  assignRiderToOrder,
  getOrderAssignments,
  getRiderAssignments,
  updateAssignmentStatus,
  type DispatchDriver,
  type NewDispatchDriver,
  type OrderAssignment
} from '@/api/dispatchApi';

export const useDispatchManagement = () => {
  const [drivers, setDrivers] = useState<DispatchDriver[]>([]);
  const [assignments, setAssignments] = useState<OrderAssignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch active dispatch riders
  const fetchDrivers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getActiveDispatchRiders();
      setDrivers(data);
      console.log('✅ Fetched', data.length, 'active dispatch riders');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch dispatch riders';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('❌ Failed to fetch dispatch riders:', err);
    } finally {
      setLoading(false);
    }
  };

  // Create new dispatch driver with invitation
  const createDriver = async (
    driverData: NewDispatchDriver, 
    sendInvitation: boolean = true
  ): Promise<{ driverId: string; invitationSent: boolean } | null> => {
    try {
      setLoading(true);
      console.log('🚀 Creating dispatch driver with invitation:', driverData.name);
      
      const result = await createDispatchDriver(driverData, sendInvitation);
      
      // Refresh the drivers list
      await fetchDrivers();
      
      const message = sendInvitation && result.invitationSent 
        ? `Driver ${driverData.name} created and invitation sent successfully!`
        : `Driver ${driverData.name} created successfully!`;
      
      toast.success(message);
      console.log('✅ Dispatch driver created:', result);
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create dispatch driver';
      toast.error(errorMessage);
      console.error('❌ Failed to create dispatch driver:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Assign rider to order
  const assignRider = async (orderId: string, riderId: string): Promise<boolean> => {
    try {
      setLoading(true);
      console.log('🎯 Assigning rider to order:', { orderId, riderId });
      
      const assignmentId = await assignRiderToOrder(orderId, riderId);
      
      const rider = drivers.find(d => d.id === riderId);
      toast.success(
        `Order assigned to ${rider?.name || 'rider'} successfully! Assignment notification sent.`
      );
      
      console.log('✅ Rider assigned with ID:', assignmentId);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign rider to order';
      toast.error(errorMessage);
      console.error('❌ Failed to assign rider:', err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Fetch assignments for an order
  const fetchOrderAssignments = async (orderId: string): Promise<OrderAssignment[]> => {
    try {
      const data = await getOrderAssignments(orderId);
      console.log('✅ Fetched assignments for order:', orderId, data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch order assignments';
      toast.error(errorMessage);
      console.error('❌ Failed to fetch order assignments:', err);
      return [];
    }
  };

  // Fetch assignments for a rider
  const fetchRiderAssignments = async (
    riderId: string, 
    status?: string
  ): Promise<OrderAssignment[]> => {
    try {
      const data = await getRiderAssignments(riderId, status);
      console.log('✅ Fetched assignments for rider:', riderId, data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch rider assignments';
      toast.error(errorMessage);
      console.error('❌ Failed to fetch rider assignments:', err);
      return [];
    }
  };

  // Update assignment status
  const updateAssignment = async (
    assignmentId: string,
    status: 'assigned' | 'accepted' | 'en_route' | 'delivered' | 'cancelled',
    notes?: string
  ): Promise<boolean> => {
    try {
      await updateAssignmentStatus(assignmentId, status, notes);
      
      const statusMessages = {
        assigned: 'Assignment updated',
        accepted: 'Assignment accepted',
        en_route: 'Rider is en route',
        delivered: 'Order delivered successfully',
        cancelled: 'Assignment cancelled'
      };
      
      toast.success(statusMessages[status]);
      console.log('✅ Assignment status updated:', { assignmentId, status });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update assignment';
      toast.error(errorMessage);
      console.error('❌ Failed to update assignment:', err);
      return false;
    }
  };

  // Bulk assign multiple orders to riders
  const bulkAssignOrders = async (
    assignments: Array<{ orderId: string; riderId: string }>
  ): Promise<{ successful: number; failed: number }> => {
    let successful = 0;
    let failed = 0;
    
    setLoading(true);
    
    try {
      for (const assignment of assignments) {
        try {
          await assignRiderToOrder(assignment.orderId, assignment.riderId);
          successful++;
        } catch (err) {
          console.error('❌ Failed to assign order:', assignment.orderId, err);
          failed++;
        }
      }
      
      const message = `Bulk assignment completed: ${successful} successful, ${failed} failed`;
      if (failed === 0) {
        toast.success(message);
      } else {
        toast.warning(message);
      }
      
      console.log('📊 Bulk assignment results:', { successful, failed });
      
    } finally {
      setLoading(false);
    }
    
    return { successful, failed };
  };

  // Get available riders (active and not overloaded)
  const getAvailableRiders = async (): Promise<DispatchDriver[]> => {
    try {
      // For now, return all active riders
      // In future, we can add logic to check current workload
      return drivers.filter(driver => driver.is_active);
    } catch (err) {
      console.error('❌ Failed to get available riders:', err);
      return [];
    }
  };

  // Initialize data on mount
  useEffect(() => {
    fetchDrivers();
  }, []);

  return {
    // State
    drivers,
    assignments,
    loading,
    error,
    
    // Actions
    fetchDrivers,
    createDriver,
    assignRider,
    fetchOrderAssignments,
    fetchRiderAssignments,
    updateAssignment,
    bulkAssignOrders,
    getAvailableRiders,
  };
};