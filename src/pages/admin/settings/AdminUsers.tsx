import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Mail, Activity } from 'lucide-react';
import { AdminUsersList } from '@/components/admin/AdminUsersList';
import { AdminInvitations } from '@/components/admin/AdminInvitations';
import { AdminActivityLog } from '@/components/admin/AdminActivityLog';
import { CreateAdminUserDialog } from '@/components/admin/CreateAdminUserDialog';
import { Button } from '@/components/ui/button';
import { useRoleBasedPermissions } from '@/hooks/useRoleBasedPermissions';

export default function AdminUsers() {
  const [activeTab, setActiveTab] = useState('users');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { canCreateUsers, isLoading } = useRoleBasedPermissions();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            Admin User Management
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage admin users, invitations, and monitor activity
          </p>
        </div>
        {!isLoading && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Admin User
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Pending Invitations
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>
                Manage existing admin users, their roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminUsersList />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                View and manage pending admin user invitations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminInvitations />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Monitor admin user actions and system changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AdminActivityLog />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {!isLoading && canCreateUsers() && (
        <CreateAdminUserDialog 
          open={createDialogOpen} 
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            setCreateDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
