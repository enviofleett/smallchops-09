import React from 'react';
import { User, Phone, MapPin, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';
import { formatAddressMultiline } from '@/utils/formatAddress';

interface CustomerInfoCardProps {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  orderType: 'delivery' | 'pickup';
  deliveryAddress?: any;
  pickupPoint?: {
    name: string;
    address: string;
    contact_phone?: string;
  };
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customerName,
  customerPhone,
  customerEmail,
  orderType,
  deliveryAddress,
  pickupPoint
}) => {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Customer Information" 
          icon={User} 
        />
        
        <div className="space-y-4">
          {/* Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium break-words">{customerName}</span>
            </div>
            
            {customerPhone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerPhone}</span>
              </div>
            )}
            
            {customerEmail && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerEmail}</span>
              </div>
            )}
          </div>

          {/* Location Information */}
          <div className="pt-3 border-t border-border">
            {orderType === 'delivery' && deliveryAddress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Delivery Address
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  {(() => {
                    try {
                      const addressLines = formatAddressMultiline(deliveryAddress).split('\n');
                      return addressLines.map((line, index) => (
                        <div key={index} className="text-sm text-foreground">
                          {line}
                        </div>
                      ));
                    } catch (error) {
                      console.error('Error formatting delivery address:', error);
                      return (
                        <div className="text-sm text-foreground">
                          Address information unavailable
                        </div>
                      );
                    }
                  })()}
                </div>
              </div>
            )}
            
            {orderType === 'pickup' && pickupPoint && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Pickup Location
                  </span>
                </div>
                <div className="ml-6 space-y-1">
                  <div className="text-sm font-medium text-foreground">{pickupPoint.name}</div>
                  <div className="text-sm text-muted-foreground">{pickupPoint.address}</div>
                  {pickupPoint.contact_phone && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {pickupPoint.contact_phone}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};