/**
 * Authentication Test Utility
 * 
 * This utility provides functions to test the authentication system
 * and verify that toolbuxdev@gmail.com has proper admin privileges.
 */

import { supabase } from '@/integrations/supabase/client';

export interface AuthTestResult {
  test: string;
  passed: boolean;
  message: string;
  details?: any;
}

export class AuthTestUtility {
  /**
   * Test if toolbuxdev@gmail.com profile exists with admin role
   */
  static async testToolbuxAdminProfile(): Promise<AuthTestResult> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, is_active, name')
        .eq('email', 'toolbuxdev@gmail.com')
        .maybeSingle();

      if (error) {
        return {
          test: 'ToolBux Admin Profile',
          passed: false,
          message: `Database error: ${error.message}`,
          details: error
        };
      }

      if (!data) {
        return {
          test: 'ToolBux Admin Profile',
          passed: false,
          message: 'toolbuxdev@gmail.com profile not found in database'
        };
      }

      const isValid = data.role === 'admin' && data.is_active === true;

      return {
        test: 'ToolBux Admin Profile',
        passed: isValid,
        message: isValid 
          ? 'toolbuxdev@gmail.com has valid admin profile'
          : `Profile issues: role=${data.role}, active=${data.is_active}`,
        details: data
      };
    } catch (error) {
      return {
        test: 'ToolBux Admin Profile',
        passed: false,
        message: `Test failed with error: ${error}`,
        details: error
      };
    }
  }

  /**
   * Test if toolbuxdev@gmail.com has admin permissions
   */
  static async testToolbuxAdminPermissions(): Promise<AuthTestResult> {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', 'toolbuxdev@gmail.com')
        .maybeSingle();

      if (!profile) {
        return {
          test: 'ToolBux Admin Permissions',
          passed: false,
          message: 'Profile not found, cannot test permissions'
        };
      }

      const { data: permissions, error } = await supabase
        .from('user_permissions')
        .select('menu_key, permission_level')
        .eq('user_id', profile.id);

      if (error) {
        return {
          test: 'ToolBux Admin Permissions',
          passed: false,
          message: `Permissions query error: ${error.message}`,
          details: error
        };
      }

      const adminPermissions = permissions?.filter(p => p.permission_level === 'edit') || [];
      const hasAdminUserPermission = adminPermissions.some(p => p.menu_key === 'settings_admin_users');

      return {
        test: 'ToolBux Admin Permissions',
        passed: hasAdminUserPermission && adminPermissions.length > 5,
        message: `Found ${adminPermissions.length} edit permissions, admin_users permission: ${hasAdminUserPermission}`,
        details: { 
          total_permissions: permissions?.length || 0,
          edit_permissions: adminPermissions.length,
          has_admin_users: hasAdminUserPermission,
          sample_permissions: adminPermissions.slice(0, 5)
        }
      };
    } catch (error) {
      return {
        test: 'ToolBux Admin Permissions',
        passed: false,
        message: `Test failed with error: ${error}`,
        details: error
      };
    }
  }

  /**
   * Test order fulfillment data retrieval
   */
  static async testOrderFulfillmentData(orderId?: string): Promise<AuthTestResult> {
    try {
      // Get a sample order ID if none provided
      if (!orderId) {
        const { data: orders, error: orderError } = await supabase
          .from('orders')
          .select('id')
          .limit(1);

        if (orderError || !orders || orders.length === 0) {
          return {
            test: 'Order Fulfillment Data',
            passed: false,
            message: 'No orders found to test fulfillment data retrieval'
          };
        }

        orderId = orders[0].id;
      }

      // Test the comprehensive order fulfillment function
      const { data, error } = await supabase
        .rpc('get_comprehensive_order_fulfillment', { p_order_id: orderId });

      if (error) {
        return {
          test: 'Order Fulfillment Data',
          passed: false,
          message: `RPC function error: ${error.message}`,
          details: error
        };
      }

      const hasOrderData = data && typeof data === 'object';
      const parsedData = data as any;
      const hasItems = parsedData?.items && Array.isArray(parsedData.items);
      const hasOrderInfo = parsedData?.order && typeof parsedData.order === 'object';

      return {
        test: 'Order Fulfillment Data',
        passed: hasOrderData && hasItems && hasOrderInfo,
        message: `Order data retrieved successfully. Has order: ${hasOrderInfo}, Has items: ${hasItems}`,
        details: {
          order_id: orderId,
          has_order: hasOrderInfo,
          has_items: hasItems,
          items_count: hasItems ? (data as any).items.length : 0,
          has_fulfillment_info: !!(data as any)?.fulfillment_info
        }
      };
    } catch (error) {
      return {
        test: 'Order Fulfillment Data',
        passed: false,
        message: `Test failed with error: ${error}`,
        details: error
      };
    }
  }

  /**
   * Run all authentication tests
   */
  static async runAllTests(): Promise<AuthTestResult[]> {
    console.log('🔍 Running authentication system tests...');
    
    const results = await Promise.all([
      this.testToolbuxAdminProfile(),
      this.testToolbuxAdminPermissions(),
      this.testOrderFulfillmentData()
    ]);

    console.log('📊 Test Results:');
    results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.message}`);
      if (result.details) {
        console.log('   Details:', result.details);
      }
    });

    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    console.log(`\n📈 Summary: ${passedTests}/${totalTests} tests passed`);

    return results;
  }
}

// Export convenience function for quick testing
export const runAuthTests = () => AuthTestUtility.runAllTests();