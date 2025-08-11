import React, { useState } from 'react';
import { useAdminManagement, AdminUser } from '@/hooks/useAdminManagement';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Users, UserPlus, Activity, Settings, Shield, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export const AdminUserControl = () => {
  const {
    admins,
    invitations,
    isLoadingAdmins,
    isLoadingInvitations,
    sendInvitation,
    updateAdmin,
    isSendingInvitation,
    isUpdatingAdmin,
  } = useAdminManagement();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');

  const handleCreateAdmin = () => {
    if (!newAdminEmail || !newAdminRole) return;
    
    sendInvitation({ email: newAdminEmail, role: newAdminRole });
    setNewAdminEmail('');
    setNewAdminRole('admin');
    setShowCreateDialog(false);
  };

  const handleToggleUserStatus = (user: AdminUser) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    updateAdmin({ userId: user.id, action });
  };

  const getStatusBadge = (user: AdminUser) => {
    if (user.is_active) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>;
    }
    return <Badge variant="secondary" className="bg-red-500 text-white">Inactive</Badge>;
  };

  const getInvitationStatusBadge = (status: string, expiresAt: string) => {
    const isExpired = new Date(expiresAt) < new Date();
    
    if (status === 'accepted') {
      return <Badge variant="default" className="bg-green-500">Accepted</Badge>;
    }
    if (status === 'pending' && isExpired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary" className="bg-blue-500 text-white">Pending</Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin User Control</h2>
          <p className="text-muted-foreground">
            Manage admin users, their permissions, and track their actions
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Create Admin User
        </Button>
      </div>

      <Tabs defaultValue="admin-users" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="admin-users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Admin Users
          </TabsTrigger>
          <TabsTrigger value="invitations" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Invitations
          </TabsTrigger>
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
          <TabsTrigger value="audit-log" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="system-health" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            System Health
          </TabsTrigger>
        </TabsList>

        <TabsContent value="admin-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {admins.length} Admin Users
              </CardTitle>
              <CardDescription>
                Manage existing admin users and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAdmins ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Loading admin users...</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {admins.map((user) => (
                        <tr key={user.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium">{user.name || user.email}</div>
                              <div className="text-sm text-muted-foreground">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{user.role}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {getStatusBadge(user)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {format(new Date(user.created_at), 'M/d/yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm">
                                <Shield className="h-3 w-3 mr-1" />
                                Permissions
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button 
                                    variant={user.is_active ? "destructive" : "default"} 
                                    size="sm"
                                    disabled={isUpdatingAdmin}
                                  >
                                    {user.is_active ? 'Deactivate' : 'Activate'}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      {user.is_active ? 'Deactivate' : 'Activate'} Admin User
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to {user.is_active ? 'deactivate' : 'activate'} {user.name || user.email}? 
                                      {user.is_active && ' This will revoke their admin access immediately.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleUserStatus(user)}>
                                      {user.is_active ? 'Deactivate' : 'Activate'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {admins.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No admin users found</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {invitations.length} Pending Invitations
              </CardTitle>
              <CardDescription>
                Track sent invitations and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInvitations ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Loading invitations...</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Invited By</th>
                        <th className="px-4 py-3 text-left text-sm font-medium">Expires</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invitations.map((invitation) => (
                        <tr key={invitation.id} className="hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{invitation.email}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline">{invitation.role}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            {getInvitationStatusBadge(invitation.status, invitation.expires_at)}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {invitation.profiles?.name || 'System'}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {format(new Date(invitation.expires_at), 'M/d/yyyy')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {invitations.length === 0 && (
                    <div className="text-center py-8">
                      <UserPlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No invitations sent</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor">
          <Card>
            <CardHeader>
              <CardTitle>Admin Activity Monitor</CardTitle>
              <CardDescription>Real-time monitoring of admin activities</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Coming soon - Real-time admin activity monitoring</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>Permission Management</CardTitle>
              <CardDescription>Configure granular permissions for admin users</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Coming soon - Granular permission management</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit-log">
          <Card>
            <CardHeader>
              <CardTitle>Audit Log</CardTitle>
              <CardDescription>Track all administrative actions and changes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Coming soon - Comprehensive audit logging</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system-health">
          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Monitor system health and security status</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Coming soon - System health monitoring</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Admin Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Admin User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="admin@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={newAdminRole} onValueChange={setNewAdminRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateAdmin}
              disabled={!newAdminEmail || !newAdminRole || isSendingInvitation}
            >
              {isSendingInvitation ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};