import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Eye, Edit } from 'lucide-react';
import { ROLE_PERMISSIONS, UserRole } from '@/hooks/useRoleBasedPermissions';

const roleDescriptions: Record<UserRole, { description: string; capabilities: string[] }> = {
  super_admin: {
    description: 'Full system access with ability to manage all aspects including user roles and permissions.',
    capabilities: [
      'All menus and submenus with edit access',
      'Can create and manage admin users',
      'Can assign and revoke all roles',
      'Full access to settings including dev section',
      'Complete audit trail access',
    ],
  },
  store_owner: {
    description: 'Full operational access to manage the entire store except development settings.',
    capabilities: [
      'All menus except dev section',
      'Can create and manage admin users',
      'Can assign roles to other users',
      'Full access to settings (except dev)',
      'Complete store management',
    ],
  },
  admin_manager: {
    description: 'Focused on product, category, booking, delivery, and promotions management.',
    capabilities: [
      'Dashboard access',
      'Product & category management',
      'Catering bookings management',
      'Delivery zones configuration',
      'Promotions management',
      'No access to orders, customers, or reports',
    ],
  },
  account_manager: {
    description: 'Focused on financial operations with order and sales reporting access.',
    capabilities: [
      'Dashboard access',
      'Order management',
      'Sales reports and analytics',
      'No access to products or settings',
      'Limited to financial operations',
    ],
  },
  support_staff: {
    description: 'Customer support focused access for handling orders and customer inquiries.',
    capabilities: [
      'View-only dashboard access',
      'Full order management',
      'Full customer management',
      'No access to products, settings, or reports',
      'Focused on support operations',
    ],
  },
  fulfilment_support: {
    description: 'Focused on order fulfillment, delivery coordination, and logistics management.',
    capabilities: [
      'Full dashboard access',
      'Full order management and tracking',
      'View delivery zones and customer info',
      'No access to products, settings, or financial reports',
      'Dedicated to fulfillment operations',
    ],
  },
  admin: {
    description: 'Legacy: Comprehensive access to operational features (mapped to admin_manager + more).',
    capabilities: [
      'Access to most operational features',
      'Product and order management',
      'Settings access (limited)',
      'Legacy role - consider upgrading',
    ],
  },
  manager: {
    description: 'Legacy: Operational management access (mapped to admin_manager functionality).',
    capabilities: [
      'Full operational feature access',
      'Order and product management',
      'View access to reports',
      'Legacy role - consider upgrading',
    ],
  },
  support_officer: {
    description: 'Legacy: Support-focused access (now mapped to support_staff).',
    capabilities: [
      'Order and customer management',
      'View dashboard access',
      'Legacy role - consider upgrading to support_staff',
    ],
  },
  staff: {
    description: 'Legacy: Basic read-only access (minimal permissions).',
    capabilities: [
      'View-only dashboard and orders',
      'No modification permissions',
      'Legacy role - consider upgrading',
    ],
  },
};

const roleIcons: Record<UserRole, any> = {
  super_admin: Shield,
  store_owner: Shield,
  admin_manager: Users,
  account_manager: Edit,
  support_staff: Eye,
  fulfilment_support: Users,
  admin: Shield,
  manager: Users,
  support_officer: Eye,
  staff: Eye,
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-500',
  store_owner: 'bg-indigo-500',
  admin_manager: 'bg-blue-500',
  account_manager: 'bg-cyan-500',
  support_staff: 'bg-green-500',
  fulfilment_support: 'bg-orange-500',
  admin: 'bg-blue-400',
  manager: 'bg-green-400',
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
