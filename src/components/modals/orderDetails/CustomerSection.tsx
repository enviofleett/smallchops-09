import React from 'react';
import { User, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Order } from '@/types/orderDetailsModal';

interface CustomerSectionProps {
  order: Order;
}

export const CustomerSection: React.FC<CustomerSectionProps> = ({ order }) => {
  return (
    <Card className="keep-together">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Customer Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {order.customer_name || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Full Name</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {order.customer_email || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Email Address</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {order.customer_phone || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Phone Number</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};