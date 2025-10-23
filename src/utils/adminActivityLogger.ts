import { supabase } from '@/integrations/supabase/client';

export interface AdminActivityContext {
  action: string;
  category: string;
  entityType?: string;
  entityId?: string;
  message?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * PRODUCTION ADMIN ACTIVITY LOGGER
 * Comprehensive logging system for all administrative activities
 * Ensures audit trail compliance and security monitoring
 */
export class AdminActivityLogger {
  
  /**
   * Log admin activity with enhanced security context
   */
  static async logActivity(context: AdminActivityContext): Promise<void> {
    try {
      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('Admin activity logged without authenticated user context');
        return;
      }

      // Get user's profile to verify admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, email')
        .eq('id', user.id)
        .single();

      // Only log activities for admin users
      if (profile?.role !== 'admin') {
        console.warn('Non-admin user attempted to log admin activity');
        return;
      }

      // Enhanced security: Get client information
      const userAgent = context.userAgent || navigator?.userAgent || 'Unknown';
      const timestamp = new Date().toISOString();
      
      // Production logging with comprehensive audit data
      const auditData = {
        user_id: user.id,
        user_name: profile.email || user.email,
        action: context.action,
        category: context.category,
        entity_type: context.entityType,
        entity_id: context.entityId,
        message: context.message || `Admin ${context.action} in ${context.category}`,
        old_values: context.oldValues ? JSON.stringify(context.oldValues) : null,
        new_values: context.newValues ? JSON.stringify(context.newValues) : null,
        ip_address: context.ipAddress,
        user_agent: userAgent.substring(0, 500), // Limit user agent length
        event_time: timestamp
      };

      // Insert audit log
      const { error } = await supabase
        .from('audit_logs')
        .insert(auditData);

      if (error) {
        console.error('Failed to log admin activity:', error);
        
        // Fallback: Log to console in development
        if (process.env.NODE_ENV === 'development') {
          console.info('Admin Activity (Fallback):', {
            ...context,
            userId: user.id,
            userEmail: profile.email,
            timestamp
          });
        }
      }

    } catch (error) {
      console.error('Error in admin activity logger:', error);
    }
  }

  /**
   * Log permission changes with enhanced security context
   */
  static async logPermissionChange(
    targetUserId: string, 
    changedPermissions: Record<string, string>,
    previousPermissions?: Record<string, string>
  ): Promise<void> {
    await this.logActivity({
      action: 'permission_updated',
      category: 'User Management',
      entityType: 'user_permissions',
      entityId: targetUserId,
      message: `Admin updated user permissions for ${targetUserId}`,
      oldValues: previousPermissions,
      newValues: changedPermissions,
      metadata: {
        changedCount: Object.keys(changedPermissions).length,
        securityLevel: 'high'
      }
    });
  }

  /**
   * Log user management activities
   */
  static async logUserManagement(
    action: 'created' | 'activated' | 'deactivated' | 'deleted' | 'updated',
    targetUserId: string,
    changes?: Record<string, any>
  ): Promise<void> {
    await this.logActivity({
      action: `user_${action}`,
      category: 'User Management',
      entityType: 'profiles',
      entityId: targetUserId,
      message: `Admin ${action} user account`,
      newValues: changes,
      metadata: {
        securityLevel: 'critical',
        requiresReview: action === 'created' || action === 'deleted'
      }
    });
  }

  /**
   * Log system configuration changes
   */
  static async logSystemConfig(
    configType: string,
    changes: Record<string, any>,
    previousValues?: Record<string, any>
  ): Promise<void> {
    await this.logActivity({
      action: 'system_config_updated',
      category: 'System Configuration',
      entityType: configType,
      message: `Admin updated ${configType} configuration`,
      oldValues: previousValues,
      newValues: changes,
      metadata: {
        securityLevel: 'high',
        configType
      }
    });
  }

  /**
   * Log security-related admin activities
   */
  static async logSecurityEvent(
    eventType: string,
    details: Record<string, any>,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await this.logActivity({
      action: eventType,
      category: 'Security',
      message: `Security event: ${eventType}`,
      newValues: details,
      metadata: {
        securityLevel: severity,
        timestamp: new Date().toISOString(),
        requiresReview: severity === 'critical'
      }
    });
  }

