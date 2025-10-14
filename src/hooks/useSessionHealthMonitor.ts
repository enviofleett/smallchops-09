import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Session Health Monitor
 * Periodically checks session health for admin users and logs any issues
 * This helps detect session problems before they cause abrupt disconnections
 */
export const useSessionHealthMonitor = () => {
  const { isAuthenticated, userType } = useAuth();

  useEffect(() => {
    // Only monitor admin sessions
    if (!isAuthenticated || userType !== 'admin') return;

    const checkSessionHealth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.warn('⚠️ Session health check failed:', error);
          
          // Log to audit for monitoring
          try {
            await supabase.from('audit_logs').insert({
              action: 'session_health_check_failed',
              category: 'Authentication',
              message: error?.message || 'No session found during health check',
              new_values: {
                error_type: error?.name || 'no_session',
                timestamp: new Date().toISOString()
              }
            });
          } catch (logError) {
            console.error('Failed to log session health issue:', logError);
          }
        } else {
          console.log('✅ Session health check passed');
        }
      } catch (error) {
        console.error('❌ Session health check error:', error);
      }
    };

    console.log('🏥 Session health monitoring enabled (checks every 5 minutes)');

    // Check session health every 5 minutes
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);
    
    // Initial check
    checkSessionHealth();

    return () => {
      console.log('🏥 Session health monitoring disabled');
      clearInterval(interval);
    };
  }, [isAuthenticated, userType]);
};
