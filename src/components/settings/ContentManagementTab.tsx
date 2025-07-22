
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useContentManagement } from '@/hooks/useContentManagement';
import { ContentEditor } from './ContentEditor';
import { ContentVersionsDialog } from './ContentVersionsDialog';

const CONTENT_TYPE_LABELS = {
  about_us: 'About Us',
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  contact_info: 'Contact Info',
  faq: 'FAQ',
  help_center: 'Help Center',
};

const ContentManagementTab = () => {
  const { useContentList, useDeleteContent } = useContentManagement();
  const { data: contentList = [], isLoading } = useContentList();
  const deleteContentMutation = useDeleteContent();
  
  const [selectedContent, setSelectedContent] = useState<any>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [versionsDialogContent, setVersionsDialogContent] = useState<any>(null);

  const handleCreateNew = () => {
    setSelectedContent(null);
    setIsEditorOpen(true);
  };

  const handleEdit = (content: any) => {
    setSelectedContent(content);
    setIsEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this content? This action cannot be undone.')) {
      await deleteContentMutation.mutateAsync(id);
    }
  };

  const handleViewVersions = (content: any) => {
    setVersionsDialogContent(content);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Content Management</h3>
        </div>
        <div className="text-center py-8">Loading content...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Content Management</h3>
          <p className="text-sm text-gray-500">
            Manage website content like About Us, Terms of Service, and more.
          </p>
        </div>
        <Button onClick={handleCreateNew} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Content
        </Button>
      </div>

      <div className="grid gap-4">
        {contentList.map((content) => (
          <Card key={content.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{content.title}</CardTitle>
                  <Badge variant={content.is_published ? "default" : "secondary"}>
                    {content.is_published ? 'Published' : 'Draft'}
                  </Badge>
                  <Badge variant="outline">
                    {CONTENT_TYPE_LABELS[content.content_type]}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewVersions(content)}
                    className="flex items-center gap-1"
                  >
                    <History className="h-4 w-4" />
                    v{content.version}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(content)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(content.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Last updated: {new Date(content.updated_at).toLocaleDateString()}
                {content.seo_description && (
                  <span className="block mt-1 text-xs">SEO: {content.seo_description}</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                Slug: <span className="font-mono bg-gray-100 px-1 rounded">{content.slug}</span>
              </div>
              <div 
                className="mt-2 text-sm line-clamp-2"
                dangerouslySetInnerHTML={{ __html: content.content }}
              />
            </CardContent>
          </Card>
        ))}

        {contentList.length === 0 && (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-gray-500 mb-4">No content created yet.</p>
              <Button onClick={handleCreateNew} className="flex items-center gap-2 mx-auto">
                <Plus className="h-4 w-4" />
                Create Your First Content
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {isEditorOpen && (
        <ContentEditor
          content={selectedContent}
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedContent(null);
          }}
        />
      )}

      {versionsDialogContent && (
        <ContentVersionsDialog
          content={versionsDialogContent}
          isOpen={!!versionsDialogContent}
          onClose={() => setVersionsDialogContent(null)}
        />
      )}
    </div>
  );
};

export default ContentManagementTab;
