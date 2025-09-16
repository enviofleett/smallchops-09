import React from 'react';
import { CheckoutErrorAuditorComponent } from '@/components/debug/CheckoutErrorAuditor';

export default function CheckoutAudit() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Checkout Error Audit</h1>
          <p className="text-muted-foreground mt-2">
            Diagnose and resolve checkout system issues
          </p>
        </div>
        
        <CheckoutErrorAuditorComponent />
      </div>
    </div>
  );
}