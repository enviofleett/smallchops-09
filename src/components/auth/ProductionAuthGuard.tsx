import React, { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '@/hooks/useUnifiedAuth';
import { UserRole } from '@/hooks/useRoleBasedPermissions';
import { storeRedirectUrl } from '@/utils/redirect';
import { Loader2, Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProductionAuthGuardProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  menuPermission?: string;
  permissionLevel?: 'view' | 'edit';
  fallbackPath?: string;
}

/**
 * Production-ready authentication guard with comprehensive security checks
 */
const ProductionAuthGuard: React.FC<ProductionAuthGuardProps> = ({
  children,
  requiredRole,
  menuPermission,
  permissionLevel = 'view',
  fallbackPath = '/admin/auth'
}) => {
  const location = useLocation();
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    canAccessAdmin,
    hasRole,
    hasMenuPermission,
    isAdmin 
  } = useUnifiedAuth();

  // Store redirect URL for post-login navigation
  useEffect(() => {
    const shouldStoreRedirect = 
      !isLoading && 
      !isAuthenticated && 
      location.pathname !== '/admin/auth' && 
      location.pathname !== '/auth' && 
      location.pathname !== '/';
    
    if (shouldStoreRedirect) {
      const fullPath = location.pathname + location.search + location.hash;
      storeRedirectUrl(fullPath);
    }
  }, [isLoading, isAuthenticated, location]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-center">
              Verifying authentication...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Not admin user - show access denied
  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                You don't have administrator privileges to access this section.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Return to Store
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/admin/auth'}
                className="w-full"
              >
                Login as Admin
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Role-specific access control
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle>Insufficient Permissions</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your role ({user?.role}) doesn't have access to this section.
              {requiredRole && ` Required role: ${requiredRole}.`}
            </p>
            <Button
              onClick={() => window.history.back()}
              className="w-full"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Menu permission check
  if (menuPermission && !hasMenuPermission(menuPermission, permissionLevel)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
            <CardTitle>Access Restricted</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              You don't have {permissionLevel} permissions for this feature.
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="w-full"
            >
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All checks passed - render protected content
  return <>{children}</>;
};

export default ProductionAuthGuard;