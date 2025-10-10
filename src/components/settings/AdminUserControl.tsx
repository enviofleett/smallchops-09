import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateAdminUserDialog } from "../admin/CreateAdminUserDialog";
import { AdminUsersList } from "../admin/AdminUsersList";
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';
import ErrorBoundary from '@/components/ErrorBoundary';
import { UserPlus, Shield } from "lucide-react";

export const AdminUserControl = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { canCreateUsers, isLoading } = useRoleBasedPermissions();

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
  };

  return (
    <ErrorBoundary>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Admin User Management
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Create and manage admin users with role-based permissions
            </p>
          </div>
          {!isLoading && canCreateUsers() && (
            <Button onClick={() => setShowCreateDialog(true)} className="w-full sm:w-auto">
              <UserPlus className="w-4 h-4 mr-2" />
              Create Admin User
            </Button>
          )}
        </div>

        {/* Admin Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Users
            </CardTitle>
            <CardDescription>
              View and manage admin users with role-based access control
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUsersList />
          </CardContent>
        </Card>

        {/* Create Admin User Dialog */}
        <CreateAdminUserDialog 
          open={showCreateDialog} 
          onOpenChange={setShowCreateDialog}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </ErrorBoundary>
  );
};