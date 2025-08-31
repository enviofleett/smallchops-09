import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';
import { MessageSquare, Truck } from 'lucide-react';

interface SpecialInstructionsProps {
  instructions?: string;
  deliveryInstructions?: string;
}

export const SpecialInstructions: React.FC<SpecialInstructionsProps> = ({
  instructions,
  deliveryInstructions
}) => {
  const hasAnyInstructions = instructions || deliveryInstructions;

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Special Instructions" 
          icon={MessageSquare}
        />
        
        {hasAnyInstructions ? (
          <div className="space-y-4">
            {instructions && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Order Instructions
                  </span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-foreground leading-relaxed">
                    {instructions}
                  </p>
                </div>
              </div>
            )}

            {deliveryInstructions && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Delivery Instructions
                  </span>
                </div>
                <div className="ml-6">
                  <p className="text-sm text-foreground leading-relaxed">
                    {deliveryInstructions}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No special instructions provided</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};