import React from 'react';
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, User, Settings, BarChart3, Package } from 'lucide-react';

/**
 * Test component to demonstrate role-based access control
 * This shows what menus/features each role can access
 */
export const RoleTestComponent = () => {
  const { user } = useAuth();
  const { userRole, hasPermission, canAssignRoles, getAccessibleMenus } = useRoleBasedPermissions();

  const testMenus = [
    { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'categories', label: 'Categories', icon: Package },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'customers', label: 'Customers', icon: User },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'settingsAdmin', label: 'Admin Settings', icon: Settings },
  ];

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800';
      case 'manager': return 'bg-blue-100 text-blue-800';
      case 'support_officer': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Role-Based Access Control Test</CardTitle>
          <CardDescription>Please log in to test role permissions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role-Based Access Control Test</CardTitle>
          <CardDescription>
            Testing the new role-based permission system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Current User:</p>
              <div className="flex items-center gap-2">
                <span>{user.email}</span>
                <Badge className={getRoleBadgeColor(userRole)}>
                  {userRole || 'No Role'}
                </Badge>
                {user.email === 'toolbuxdev@gmail.com' && (
                  <Badge variant="outline">Guaranteed Admin</Badge>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Special Permissions:</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {canAssignRoles ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Can Assign Roles</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Menu Access Permissions:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {testMenus.map((menu) => {
                  const hasViewAccess = hasPermission(menu.key, 'view');
                  const hasEditAccess = hasPermission(menu.key, 'edit');
                  
                  return (
                    <div
                      key={menu.key}
                      className={`p-3 rounded-lg border ${
                        hasViewAccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <menu.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{menu.label}</span>
                      </div>
                      <div className="flex gap-1">
                        <Badge
                          variant={hasViewAccess ? 'default' : 'secondary'}
                          className={`text-xs ${
                            hasViewAccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          View: {hasViewAccess ? 'Yes' : 'No'}
                        </Badge>
                        <Badge
                          variant={hasEditAccess ? 'default' : 'secondary'}
                          className={`text-xs ${
                            hasEditAccess ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          Edit: {hasEditAccess ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Accessible Menus List:</p>
              <div className="flex flex-wrap gap-1">
                {getAccessibleMenus().map((menuKey) => (
                  <Badge key={menuKey} variant="outline">
                    {menuKey}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Requirements Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <Badge className="bg-red-100 text-red-800 mb-2">Super Admin</Badge>
              <p className="text-sm text-gray-600">
                Full access to all menus and features. Can create/manage users and assign roles.
              </p>
            </div>
            <div>
              <Badge className="bg-blue-100 text-blue-800 mb-2">Manager</Badge>
              <p className="text-sm text-gray-600">
                Access to all pages except settings. Cannot create users or access admin settings.
              </p>
            </div>
            <div>
              <Badge className="bg-green-100 text-green-800 mb-2">Support Officer</Badge>
              <p className="text-sm text-gray-600">
                Limited access to dashboard and order management only. View-only access to customer info.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};