import { ShieldAlert, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

interface RestrictedDashboardViewProps {
  userRole: string | null;
}

export const RestrictedDashboardView = ({ userRole }: RestrictedDashboardViewProps) => {
  const navigate = useNavigate();
  const isFulfillmentSupport = userRole === 'fulfilment_support';

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-2xl w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              {isFulfillmentSupport ? (
                <Truck className="h-16 w-16 text-primary" />
              ) : (
                <ShieldAlert className="h-16 w-16 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                {isFulfillmentSupport 
                  ? 'Dashboard Access Restricted' 
                  : 'Access Denied'}
              </h2>
              <p className="text-muted-foreground">
                {isFulfillmentSupport
                  ? 'As a Fulfillment Support user, you have access to order management and delivery operations instead of dashboard analytics.'
                  : `Your current role (${userRole || 'Unknown'}) does not have permission to view the dashboard.`}
              </p>
            </div>

            {isFulfillmentSupport && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button 
                  onClick={() => navigate('/admin/orders')}
                  className="flex items-center gap-2"
                >
                  <Truck className="h-4 w-4" />
                  Go to Orders
                </Button>
                <Button 
                  onClick={() => navigate('/admin/delivery')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Truck className="h-4 w-4" />
                  Go to Delivery
                </Button>
              </div>
            )}

            {!isFulfillmentSupport && (
              <p className="text-sm text-muted-foreground pt-2">
                Please contact your administrator if you need access to this section.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
