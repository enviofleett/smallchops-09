import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Users, Key } from 'lucide-react';
import { RolePermissionMatrix } from '@/components/permissions/RolePermissionMatrix';
import { UserRoleAssignment } from '@/components/permissions/UserRoleAssignment';
import { RoleDefinitions } from '@/components/permissions/RoleDefinitions';

export default function PermissionsManagement() {
  const [activeTab, setActiveTab] = useState('matrix');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Permissions Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage user roles, permissions, and access control
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Permission Matrix
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Roles
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Definitions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Permission Matrix</CardTitle>
              <CardDescription>
                View all roles and their associated permissions across the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RolePermissionMatrix />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Role Assignment</CardTitle>
              <CardDescription>
                Assign and manage roles for admin users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRoleAssignment />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Definitions</CardTitle>
              <CardDescription>
                Detailed information about each role and its capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleDefinitions />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
