import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getDrivers, createDriver, updateDriver, deleteDriver, type Driver, type NewDriver } from '@/api/drivers';

export const useDriverManagement = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDrivers();
      setDrivers(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch drivers';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const addDriver = async (driverData: NewDriver): Promise<Driver | null> => {
    try {
      const newDriver = await createDriver(driverData);
      setDrivers(prev => [...prev, newDriver]);
      toast.success('Driver added successfully');
      return newDriver;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add driver';
      toast.error(errorMessage);
      return null;
    }
  };

  const updateDriverData = async (id: string, updates: Partial<Driver>): Promise<Driver | null> => {
    try {
      const updatedDriver = await updateDriver(id, updates);
      setDrivers(prev => prev.map(driver => 
        driver.id === id ? updatedDriver : driver
      ));
      toast.success('Driver updated successfully');
      return updatedDriver;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update driver';
      toast.error(errorMessage);
      return null;
    }
  };

  const removeDriver = async (id: string): Promise<boolean> => {
    try {
      await deleteDriver(id);
      setDrivers(prev => prev.filter(driver => driver.id !== id));
      toast.success('Driver removed successfully');
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove driver';
      toast.error(errorMessage);
      return false;
    }
  };

  const toggleDriverStatus = async (id: string): Promise<boolean> => {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return false;

    return await updateDriverData(id, { is_active: !driver.is_active }) !== null;
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