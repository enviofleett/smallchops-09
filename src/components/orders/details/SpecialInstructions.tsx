import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';

interface SpecialInstructionsProps {
  instructions?: string;
  deliveryInstructions?: string;
}

export const SpecialInstructions: React.FC<SpecialInstructionsProps> = ({ 
  instructions, 
  deliveryInstructions 
}) => {
  const hasInstructions = instructions || deliveryInstructions;

  if (!hasInstructions) {
    return null;
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Special Instructions" 
          icon={MessageSquare} 
        />
        
        <div className="space-y-3">
          {instructions && (
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-foreground mb-2">Order Instructions</h4>
              <p className="text-sm text-muted-foreground leading-relaxed break-words">
                {instructions}
              </p>
            </div>
          )}
          
          {deliveryInstructions && (
            <div className="bg-muted/50 rounded-lg p-3">
              <h4 className="text-sm font-medium text-foreground mb-2">Delivery Instructions</h4>
              <p className="text-sm text-muted-foreground leading-relaxed break-words">
                {deliveryInstructions}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};