import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

type LogLevelKey = 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

export const useProductionLogging = () => {
  const logToProduction = useCallback(async (
    level: LogLevelKey,
    message: string,
    context?: Record<string, any>
  ) => {
    try {
      // In development, use console
      if (process.env.NODE_ENV === 'development') {
        console[LOG_LEVELS[level]](message, context);
        return;
      }

      // In production, log to audit_logs table
      await supabase.from('audit_logs').insert({
        action: `admin_${level.toLowerCase()}`,
        category: 'Admin Panel',
        message,
        new_values: context ? { context, timestamp: new Date().toISOString() } : null
      });
    } catch (error) {
      // Fallback to console if logging fails
      console.error('Failed to log to production:', error);
      console[LOG_LEVELS[level]](message, context);
    }
  }, []);

  return {
    logError: (message: string, context?: Record<string, any>) => 
      logToProduction('ERROR', message, context),
    logWarn: (message: string, context?: Record<string, any>) => 
      logToProduction('WARN', message, context),
    logInfo: (message: string, context?: Record<string, any>) => 
      logToProduction('INFO', message, context),
    logDebug: (message: string, context?: Record<string, any>) => 
      logToProduction('DEBUG', message, context)
  };
};