import { useState, useCallback } from 'react';
import { OrderModalState, Order } from '@/types/orderDetailsModal';

interface UseOrderModalStateReturn extends OrderModalState {
  setOrder: (order: Order | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setUpdatingStatus: (updating: boolean) => void;
  setPrinting: (printing: boolean) => void;
  reset: () => void;
}

const initialState: OrderModalState = {
  isLoading: false,
  error: null,
  order: null,
  isUpdatingStatus: false,
  isPrinting: false,
};

export const useOrderModalState = (): UseOrderModalStateReturn => {
  const [state, setState] = useState<OrderModalState>(initialState);

  const setOrder = useCallback((order: Order | null) => {
    setState(prev => ({ ...prev, order }));
  }, []);

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  const setUpdatingStatus = useCallback((isUpdatingStatus: boolean) => {
    setState(prev => ({ ...prev, isUpdatingStatus }));
  }, []);

  const setPrinting = useCallback((isPrinting: boolean) => {
    setState(prev => ({ ...prev, isPrinting }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    setOrder,
    setLoading,
    setError,
    setUpdatingStatus,
    setPrinting,
    reset,
  };
};