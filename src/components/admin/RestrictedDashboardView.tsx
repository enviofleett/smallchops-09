import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RestrictedDashboardViewProps {
  userRole: string | null;
}

const ROLE_ACCESSIBLE_SECTIONS: Record<string, { label: string; path: string }[]> = {
  support_staff: [
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Customers', path: '/admin/customers' },
  ],
  support_officer: [
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Customers', path: '/admin/customers' },
  ],
  staff: [
    { label: 'Orders', path: '/admin/orders' },
  ],
  manager: [
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Products', path: '/admin/products' },
  ],
  fulfilment_support: [
    { label: 'Orders', path: '/admin/orders' },
    { label: 'Fulfillment', path: '/admin/fulfillment' },
  ],
};

export const RestrictedDashboardView = ({ userRole }: RestrictedDashboardViewProps) => {
  const navigate = useNavigate();
  const accessibleSections = userRole ? ROLE_ACCESSIBLE_SECTIONS[userRole] || [] : [];

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-4">
              <ShieldAlert className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Dashboard Access Restricted</CardTitle>
            <CardDescription className="text-base">
              Full dashboard analytics are available to authorized administrators only
            </CardDescription>
          </div>
          {userRole && (
            <div className="flex justify-center">
              <Badge variant="outline" className="text-sm">
                Your Role: {userRole.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </Badge>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {accessibleSections.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                You have access to the following sections:
              </p>
              <div className="grid gap-2">
                {accessibleSections.map((section) => (
                  <Button
                    key={section.path}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => navigate(section.path)}
                  >
                    <span>{section.label}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Need dashboard access? Contact your administrator to request additional permissions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
