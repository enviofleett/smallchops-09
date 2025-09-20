// Enhanced Monitoring System Exports
export { default as ConflictResolutionDashboard } from './ConflictResolutionDashboard';
export { AlertDashboard } from './AlertDashboard';
export { PerformanceMonitor } from './PerformanceMonitor';

// Re-export monitoring hooks
export { useRealTimeMonitoring } from '@/hooks/useRealTimeMonitoring';
export { useAlertSystem } from '@/hooks/useAlertSystem';
export type { 
  CacheHealthMetrics, 
  LockContentionMetrics, 
  PerformanceMetrics,
  ConflictResolutionMetrics,
  AlertRule 
} from '@/hooks/useRealTimeMonitoring';

// Re-export monitoring utilities
export * from '@/utils/orderStatusMonitoring';

// Re-export alert system utilities
export * from '@/utils/alertSystem';
export * from '@/utils/circuitBreaker';