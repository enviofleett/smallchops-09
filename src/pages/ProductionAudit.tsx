import React from 'react';
import { Helmet } from 'react-helmet-async';
import { CheckoutAuditDashboard } from '@/components/admin/CheckoutAuditDashboard';

const ProductionAudit: React.FC = () => {
  return (
    <>
      <Helmet>
        <title>Production Audit - System Health & Go-Live Readiness</title>
        <meta 
          name="description" 
          content="Comprehensive production audit dashboard for checkout system validation and go-live readiness assessment"
        />
      </Helmet>
      
      <div className="container mx-auto py-8 px-4">
        <CheckoutAuditDashboard />
      </div>
    </>
  );
};

export default ProductionAudit;