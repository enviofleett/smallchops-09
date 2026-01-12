import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';

interface AboutUsSection {
  id: string;
  section_type: string;
  title: string;
  content: string;
  image_url?: string;
  sort_order: number;
  is_published: boolean;
  seo_title?: string;
  seo_description?: string;
}

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Section', description: 'Main banner with headline' },
  { value: 'story', label: 'Our Story', description: 'Company background and history' },
  { value: 'values', label: 'Why Choose Us', description: 'Company values and differentiators' },
  { value: 'team_intro', label: 'Team Introduction', description: 'Introduction to the team section' },
  { value: 'contact', label: 'Contact Section', description: 'Contact information and CTA' },
];

export const AboutUsSectionsManager = () => {
  const [sections, setSections] = useState<AboutUsSection[]>([]);
  const [editingSection, setEditingSection] = useState<AboutUsSection | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSections();
  }, []);

  const fetchSections = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('about_us_sections')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setSections(data || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast.error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (sectionData: Partial<AboutUsSection>) => {
    try {
      if (editingSection) {
        const { error } = await (supabase as any)
          .from('about_us_sections')
          .update(sectionData)
          .eq('id', editingSection.id);

        if (error) throw error;
        toast.success('Section updated successfully');
      } else {
        const { error } = await (supabase as any)
          .from('about_us_sections')
          .insert({
            ...sectionData,
            section_type: sectionData.section_type || 'hero'
          });

        if (error) throw error;
        toast.success('Section created successfully');
      }

      setEditingSection(null);
      setIsCreating(false);
      fetchSections();
    } catch (error) {
      console.error('Error saving section:', error);
      toast.error('Failed to save section');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this section?')) return;

    try {
      const { error } = await (supabase as any)
        .from('about_us_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Section deleted successfully');
      fetchSections();
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Failed to delete section');
    }
  };

  const togglePublished = async (section: AboutUsSection) => {
    try {
      const { error } = await (supabase as any)
        .from('about_us_sections')
        .update({ 
          is_published: !section.is_published
        })
        .eq('id', section.id);

      if (error) throw error;
      toast.success(`Section ${section.is_published ? 'unpublished' : 'published'}`);
      fetchSections();
    } catch (error) {
      console.error('Error toggling section:', error);
      toast.error('Failed to update section');
    }
  };

  if (loading) return <div>Loading sections...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Page Sections</h3>
        <Button 
          onClick={() => setIsCreating(true)} 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Section
        </Button>
      </div>

      {(isCreating || editingSection) && (
        <SectionForm
          section={editingSection}
          onSave={handleSave}
          onCancel={() => {
            setEditingSection(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">
                    {SECTION_TYPES.find(t => t.value === section.section_type)?.label || section.section_type}
                  </CardTitle>
                  <Badge variant={section.is_published ? "default" : "secondary"}>
                    {section.is_published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => togglePublished(section)}
                  >
                    {section.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingSection(section)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(section.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <h4 className="font-semibold mb-2">{section.title}</h4>
              <p className="text-muted-foreground text-sm line-clamp-2">{section.content}</p>
              {section.image_url && (
                <img 
                  src={section.image_url} 
                  alt={section.title}
                  className="mt-3 w-32 h-20 object-cover rounded"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface SectionFormProps {
  section: AboutUsSection | null;
  onSave: (data: Partial<AboutUsSection>) => void;
  onCancel: () => void;
}

const SectionForm: React.FC<SectionFormProps> = ({ section, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    section_type: section?.section_type || '',
    title: section?.title || '',
    content: section?.content || '',
    image_url: section?.image_url || '',
    sort_order: section?.sort_order || 0,
    is_published: section?.is_published ?? true,
    seo_title: section?.seo_title || '',
    seo_description: section?.seo_description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{section ? 'Edit Section' : 'Create Section'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="section_type">Section Type</Label>
              <select
                id="section_type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.section_type}
                onChange={(e) => setFormData({ ...formData, section_type: e.target.value })}
                required
              >
                <option value="">Select section type</option>
                {SECTION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="content">Content</Label>
            <RichTextEditor
              value={formData.content}
              onChange={(content) => setFormData({ ...formData, content })}
              placeholder="Enter section content..."
            />
          </div>

          <div>
            <Label>Section Image</Label>
            <ImageUpload
              value={formData.image_url}
              onChange={(file) => setFormData({ ...formData, image_url: file ? URL.createObjectURL(file) : '' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="seo_title">SEO Title</Label>
              <Input
                id="seo_title"
                value={formData.seo_title}
                onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                placeholder="Optional SEO title"
              />
            </div>
            <div>
              <Label htmlFor="seo_description">SEO Description</Label>
              <Textarea
                id="seo_description"
                value={formData.seo_description}
                onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                placeholder="Optional SEO description"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
            />
            <Label htmlFor="is_published">Published</Label>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Save Section
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};