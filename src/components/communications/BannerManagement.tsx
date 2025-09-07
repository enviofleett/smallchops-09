import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { HeaderBanner } from '@/hooks/useHeaderBanners';

interface BannerForm {
  title: string;
  description: string;
  image_url: string;
  background_color: string;
  text_color: string;
  button_text: string;
  button_url: string;
  is_active: boolean;
  display_priority: number;
  start_date: string;
  end_date: string;
}

export const BannerManagement: React.FC = () => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingBanner, setEditingBanner] = useState<HeaderBanner | null>(null);
  const [form, setForm] = useState<BannerForm>({
    title: '',
    description: '',
    image_url: '',
    background_color: '#3b82f6',
    text_color: '#ffffff',
    button_text: '',
    button_url: '',
    is_active: true,
    display_priority: 0,
    start_date: '',
    end_date: '',
  });

  const queryClient = useQueryClient();

  // Fetch banners
  const { data: banners, isLoading } = useQuery({
    queryKey: ['admin-header-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('header_banners')
        .select('*')
        .order('display_priority', { ascending: false });

      if (error) throw error;
      return data as HeaderBanner[];
    },
  });

  // Create banner mutation
  const createMutation = useMutation({
    mutationFn: async (bannerData: BannerForm) => {
      const { data, error } = await supabase
        .from('header_banners')
        .insert([bannerData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-header-banners'] });
      queryClient.invalidateQueries({ queryKey: ['header-banners'] });
      toast.success('Banner created successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to create banner: ' + error.message);
    },
  });

  // Update banner mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...bannerData }: { id: string } & BannerForm) => {
      const { data, error } = await supabase
        .from('header_banners')
        .update(bannerData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-header-banners'] });
      queryClient.invalidateQueries({ queryKey: ['header-banners'] });
      toast.success('Banner updated successfully');
      resetForm();
    },
    onError: (error) => {
      toast.error('Failed to update banner: ' + error.message);
    },
  });

  // Delete banner mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('header_banners')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-header-banners'] });
      queryClient.invalidateQueries({ queryKey: ['header-banners'] });
      toast.success('Banner deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete banner: ' + error.message);
    },
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      image_url: '',
      background_color: '#3b82f6',
      text_color: '#ffffff',
      button_text: '',
      button_url: '',
      is_active: true,
      display_priority: 0,
      start_date: '',
      end_date: '',
    });
    setIsCreating(false);
    setEditingBanner(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }

    const bannerData = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      image_url: form.image_url.trim() || undefined,
      button_text: form.button_text.trim() || undefined,
      button_url: form.button_url.trim() || undefined,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    };

    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, ...bannerData });
    } else {
      createMutation.mutate(bannerData);
    }
  };

  const handleEdit = (banner: HeaderBanner) => {
    setForm({
      title: banner.title,
      description: banner.description || '',
      image_url: banner.image_url || '',
      background_color: banner.background_color,
      text_color: banner.text_color,
      button_text: banner.button_text || '',
      button_url: banner.button_url || '',
      is_active: banner.is_active,
      display_priority: banner.display_priority,
      start_date: banner.start_date ? banner.start_date.split('T')[0] : '',
      end_date: banner.end_date ? banner.end_date.split('T')[0] : '',
    });
    setEditingBanner(banner);
    setIsCreating(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No limit';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return <div className="p-6">Loading banners...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Header Banner Management</h2>
          <p className="text-muted-foreground">
            Manage promotional banners that appear at the top of your website
          </p>
        </div>
        
        {!isCreating && (
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Banner
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingBanner ? 'Edit Banner' : 'Create New Banner'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Banner title"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="display_priority">Priority</Label>
                  <Input
                    id="display_priority"
                    type="number"
                    value={form.display_priority}
                    onChange={(e) => setForm({ ...form, display_priority: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image_url">Background Image URL</Label>
                <Input
                  id="image_url"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="background_color">Background Color</Label>
                  <Input
                    id="background_color"
                    type="color"
                    value={form.background_color}
                    onChange={(e) => setForm({ ...form, background_color: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text_color">Text Color</Label>
                  <Input
                    id="text_color"
                    type="color"
                    value={form.text_color}
                    onChange={(e) => setForm({ ...form, text_color: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="button_text">Button Text</Label>
                  <Input
                    id="button_text"
                    value={form.button_text}
                    onChange={(e) => setForm({ ...form, button_text: e.target.value })}
                    placeholder="Learn More"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="button_url">Button URL</Label>
                  <Input
                    id="button_url"
                    value={form.button_url}
                    onChange={(e) => setForm({ ...form, button_url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>

              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingBanner ? 'Update' : 'Create'} Banner
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Banners List */}
      <div className="grid gap-4">
        {banners?.map((banner) => (
          <Card key={banner.id}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{banner.title}</h3>
                    <Badge variant={banner.is_active ? 'default' : 'secondary'}>
                      {banner.is_active ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      {banner.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline">Priority: {banner.display_priority}</Badge>
                  </div>
                  {banner.description && (
                    <p className="text-sm text-muted-foreground mb-2">{banner.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground">
                    <span>Active: {formatDate(banner.start_date)} - {formatDate(banner.end_date)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(banner)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(banner.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preview */}
              <div 
                className="mt-4 p-4 rounded-lg text-center"
                style={{ 
                  backgroundColor: banner.background_color,
                  color: banner.text_color 
                }}
              >
                <div className="font-semibold">{banner.title}</div>
                {banner.description && (
                  <div className="text-sm opacity-90">{banner.description}</div>
                )}
                {banner.button_text && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 border-current text-current hover:bg-current hover:text-background"
                  >
                    {banner.button_text}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!banners?.length && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No banners created yet. Create your first banner to get started.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};