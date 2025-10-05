import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logPermissionChange, logSecurityEvent } from '@/utils/adminActivityLogger';
import { PermissionMatrixHealthMonitor } from "@/components/admin/PermissionMatrixHealthMonitor";
import { 
  ChevronDown, 
  ChevronRight, 
  Save, 
  AlertCircle, 
  Settings, 
  CreditCard, 
  BarChart3, 
  Truck, 
  Users, 
  Package, 
  ShoppingCart, 
  Home,
  Shield,
  RefreshCw
} from "lucide-react";

interface AdminUser {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface MenuStructure {
  id: string;
  key: string;
  label: string;
  parent_key: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  permission_levels: any;
  children?: MenuStructure[];
}

interface UserPermission {
  id: string;
  user_id: string;
  menu_key: string;
  permission_level: string;
}

interface EnhancedUserPermissionsMatrixProps {
  selectedUser?: AdminUser | null;
}

const permissionLevels = [
  { value: 'none', label: 'No Access', color: 'destructive' },
  { value: 'view', label: 'View Only', color: 'secondary' },
  { value: 'edit', label: 'Full Access', color: 'default' },
];

// PRODUCTION SECURITY: Validate permission assignments before saving
const validatePermissionsForProduction = (permissions: Record<string, string>, isAdminUser: boolean) => {
  const criticalMenus = [
    'settings_admin_users',
    'settings_admin_permissions', 
    'settings_payments_providers',
    'settings_developer_auth',
    'settings_developer_payments_webhooks'
  ];
  
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // STRICT ADMIN MODE: Admin users must have 'edit' for all menu access
  if (isAdminUser) {
    Object.entries(permissions).forEach(([menuKey, level]) => {
      if (level === 'view') {
        warnings.push(`${menuKey}: Admin users need 'Full Access' not 'View Only' for menu access`);
      }
      if (level === 'none') {
        warnings.push(`${menuKey}: Admin user will lose access to this menu with 'No Access'`);
      }
    });
    
    // Critical: Ensure admin retains user management access
    if (permissions['settings_admin_users'] !== 'edit') {
      errors.push('Admin users must maintain Full Access to User Management to prevent lockout');
    }
  } else {
    // Check for critical menus with insufficient permissions for regular users
    criticalMenus.forEach(menuKey => {
      const level = permissions[menuKey];
      if (level === 'view') {
        warnings.push(`${menuKey}: View-only access to critical system area`);
      }
      if (level === 'none') {
        warnings.push(`${menuKey}: No access to critical system area`);
      }
    });
  }
  
  return { warnings, errors, isValid: errors.length === 0 };
};

const getMenuIcon = (menuKey: string) => {
  switch (menuKey) {
    case 'dashboard': return <Home className="h-4 w-4" />;
    case 'products': return <Package className="h-4 w-4" />;
    case 'orders': return <ShoppingCart className="h-4 w-4" />;
    case 'customers': return <Users className="h-4 w-4" />;
    case 'delivery': return <Truck className="h-4 w-4" />;
    case 'payment': return <CreditCard className="h-4 w-4" />;
    case 'reports': return <BarChart3 className="h-4 w-4" />;
    case 'settings': return <Settings className="h-4 w-4" />;
    
    // Settings sub-tabs
    case 'settings_communications': return <Settings className="h-4 w-4" />;
    case 'settings_communications_branding': return <RefreshCw className="h-4 w-4" />;
    case 'settings_communications_content': return <Package className="h-4 w-4" />;
    case 'settings_communications_support': return <Users className="h-4 w-4" />;
    case 'settings_communications_email_processing': return <Settings className="h-4 w-4" />;
    
    case 'settings_payments': return <CreditCard className="h-4 w-4" />;
    case 'settings_payments_providers': return <CreditCard className="h-4 w-4" />;
    case 'settings_payments_pickup_points': return <Truck className="h-4 w-4" />;
    
    case 'settings_admin': return <Shield className="h-4 w-4" />;
    case 'settings_admin_users': return <Users className="h-4 w-4" />;
    case 'settings_admin_permissions': return <Shield className="h-4 w-4" />;
    
    case 'settings_developer': return <Settings className="h-4 w-4" />;
    case 'settings_developer_auth': return <Shield className="h-4 w-4" />;
    case 'settings_developer_buying_logic': return <ShoppingCart className="h-4 w-4" />;
    case 'settings_developer_checkout': return <CreditCard className="h-4 w-4" />;
    case 'settings_developer_payments_webhooks': return <CreditCard className="h-4 w-4" />;
    case 'settings_developer_email': return <Settings className="h-4 w-4" />;
    case 'settings_developer_email_credentials': return <Shield className="h-4 w-4" />;
    case 'settings_developer_email_communications': return <Settings className="h-4 w-4" />;
    case 'settings_developer_email_processing': return <RefreshCw className="h-4 w-4" />;
    case 'settings_developer_email_monitoring': return <BarChart3 className="h-4 w-4" />;
    case 'settings_developer_email_analytics': return <BarChart3 className="h-4 w-4" />;
    case 'settings_developer_oauth': return <Shield className="h-4 w-4" />;
    case 'settings_developer_registration_health': return <BarChart3 className="h-4 w-4" />;
    case 'settings_developer_production_readiness': return <Shield className="h-4 w-4" />;
    case 'settings_developer_performance': return <BarChart3 className="h-4 w-4" />;
    
    default: return <Shield className="h-4 w-4" />;
  }
};

export const EnhancedUserPermissionsMatrix = ({ selectedUser }: EnhancedUserPermissionsMatrixProps) => {
  const [permissions, setPermissions] = useState<Record<string, string>>({});
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(selectedUser || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch admin users with error handling using secure RPC
  const { data: adminUsers, isLoading: loadingUsers, error: usersError } = useQuery({
    queryKey: ['admin-users-secure'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_admin_users_secure');
        
        if (error) {
          console.error('Error fetching admin users:', error);
          throw error;
        }
        
        return data as AdminUser[];
      } catch (error) {
        console.error('Failed to fetch admin users:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000
  });

  // Fetch comprehensive menu structure using secure RPC
  const { data: menuStructure, isLoading: loadingMenus, error: menusError } = useQuery({
    queryKey: ['enhanced-menu-structure-secure'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.rpc('get_menu_structure_secure');

        if (error) {
          console.error('Error fetching menu structure:', error);
          throw error;
        }

        console.log('Fetched menu structure:', data);

        // Organize into hierarchical structure
        const menus: MenuStructure[] = [];
        const menuMap = new Map<string, MenuStructure>();

        data.forEach(menu => {
          const menuItem: MenuStructure = {
            ...menu,
            children: []
          };
          menuMap.set(menu.key, menuItem);
        });

        data.forEach(menu => {
          if (menu.parent_key) {
            const parent = menuMap.get(menu.parent_key);
            if (parent) {
              parent.children!.push(menuMap.get(menu.key)!);
            }
          } else {
            menus.push(menuMap.get(menu.key)!);
          }
        });

        return menus;
      } catch (error) {
        console.error('Failed to fetch menu structure:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000
  });

  // Fetch user permissions using secure RPC
  const { data: userPermissions, isLoading: loadingPermissions, error: permissionsError, refetch: refetchPermissions } = useQuery({
    queryKey: ['enhanced-user-permissions-secure', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];

      try {
        const { data, error } = await supabase.rpc('get_user_permissions_secure', {
          target_user_id: currentUser.id
        });

        if (error) {
          console.error('Error fetching user permissions:', error);
          throw new Error(`Permission fetch failed: ${error.message}`);
        }
        
        console.log('Fetched user permissions for user:', currentUser.id, data);
        return data as UserPermission[];
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
        throw error;
      }
    },
    enabled: !!currentUser?.id,
    retry: (failureCount, error) => {
      // Don't retry on permission errors
      if (error?.message?.includes('Permission') || error?.message?.includes('Access denied')) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Update local permissions state when data loads
  useEffect(() => {
    if (userPermissions && menuStructure) {
      const permissionMap: Record<string, string> = {};
      
      // Collect all menu keys (including sub-menus)
      const getAllMenuKeys = (menus: MenuStructure[]): string[] => {
        let keys: string[] = [];
        menus.forEach(menu => {
          keys.push(menu.key);
          if (menu.children) {
            keys = keys.concat(getAllMenuKeys(menu.children));
          }
        });
        return keys;
      };

      const allKeys = getAllMenuKeys(menuStructure);
      
      // Initialize all keys with 'none'
      allKeys.forEach(key => {
        permissionMap[key] = 'none';
      });
      
      // Update with actual permissions
      userPermissions.forEach(permission => {
        if (permission.menu_key) {
          permissionMap[permission.menu_key] = permission.permission_level;
        }
      });
      
      setPermissions(permissionMap);
      
      // Auto-expand settings and payment sections to show new permissions
      const sectionsToExpand = ['settings', 'payment'];
      if (allKeys.some(key => sectionsToExpand.some(section => key.startsWith(section)))) {
        setExpandedMenus(prev => {
          const newSet = new Set([...prev]);
          sectionsToExpand.forEach(section => newSet.add(section));
          return newSet;
        });
      }
    }
  }, [userPermissions, menuStructure]);

  const handlePermissionChange = (menuKey: string, level: string) => {
    setPermissions(prev => ({
      ...prev,
      [menuKey]: level
    }));
  };

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedMenus(newExpanded);
  };

  const handleSavePermissions = async () => {
    if (!currentUser?.id) {
      toast({
        title: "No user selected",
        description: "Please select a user to update permissions.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Validate permissions data
      const validPermissions = Object.entries(permissions).filter(([key, value]) => 
        key && value && ['none', 'view', 'edit'].includes(value)
      );

      if (validPermissions.length === 0) {
        toast({
          title: "No permissions to update",
          description: "Please configure at least one permission.",
          variant: "destructive"
        });
        return;
      }

      // PRODUCTION VALIDATION: Skip validation for super_admin, apply strict checks for admin/manager
      const isAdminUser = currentUser.role === 'admin' || currentUser.role === 'manager';
      let validation = { isValid: true, warnings: [] as string[], errors: [] as string[] };
      
      if (currentUser.role !== 'super_admin') {
        validation = validatePermissionsForProduction(permissions, isAdminUser);
        
        if (!validation.isValid) {
          toast({
            title: "Permission validation failed",
            description: validation.errors.join('. '),
            variant: "destructive"
          });
          return;
        }
        
        // Show warnings for admin permission assignments
        if (validation.warnings.length > 0) {
          console.warn('Permission warnings:', validation.warnings);
          // Could add a confirmation dialog here for warnings
        }
      } else {
        console.log('🔐 SUPER ADMIN: Bypassing permission validation for', currentUser.id);
      }

      // Check rate limit first (skip if function not available)
      try {
        const { data: rateLimitCheck, error: rateLimitError } = await supabase.rpc('check_permission_change_rate_limit', {
          target_user_id: currentUser.id
        });

        if (rateLimitCheck && !rateLimitError) {
          // Handle different return types from the rate limit function
          let isAllowed = true;
          if (typeof rateLimitCheck === 'boolean') {
            isAllowed = rateLimitCheck;
          } else if (typeof rateLimitCheck === 'object' && 'allowed' in rateLimitCheck) {
            isAllowed = (rateLimitCheck as any).allowed;
          }
          
          if (!isAllowed) {
            toast({
              title: "Rate limit exceeded",
              description: `Too many permission changes. Please wait before trying again.`,
              variant: "destructive"
            });
            return;
          }
        }
      } catch (rateLimitError) {
        // Rate limiting not available, proceed without it
        console.warn('Rate limiting not available:', rateLimitError);
      }

      // PRODUCTION ADMIN ACTIVITY LOGGING: Track all permission changes
      try {
        // Log the permission change with comprehensive audit trail
        const previousPermissions = userPermissions?.reduce((acc, perm) => {
          acc[perm.menu_key] = perm.permission_level;
          return acc;
        }, {} as Record<string, string>) || {};

        await logPermissionChange(
          currentUser.id,
          Object.fromEntries(validPermissions),
          previousPermissions
        );

        // Log security event for admin permission changes
        if (currentUser.role === 'admin') {
          await logSecurityEvent(
            'admin_permission_modified',
            {
              target_user_id: currentUser.id,
              target_user_name: currentUser.name,
              changes_count: validPermissions.length,
              validation_warnings: validation.warnings,
              admin_user: isAdminUser
            },
            'high'
          );
        }
      } catch (loggingError) {
        console.warn('Admin activity logging failed (non-blocking):', loggingError);
      }

      // Use secure RPC function for permission updates
      const { data: result, error: updateError } = await supabase.rpc('update_user_permissions_secure', {
        target_user_id: currentUser.id,
        permissions_data: Object.fromEntries(validPermissions)
      });

      if (updateError) {
        console.error('Permission update error:', updateError);
        throw new Error(updateError.message || 'Failed to update permissions');
      }

      // Record the rate limit usage (non-blocking)
      try {
        await supabase.rpc('record_permission_change_rate_limit', {
          target_user_id: currentUser.id,
          changes_count: (result && typeof result === 'object' && 'changes_count' in result) ? 
            Number(result.changes_count) || validPermissions.length : validPermissions.length
        });
      } catch (rateLimitLogError) {
        console.warn('Could not log rate limit usage:', rateLimitLogError);
      }

      toast({
        title: "Permissions updated successfully", 
        description: `${(result && typeof result === 'object' && 'changes_count' in result) ? (result as any).changes_count : validPermissions.length} permissions updated for ${currentUser.name}`,
      });

      // Refresh permissions data
      await refetchPermissions();
      queryClient.invalidateQueries({ queryKey: ['enhanced-user-permissions-secure'] });
      setRetryCount(0);

    } catch (error: any) {
      console.error('Error updating permissions:', error);
      
      // Implement retry logic for network errors only
      if (retryCount < 2 && 
          (error.message?.includes('network') || 
           error.message?.includes('fetch') || 
           error.message?.includes('timeout'))) {
        setRetryCount(prev => prev + 1);
        setTimeout(() => handleSavePermissions(), Math.min(2000 * (retryCount + 1), 10000));
        toast({
          title: "Connection issue, retrying...",
          description: `Attempt ${retryCount + 1}/3 - Network error detected`,
          variant: "destructive"
        });
        return;
      }

      // Handle specific error types
      const errorMessage = error.message?.includes('Permission denied') 
        ? "You don't have permission to perform this action."
        : error.message?.includes('User not found')
        ? "The selected user could not be found."
        : error.message || "An unexpected error occurred while updating permissions.";

      toast({
        title: "Failed to update permissions",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMenuPermissions = (menus: MenuStructure[], level = 0) => {
    return menus.map((menu) => (
      <div key={menu.key} className="space-y-2">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center space-x-3">
            {menu.children && menu.children.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleExpanded(menu.key)}
                className="h-6 w-6 p-0"
              >
                {expandedMenus.has(menu.key) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {getMenuIcon(menu.key)}
            <span className="font-medium">{menu.label}</span>
            {menu.key.startsWith('payment') && (
              <Badge variant="outline" className="text-xs">
                Payment Feature
              </Badge>
            )}
            {menu.key.startsWith('settings_developer') && (
              <Badge variant="destructive" className="text-xs">
                Developer Only
              </Badge>
            )}
            {menu.key.startsWith('settings_admin') && (
              <Badge variant="secondary" className="text-xs">
                Admin Only
              </Badge>
            )}
          </div>
          
          <Select
            value={permissions[menu.key] || 'none'}
            onValueChange={(value) => handlePermissionChange(menu.key, value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {permissionLevels.map((level) => (
                <SelectItem key={level.value} value={level.value}>
                  <Badge variant={level.color as any} className="text-xs">
                    {level.label}
                  </Badge>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {menu.children && menu.children.length > 0 && (
          <Collapsible open={expandedMenus.has(menu.key)}>
            <CollapsibleContent className="ml-6 space-y-2 border-l-2 border-border pl-4">
              {renderMenuPermissions(menu.children, level + 1)}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    ));
  };

  // Error boundary component
  if (usersError || menusError || permissionsError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Error Loading Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {usersError?.message || menusError?.message || permissionsError?.message || 'Failed to load permission data'}
            </AlertDescription>
          </Alert>
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['admin-users-secure'] });
              queryClient.invalidateQueries({ queryKey: ['enhanced-menu-structure-secure'] });
              queryClient.invalidateQueries({ queryKey: ['enhanced-user-permissions-secure'] });
            }}
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Loading state
  if (loadingUsers || loadingMenus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Permissions Matrix</CardTitle>
          <CardDescription>Loading permission settings...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // No users found
  if (!adminUsers || adminUsers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User Permissions Matrix</CardTitle>
          <CardDescription>No admin users found</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No admin or manager users found in the system.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Monitor */}
      <PermissionMatrixHealthMonitor />
      
      {/* Main Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            User Permissions Matrix
          </CardTitle>
          <CardDescription>
            Comprehensive access control for all application features including settings, payments, and developer tools. 
            Configure granular permissions for each admin user across all system areas.
          </CardDescription>
        </CardHeader>
      <CardContent className="space-y-6">
        {!selectedUser && (
          <div>
            <label className="text-sm font-medium mb-2 block">Select User</label>
            <Select
              value={currentUser?.id || ''}
              onValueChange={(value) => {
                const user = adminUsers.find(u => u.id === value);
                setCurrentUser(user || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a user to manage permissions" />
              </SelectTrigger>
              <SelectContent>
                {adminUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.role}</Badge>
                      <span>{user.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {currentUser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Permissions for {currentUser.name}
                </h3>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>Role:</span>
                  <Badge>{currentUser.role}</Badge>
                </div>
              </div>
              <Button 
                onClick={handleSavePermissions} 
                disabled={isSubmitting || loadingPermissions}
                className="min-w-32"
              >
                {isSubmitting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>

            {loadingPermissions ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {menuStructure && renderMenuPermissions(menuStructure)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
};