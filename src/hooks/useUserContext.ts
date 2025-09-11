import { useAuth } from '@/contexts/AuthContext';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

export type UserContextType = 'admin' | 'customer' | 'guest';

export const useUserContext = (): UserContextType => {
  const { user: adminUser } = useAuth();
  const { isAuthenticated: isCustomerAuth } = useCustomerAuth();

  if (adminUser) {
    return 'admin';
  }
  
  if (isCustomerAuth) {
    return 'customer';
  }
  
  return 'guest';
};