import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Mail, Plus, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmailTemplateList } from '@/components/email/EmailTemplateList';
import { EmailTemplateEditor } from '@/components/email/EmailTemplateEditor';
import { EmailTemplateTester } from '@/components/email/EmailTemplateTester';
import { EmailDeliveryMonitor } from '@/components/email/EmailDeliveryMonitor';

export const EmailTemplates: React.FC = () => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  const { data: templates, isLoading, refetch } = useQuery({
    queryKey: ['email-templates', searchQuery, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('enhanced_email_templates')
        .select('*')
        .order('template_name', { ascending: true });

      if (searchQuery) {
        query = query.or(`template_name.ilike.%${searchQuery}%,template_key.ilike.%${searchQuery}%`);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setShowNewTemplate(false);
  };

  const handleCreateNew = () => {
    setSelectedTemplateId(null);
    setShowNewTemplate(true);
  };

  const handleSaveSuccess = () => {
    refetch();
    setShowNewTemplate(false);
    setSelectedTemplateId(null);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Email Template Manager
          </h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and test email templates for production
          </p>
        </div>
        <Button onClick={handleCreateNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="tester">Test Emails</TabsTrigger>
          <TabsTrigger value="monitor">Delivery Monitor</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card className="p-4">
            <div className="flex gap-4 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border rounded-md px-3 py-2"
              >
                <option value="all">All Categories</option>
                <option value="order">Order</option>
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="marketing">Marketing</option>
              </select>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <EmailTemplateList
                templates={templates || []}
                isLoading={isLoading}
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={handleTemplateSelect}
              />
            </div>

            <div className="lg:col-span-2">
              {(selectedTemplateId || showNewTemplate) ? (
                <EmailTemplateEditor
                  templateId={selectedTemplateId}
                  onSaveSuccess={handleSaveSuccess}
                  onCancel={() => {
                    setSelectedTemplateId(null);
                    setShowNewTemplate(false);
                  }}
                />
              ) : (
                <Card className="p-8 text-center">
                  <Mail className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Template Selected</h3>
                  <p className="text-muted-foreground mb-4">
                    Select a template from the list or create a new one
                  </p>
                  <Button onClick={handleCreateNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Template
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tester">
          <EmailTemplateTester />
        </TabsContent>

        <TabsContent value="monitor">
          <EmailDeliveryMonitor />
        </TabsContent>
      </Tabs>
    </div>
  );
};
