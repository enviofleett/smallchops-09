import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreateAdminUserDialog } from '../admin/CreateAdminUserDialog';
import { Shield, UserPlus, Users, AlertTriangle } from 'lucide-react';
import { useAdminUserCreation } from '@/hooks/useAdminUserCreation';

export const AdminUserManager = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { isCreating } = useAdminUserCreation();

  const handleCreateSuccess = () => {
    // Refresh admin list or perform other actions
    console.log('Admin user created successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Admin User Management
          </h2>
          <p className="text-muted-foreground mt-1">
            Create and manage admin users with different permission levels
          </p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2"
          disabled={isCreating}
        >
          <UserPlus className="h-4 w-4" />
          Create Admin User
        </Button>
      </div>

      {/* Admin Creation Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Creation Guidelines
          </CardTitle>
          <CardDescription>
            Important information about creating admin users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Immediate Access</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Creates user with password and auto-verified email</li>
                <li>• User can login immediately</li>
                <li>• Password is displayed in success message</li>
                <li>• Best for urgent admin creation</li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">Invitation Flow</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Sends invitation email to user</li>
                <li>• User must verify email and set password</li>
                <li>• More secure for standard invitations</li>
                <li>• Recommended for most cases</li>
              </ul>
            </div>
          </div>
          
          <div className="border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4 rounded">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Security Note</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Only existing admin users can create new admin accounts. All admin creation activities are logged for security auditing.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Admin Dialog */}
      <CreateAdminUserDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
};