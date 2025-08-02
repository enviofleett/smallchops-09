import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AboutUsSectionsManager } from './AboutUsSectionsManager';
import { TeamMembersManager } from './TeamMembersManager';
import { AboutUsGalleryManager } from './AboutUsGalleryManager';
import { FileText, Users, Images, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const AboutUsManager = () => {
  const [activeTab, setActiveTab] = useState("sections");

  const handlePreview = () => {
    window.open('/about', '_blank');
    toast.success('Opening About Us page preview');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>About Us Content Management</CardTitle>
            <CardDescription>
              Manage your about us page content, team members, and gallery
            </CardDescription>
          </div>
          <Button onClick={handlePreview} variant="outline" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Preview Page
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="sections" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Page Sections
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Members
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <Images className="h-4 w-4" />
              Gallery
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sections" className="mt-6">
            <AboutUsSectionsManager />
          </TabsContent>

          <TabsContent value="team" className="mt-6">
            <TeamMembersManager />
          </TabsContent>

          <TabsContent value="gallery" className="mt-6">
            <AboutUsGalleryManager />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};