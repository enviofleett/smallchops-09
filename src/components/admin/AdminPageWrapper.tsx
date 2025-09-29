import React from 'react';
import { ProductionErrorBoundary } from './ProductionErrorBoundary';
import ProductionAuthGuard from '../auth/ProductionAuthGuard';
import { UserRole } from '@/hooks/useRoleBasedPermissions';
import { Helmet } from 'react-helmet-async';

interface AdminPageWrapperProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  requiredRole?: UserRole;
  menuPermission?: string;
  permissionLevel?: 'view' | 'edit';
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * Comprehensive wrapper for all admin pages with:
 * - Authentication/Authorization
 * - Error boundaries
 * - SEO
 * - Loading states
 */
const AdminPageWrapper: React.FC<AdminPageWrapperProps> = ({
  children,
  title,
  description,
  requiredRole,
  menuPermission,
  permissionLevel,
  seoTitle,
  seoDescription
}) => {
  return (
    <>
      <Helmet>
        <title>{seoTitle || `${title} - Admin Dashboard`}</title>
        <meta 
          name="description" 
          content={seoDescription || description || `${title} management interface for administrators`} 
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>

      <ProductionAuthGuard
        requiredRole={requiredRole}
        menuPermission={menuPermission}
        permissionLevel={permissionLevel}
      >
        <ProductionErrorBoundary>
          <div className="space-y-6">
            {/* Page Header */}
            <div className="border-b pb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-1 text-sm md:text-base">{description}</p>
              )}
            </div>

            {/* Page Content */}
            <div className="space-y-6">
              {children}
            </div>
          </div>
        </ProductionErrorBoundary>
      </ProductionAuthGuard>
    </>
  );
};

export default AdminPageWrapper;