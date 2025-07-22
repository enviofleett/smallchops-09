import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateAdminDialog } from "./CreateAdminDialog";
import { UserPermissionsMatrix } from "./UserPermissionsMatrix";
import { AdminActionsLog } from "./AdminActionsLog";
import { useAdminManagement } from '@/hooks/useAdminManagement';
import ErrorBoundary from '@/components/ErrorBoundary';
import { UserPlus, Shield, Activity, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AdminUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  status: string;
  created_at: string;
}

interface AdminInvitation {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  expires_at: string;
  invited_by: string;
}

export const AdminUserControl = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  
  const {
    admins: adminUsers,
    invitations,
    isLoadingAdmins: loadingUsers,
    isLoadingInvitations: loadingInvitations,
    deleteUser,
    deleteInvitation,
    isDeletingUser,
    isDeletingInvitation,
  } = useAdminManagement();

  return (
    <ErrorBoundary>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin User Control</h2>
          <p className="text-muted-foreground">
            Manage admin users, their permissions, and track their actions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Create Admin User
        </Button>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Admin Users</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Admin Users
              </CardTitle>
              <CardDescription>
                Manage existing admin users and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div>Loading admin users...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adminUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || 'Unnamed Admin'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedUser(user)}
                            >
                              <Shield className="w-4 h-4 mr-1" />
                              Permissions
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  Deactivate
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate Admin User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to deactivate this admin user? This action will prevent them from accessing admin features.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteUser(user.id)} disabled={isDeletingUser}>
                                    {isDeletingUser ? 'Deactivating...' : 'Deactivate'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>
                Track admin user invitations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingInvitations ? (
                <div>Loading invitations...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Invited</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations?.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell className="font-medium">{invitation.email}</TableCell>
                        <TableCell>
                          <Badge variant={invitation.status === 'pending' ? 'default' : 'secondary'}>
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.invited_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expires_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this invitation? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteInvitation(invitation.id)} disabled={isDeletingInvitation}>
                                  {isDeletingInvitation ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <UserPermissionsMatrix selectedUser={selectedUser} />
        </TabsContent>

        <TabsContent value="audit">
          <AdminActionsLog />
        </TabsContent>
      </Tabs>

      <CreateAdminDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />
    </div>
    </ErrorBoundary>
  );
};