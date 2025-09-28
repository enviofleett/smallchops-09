import React from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export function OrderDetailsTestButton() {
  const testOrderId = '2267979a-12ed-4399-9433-cfbe9511f55b'; // Real order ID from database

  return (
    <Button 
      variant="outline" 
      size="sm"
      asChild
      className="gap-2"
    >
      <a 
        href={`/admin/order-details/${testOrderId}`} 
        target="_blank" 
        rel="noopener noreferrer"
      >
        <ExternalLink className="w-4 h-4" />
        Test Order Details UI
      </a>
    </Button>
  );
}