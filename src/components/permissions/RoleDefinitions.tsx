import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Eye, Edit } from 'lucide-react';
import { ROLE_PERMISSIONS, UserRole } from '@/hooks/useRoleBasedPermissions';

const roleDescriptions: Record<UserRole, { description: string; capabilities: string[] }> = {
  super_admin: {
    description: 'Full system access with the ability to manage all aspects of the platform including user roles and permissions.',
    capabilities: [
      'Access to all features and menus',
      'Can create and manage admin users',
      'Can assign and revoke all roles',
      'Full access to settings and configurations',
      'Can view and modify all system data',
    ],
  },
  admin: {
    description: 'Comprehensive access to all operational features with the ability to manage users and perform administrative tasks.',
    capabilities: [
      'Access to all features and menus',
      'Can create and manage admin users',
      'Can assign roles to other users',
      'Full access to settings and configurations',
      'Can manage orders, products, and customers',
    ],
  },
  manager: {
    description: 'Operational management access to handle day-to-day business operations without access to sensitive settings.',
    capabilities: [
      'Full access to operational features',
      'Can manage orders, products, and categories',
      'Can view and manage customers',
      'Can access reports and analytics',
      'View-only access to audit logs',
      'No access to settings pages',
    ],
  },
  support_officer: {
    description: 'Limited access focused on customer support and order management tasks.',
    capabilities: [
      'View access to dashboard',
      'Full access to order management',
      'View access to customer information',
      'Can process orders and updates',
      'No access to products, settings, or reports',
    ],
  },
  staff: {
    description: 'Basic read-only access for viewing orders and customer information.',
    capabilities: [
      'View access to dashboard',
      'View-only access to orders',
      'View-only access to customer information',
      'No modification permissions',
      'No access to sensitive data or settings',
    ],
  },
};

const roleIcons: Record<UserRole, any> = {
  super_admin: Shield,
  admin: Shield,
  manager: Users,
  support_officer: Eye,
  staff: Eye,
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  admin: 'bg-blue-500',
  manager: 'bg-green-500',
  support_officer: 'bg-yellow-500',
  staff: 'bg-gray-500',
};

export function RoleDefinitions() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {ROLE_PERMISSIONS.map(({ role }) => {
        const Icon = roleIcons[role];
        const { description, capabilities } = roleDescriptions[role];
        
        return (
          <Card key={role} className="flex flex-col">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-5 w-5" />
                <Badge className={roleColors[role]}>
                  {role.split('_').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                  ).join(' ')}
                </Badge>
              </div>
              <CardTitle className="text-lg">
                {role.split('_').map(word => 
                  word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ')}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Key Capabilities:</h4>
                <ul className="space-y-1">
                  {capabilities.map((capability, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span className="text-muted-foreground">{capability}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