  /**
   * Log rider assignment/reassignment
   */
  static async logRiderAssignment(
    orderId: string,
    orderNumber: string,
    riderId: string | null,
    riderName: string | null,
    previousRiderId?: string | null,
    previousRiderName?: string | null
  ): Promise<void> {
    const action = !previousRiderId ? 'rider_assigned' : 'rider_reassigned';
    const message = !previousRiderId
      ? `Rider ${riderName} assigned to order #${orderNumber}`
      : `Rider changed from ${previousRiderName} to ${riderName} for order #${orderNumber}`;

    await this.logActivity({
      action,
      category: 'Order Management',
      entityType: 'order_rider',
      entityId: orderId,
      message,
      oldValues: previousRiderId
        ? { rider_id: previousRiderId, rider_name: previousRiderName }
        : undefined,
      newValues: { rider_id: riderId, rider_name: riderName },
      metadata: {
        securityLevel: 'medium',
        orderNumber
      }
    });
  }

  /**
   * Log rider unassignment
   */
  static async logRiderUnassignment(
    orderId: string,
    orderNumber: string,
    previousRiderId: string,
    previousRiderName: string
  ): Promise<void> {
    await this.logActivity({
      action: 'rider_unassigned',
      category: 'Order Management',
      entityType: 'order_rider',
      entityId: orderId,
      message: `Rider ${previousRiderName} unassigned from order #${orderNumber}`,
      oldValues: { rider_id: previousRiderId, rider_name: previousRiderName },
      newValues: null,
      metadata: {
        securityLevel: 'medium',
        orderNumber
      }
    });
  }

  /**
   * Log order updates (general modifications)
   */
  static async logOrderUpdate(
    orderId: string,
    orderNumber: string,
    field: string,
    oldValue: any,
    newValue: any,
    description?: string
  ): Promise<void> {
    await this.logActivity({
      action: 'order_updated',
      category: 'Order Management',
      entityType: 'orders',
      entityId: orderId,
      message: description || `Order #${orderNumber} ${field} updated`,
      oldValues: { [field]: oldValue },
      newValues: { [field]: newValue },
      metadata: {
        securityLevel: 'low',
        orderNumber,
        field
      }
    });
  }

  /**
   * Log payment status changes
   */
  static async logPaymentUpdate(
    orderId: string,
    orderNumber: string,
    oldStatus: string,
    newStatus: string,
    paymentMethod?: string
  ): Promise<void> {
    await this.logActivity({
      action: 'payment_updated',
      category: 'Order Management',
      entityType: 'order_payment',
      entityId: orderId,
      message: `Payment status changed from ${oldStatus} to ${newStatus} for order #${orderNumber}`,
      oldValues: { payment_status: oldStatus },
      newValues: { payment_status: newStatus, payment_method: paymentMethod },
      metadata: {
        securityLevel: 'high',
        orderNumber
      }
    });
  }

  /**
   * Log order cancellations
   */
  static async logOrderCancellation(
    orderId: string,
    orderNumber: string,
    reason: string,
    refundAmount?: number
  ): Promise<void> {
    await this.logActivity({
      action: 'order_cancelled',
      category: 'Order Management',
      entityType: 'orders',
      entityId: orderId,
      message: `Order #${orderNumber} cancelled: ${reason}`,
      oldValues: { status: 'active' },
      newValues: { status: 'cancelled', reason, refund_amount: refundAmount },
      metadata: {
        securityLevel: 'high',
        orderNumber,
        requiresReview: true
      }
    });
  }
}

/**
 * Convenience wrapper for the most common admin activities
 */
export const logAdminActivity = AdminActivityLogger.logActivity;
export const logPermissionChange = AdminActivityLogger.logPermissionChange;
export const logUserManagement = AdminActivityLogger.logUserManagement;
export const logSystemConfig = AdminActivityLogger.logSystemConfig;
export const logSecurityEvent = AdminActivityLogger.logSecurityEvent;
export const logRiderAssignment = AdminActivityLogger.logRiderAssignment;
export const logRiderUnassignment = AdminActivityLogger.logRiderUnassignment;
export const logOrderUpdate = AdminActivityLogger.logOrderUpdate;
export const logPaymentUpdate = AdminActivityLogger.logPaymentUpdate;
export const logOrderCancellation = AdminActivityLogger.logOrderCancellation;