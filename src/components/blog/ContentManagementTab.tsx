import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BlogCategoriesManager } from './BlogCategoriesManager';
import { BlogArticlesManager } from './BlogArticlesManager';
import { FileText, FolderOpen } from 'lucide-react';

export const ContentManagementTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Content Management System</CardTitle>
        <CardDescription>
          Manage your blog categories and articles with a complete content management system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Articles
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-6">
            <BlogCategoriesManager />
          </TabsContent>

          <TabsContent value="articles" className="mt-6">
            <BlogArticlesManager />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};