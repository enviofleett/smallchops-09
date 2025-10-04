import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Check, X, Eye } from 'lucide-react';
import { ROLE_PERMISSIONS, UserRole } from '@/hooks/useRoleBasedPermissions';
import { MENU_PERMISSION_KEYS } from '@/hooks/usePermissionGuard';

const menuLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  orders: 'Orders',
  categories: 'Categories',
  products: 'Products',
  customers: 'Customers',
  bookings: 'Catering Bookings',
  delivery: 'Delivery Management',
  promotions: 'Promotions',
  reports: 'Reports',
  auditLogs: 'Audit Logs',
  settings: 'Settings',
  settingsAdmin: 'Admin Users',
  settingsPermissions: 'Permissions',
  settingsPayments: 'Payment Settings',
  settingsCommunications: 'Communications',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  admin: 'bg-blue-500',
  manager: 'bg-green-500',
  support_officer: 'bg-yellow-500',
  staff: 'bg-gray-500',
};

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  support_officer: 'Support Officer',
  staff: 'Staff',
};

export function RolePermissionMatrix() {
  const menuKeys = Object.keys(menuLabels);

  const getPermissionIcon = (permission: 'none' | 'view' | 'edit') => {
    switch (permission) {
      case 'edit':
        return <Check className="h-4 w-4 text-green-600" />;
      case 'view':
        return <Eye className="h-4 w-4 text-blue-600" />;
      case 'none':
        return <X className="h-4 w-4 text-red-600" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {ROLE_PERMISSIONS.map(({ role }) => (
          <Badge key={role} className={roleColors[role]}>
            {roleLabels[role]}
          </Badge>
        ))}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] font-semibold">Menu / Feature</TableHead>
              {ROLE_PERMISSIONS.map(({ role }) => (
                <TableHead key={role} className="text-center min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs">{roleLabels[role]}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {menuKeys.map((menuKey) => (
              <TableRow key={menuKey}>
                <TableCell className="font-medium">{menuLabels[menuKey]}</TableCell>
                {ROLE_PERMISSIONS.map(({ role, permissions }) => (
                  <TableCell key={role} className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {getPermissionIcon(permissions[menuKey])}
                      <span className="text-xs text-muted-foreground capitalize">
                        {permissions[menuKey]}
                      </span>
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground pt-4">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-600" />
          <span>Full Access (Edit)</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-blue-600" />
          <span>View Only</span>
        </div>
        <div className="flex items-center gap-2">
          <X className="h-4 w-4 text-red-600" />
          <span>No Access</span>
        </div>
      </div>
    </div>
  );
}
