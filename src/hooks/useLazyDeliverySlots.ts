import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

interface DeliveryTimeSlot {
  start_time: string;
  end_time: string;
  available: boolean;
  reason?: string;
}

interface DeliverySlot {
  date: string;
  is_business_day: boolean;
  is_holiday: boolean;
  holiday_name?: string;
  time_slots: DeliveryTimeSlot[];
}

interface LazyDeliverySlots {
  slots: DeliverySlot[];
  loading: boolean;
  error: string | null;
  loadMonth: (date: Date) => void;
  prefetchNextMonth: () => void;
  clearCache: () => void;
}

// Cache for storing loaded months
const monthCache = new Map<string, DeliverySlot[]>();
const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes
const cacheTimestamps = new Map<string, number>();

export const useLazyDeliverySlots = (initialMonth?: Date): LazyDeliverySlots => {
  const [currentMonth, setCurrentMonth] = useState<Date>(initialMonth || new Date());
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set());
  const [allSlots, setAllSlots] = useState<DeliverySlot[]>([]);

  const monthKey = format(currentMonth, 'yyyy-MM');

  // Check if month data is cached and not expired
  const isCached = useCallback((monthKey: string) => {
    const cached = monthCache.has(monthKey);
    const timestamp = cacheTimestamps.get(monthKey);
    if (cached && timestamp && Date.now() - timestamp < CACHE_EXPIRY) {
      return true;
    }
    // Clean expired cache
    if (cached && timestamp && Date.now() - timestamp >= CACHE_EXPIRY) {
      monthCache.delete(monthKey);
      cacheTimestamps.delete(monthKey);
    }
    return false;
  }, []);

  // Optimized query for single month
  const { data: monthSlots, isLoading, error } = useQuery({
    queryKey: ['delivery-slots-lazy', monthKey],
    queryFn: async () => {
      // Check cache first
      if (isCached(monthKey)) {
        console.log(`🚀 Cache hit for month: ${monthKey}`);
        return monthCache.get(monthKey)!;
      }

      console.log(`📅 Fetching delivery slots for month: ${monthKey}`);
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const { deliveryBookingAPI } = await import('@/api/deliveryBookingApi');
      
      const response = await deliveryBookingAPI.getAvailableSlots({
        start_date: deliveryBookingAPI.formatDateForAPI(startDate),
        end_date: deliveryBookingAPI.formatDateForAPI(endDate)
      });

      const slots = response.slots.map(slot => ({
        date: slot.date,
        is_business_day: slot.is_business_day,
        is_holiday: slot.is_holiday,
        holiday_name: slot.holiday_name,
        time_slots: slot.time_slots.map(timeSlot => ({
          start_time: timeSlot.start_time,
          end_time: timeSlot.end_time,
          available: timeSlot.available,
          reason: timeSlot.reason
        }))
      }));

      // Cache the result
      monthCache.set(monthKey, slots);
      cacheTimestamps.set(monthKey, Date.now());
      
      console.log(`✅ Loaded ${slots.length} slots for ${monthKey}`);
      return slots;
    },
    enabled: !loadedMonths.has(monthKey) && !isCached(monthKey),
    staleTime: CACHE_EXPIRY,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  // Update loaded slots when month data is available
  useEffect(() => {
    if (monthSlots && !loadedMonths.has(monthKey)) {
      setLoadedMonths(prev => new Set([...prev, monthKey]));
      setAllSlots(prev => {
        // Remove existing slots for this month and add new ones
        const filtered = prev.filter(slot => !slot.date.startsWith(monthKey));
        return [...filtered, ...monthSlots].sort((a, b) => a.date.localeCompare(b.date));
      });
    }
  }, [monthSlots, monthKey, loadedMonths]);

  // Load cached data immediately if available
  useEffect(() => {
    if (isCached(monthKey) && !loadedMonths.has(monthKey)) {
      const cached = monthCache.get(monthKey)!;
      setLoadedMonths(prev => new Set([...prev, monthKey]));
      setAllSlots(prev => {
        const filtered = prev.filter(slot => !slot.date.startsWith(monthKey));
        return [...filtered, ...cached].sort((a, b) => a.date.localeCompare(b.date));
      });
    }
  }, [monthKey, isCached, loadedMonths]);

  const loadMonth = useCallback((date: Date) => {
    setCurrentMonth(date);
  }, []);

  const prefetchNextMonth = useCallback(() => {
    const nextMonth = addMonths(currentMonth, 1);
    const nextMonthKey = format(nextMonth, 'yyyy-MM');
    
    if (!loadedMonths.has(nextMonthKey) && !isCached(nextMonthKey)) {
      console.log(`🔄 Prefetching next month: ${nextMonthKey}`);
      setCurrentMonth(nextMonth);
    }
  }, [currentMonth, loadedMonths, isCached]);

  const clearCache = useCallback(() => {
    monthCache.clear();
    cacheTimestamps.clear();
    setLoadedMonths(new Set());
    setAllSlots([]);
    console.log('🗑️ Cache cleared');
  }, []);

  return {
    slots: allSlots,
    loading: isLoading,
    error: error?.message || null,
    loadMonth,
    prefetchNextMonth,
    clearCache
  };
};