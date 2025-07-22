
import React, { useState, useEffect } from 'react';
import { X, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { useContentManagement, type SiteContent } from '@/hooks/useContentManagement';

const CONTENT_TYPES = [
  { value: 'about_us', label: 'About Us' },
  { value: 'terms_of_service', label: 'Terms of Service' },
  { value: 'privacy_policy', label: 'Privacy Policy' },
  { value: 'contact_info', label: 'Contact Info' },
  { value: 'faq', label: 'FAQ' },
  { value: 'help_center', label: 'Help Center' },
];

interface ContentEditorProps {
  content?: SiteContent | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ContentEditor = ({ content, isOpen, onClose }: ContentEditorProps) => {
  const { useCreateContent, useUpdateContent } = useContentManagement();
  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent();
  
  const [formData, setFormData] = useState({
    content_type: 'about_us' as SiteContent['content_type'],
    title: '',
    content: '',
    slug: '',
    is_published: false,
    seo_title: '',
    seo_description: '',
  });

  const [activeTab, setActiveTab] = useState('content');

  useEffect(() => {
    if (content) {
      setFormData({
        content_type: content.content_type,
        title: content.title,
        content: content.content,
        slug: content.slug,
        is_published: content.is_published,
        seo_title: content.seo_title || '',
        seo_description: content.seo_description || '',
      });
    } else {
      setFormData({
        content_type: 'about_us',
        title: '',
        content: '',
        slug: '',
        is_published: false,
        seo_title: '',
        seo_description: '',
      });
    }
  }, [content]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title),
    }));
  };

  const handleSave = async () => {
    try {
      if (content) {
        await updateMutation.mutateAsync({ id: content.id, ...formData });
      } else {
        await createMutation.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Error saving content:', error);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            {content ? 'Edit Content' : 'Create New Content'}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="content" className="h-full overflow-auto space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="Enter content title"
                    />
                  </div>

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <div className="min-h-[300px]">
                      <RichTextEditor
                        value={formData.content}
                        onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
                        placeholder="Enter your content here..."
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="h-full overflow-auto space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="content_type">Content Type</Label>
                    <Select
                      value={formData.content_type}
                      onValueChange={(value: SiteContent['content_type']) => 
                        setFormData(prev => ({ ...prev, content_type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="slug">URL Slug</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="url-friendly-slug"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_published"
                      checked={formData.is_published}
                      onCheckedChange={(checked) => 
                        setFormData(prev => ({ ...prev, is_published: checked }))
                      }
                    />
                    <Label htmlFor="is_published">Published</Label>
                  </div>

                  <div>
                    <Label htmlFor="seo_title">SEO Title (Optional)</Label>
                    <Input
                      id="seo_title"
                      value={formData.seo_title}
                      onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                      placeholder="SEO optimized title"
                    />
                  </div>

                  <div>
                    <Label htmlFor="seo_description">SEO Description (Optional)</Label>
                    <Input
                      id="seo_description"
                      value={formData.seo_description}
                      onChange={(e) => setFormData(prev => ({ ...prev, seo_description: e.target.value }))}
                      placeholder="Brief description for search engines"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="h-full overflow-auto mt-4">
                <div className="prose prose-sm max-w-none">
                  <h1>{formData.title || 'Untitled'}</h1>
                  <div dangerouslySetInnerHTML={{ __html: formData.content || '<p>No content yet...</p>' }} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
