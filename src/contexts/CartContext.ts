import { createContext } from 'react';
import type { useCartInternal } from '@/hooks/useCart';

export type UseCartReturn = ReturnType<typeof useCartInternal>;

export const CartContext = createContext<UseCartReturn | undefined>(undefined);
