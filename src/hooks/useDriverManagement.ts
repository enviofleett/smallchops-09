import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getDrivers, createDriver, updateDriver, deleteDriver, type Driver, type NewDriver } from '@/api/drivers';
import { supabase } from '@/integrations/supabase/client';

export const useDriverManagement = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔍 Fetching drivers with admin auth check...');
      
      // Check if user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('Authentication required to access drivers');
      }

      console.log('✅ User authenticated:', user.email);
      
      const data = await getDrivers();
      console.log('✅ Drivers fetched successfully:', data.length, 'drivers found');
      setDrivers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch drivers';
      console.error('❌ Error fetching drivers:', err);
      setError(errorMessage);
      
      // Show different error messages based on the type of error
      if (errorMessage.includes('authentication') || errorMessage.includes('Authentication')) {
        toast.error('Please login as an admin to manage drivers');
      } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast.error('Admin access required to manage drivers');
      } else {
        toast.error(`Failed to load drivers: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const addDriver = async (driverData: NewDriver): Promise<Driver | null> => {
    try {
      console.log('🔄 Adding new driver:', driverData);
      
      // Validate required fields
      if (!driverData.name?.trim()) {
        throw new Error('Driver name is required');
      }
      if (!driverData.phone?.trim()) {
        throw new Error('Driver phone number is required');
      }

      // Ensure is_active is set to true by default for new drivers
      const driverWithDefaults: NewDriver = {
        ...driverData,
        is_active: driverData.is_active ?? true,
      };

      const newDriver = await createDriver(driverWithDefaults);
      setDrivers(prev => [...prev, newDriver]);
      toast.success(`Driver "${newDriver.name}" added successfully`);
      console.log('✅ Driver added successfully:', newDriver);
      return newDriver;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add driver';
      console.error('❌ Error adding driver:', err);
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast.error('Admin access required to add drivers');
      } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
        toast.error('A driver with this information already exists');
      } else {
        toast.error(`Failed to add driver: ${errorMessage}`);
      }
      return null;
    }
  };

  const updateDriverData = async (id: string, updates: Partial<Driver>): Promise<Driver | null> => {
    try {
      console.log('🔄 Updating driver:', id, updates);
      
      // Find the driver being updated for better error messages
      const currentDriver = drivers.find(d => d.id === id);
      const driverName = currentDriver?.name || 'Driver';

      const updatedDriver = await updateDriver(id, updates);
      setDrivers(prev => prev.map(driver => 
        driver.id === id ? updatedDriver : driver
      ));
      toast.success(`${driverName} updated successfully`);
      console.log('✅ Driver updated successfully:', updatedDriver);
      return updatedDriver;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update driver';
      console.error('❌ Error updating driver:', err);
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast.error('Admin access required to update drivers');
      } else if (errorMessage.includes('not found')) {
        toast.error('Driver not found');
      } else {
        toast.error(`Failed to update driver: ${errorMessage}`);
      }
      return null;
    }
  };

  const removeDriver = async (id: string): Promise<boolean> => {
    try {
      console.log('🔄 Removing driver:', id);
      
      // Find the driver being removed for better error messages
      const currentDriver = drivers.find(d => d.id === id);
      const driverName = currentDriver?.name || 'Driver';

      await deleteDriver(id);
      setDrivers(prev => prev.filter(driver => driver.id !== id));
      toast.success(`${driverName} removed successfully`);
      console.log('✅ Driver removed successfully:', id);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove driver';
      console.error('❌ Error removing driver:', err);
      
      if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
        toast.error('Admin access required to remove drivers');
      } else if (errorMessage.includes('not found')) {
        toast.error('Driver not found');
      } else if (errorMessage.includes('constraint') || errorMessage.includes('referenced')) {
        toast.error('Cannot remove driver: This driver has active orders');
      } else {
        toast.error(`Failed to remove driver: ${errorMessage}`);
      }
      return false;
    }
  };

  const toggleDriverStatus = async (id: string): Promise<boolean> => {
    const driver = drivers.find(d => d.id === id);
    if (!driver) {
      toast.error('Driver not found');
      return false;
    }

    console.log('🔄 Toggling driver status:', id, 'current status:', driver.is_active);
    const newStatus = !driver.is_active;
    const result = await updateDriverData(id, { is_active: newStatus });
    
    if (result) {
      console.log('✅ Driver status toggled successfully:', newStatus);
    }
    
    return result !== null;
  };

  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  return {
    drivers,
    loading,
    error,
    fetchDrivers,
    addDriver,
    updateDriverData,
    removeDriver,
    toggleDriverStatus
  };
};