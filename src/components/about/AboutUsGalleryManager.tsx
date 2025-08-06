import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/ui/image-upload';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Plus, Edit, Trash2, Image as ImageIcon, Eye, EyeOff } from 'lucide-react';

interface GalleryItem {
  id: string;
  title?: string;
  description?: string;
  image_url: string;
  alt_text?: string;
  category: string;
  sort_order: number;
  is_published: boolean;
}

const GALLERY_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'office', label: 'Office' },
  { value: 'team', label: 'Team' },
  { value: 'events', label: 'Events' },
  { value: 'products', label: 'Products' },
];

export const AboutUsGalleryManager = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('about_us_gallery')
        .select('*')
        .order('sort_order');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching gallery items:', error);
      toast.error('Failed to load gallery items');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (itemData: Partial<GalleryItem>) => {
    try {
      if (editingItem) {
        const { error } = await supabase
          .from('about_us_gallery')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) throw error;
        toast.success('Gallery item updated successfully');
      } else {
        const { error } = await supabase
          .from('about_us_gallery')
          .insert({
            ...itemData,
            image_url: itemData.image_url || ''
          });

        if (error) throw error;
        toast.success('Gallery item added successfully');
      }

      setEditingItem(null);
      setIsCreating(false);
      fetchItems();
    } catch (error) {
      console.error('Error saving gallery item:', error);
      toast.error('Failed to save gallery item');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this gallery item?')) return;

    try {
      const { error } = await supabase
        .from('about_us_gallery')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Gallery item deleted successfully');
      fetchItems();
    } catch (error) {
      console.error('Error deleting gallery item:', error);
      toast.error('Failed to delete gallery item');
    }
  };

  const togglePublished = async (item: GalleryItem) => {
    try {
      const { error } = await supabase
        .from('about_us_gallery')
        .update({ 
          is_published: !item.is_published
        })
        .eq('id', item.id);

      if (error) throw error;
      toast.success(`Gallery item ${item.is_published ? 'unpublished' : 'published'}`);
      fetchItems();
    } catch (error) {
      console.error('Error toggling gallery item:', error);
      toast.error('Failed to update gallery item');
    }
  };

  const filteredItems = selectedCategory === 'all' 
    ? items 
    : items.filter(item => item.category === selectedCategory);

  if (loading) return <div>Loading gallery...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Gallery Management</h3>
        <Button 
          onClick={() => setIsCreating(true)} 
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Image
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All ({items.length})
        </Button>
        {GALLERY_CATEGORIES.map((cat) => (
          <Button
            key={cat.value}
            variant={selectedCategory === cat.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat.value)}
          >
            {cat.label} ({items.filter(item => item.category === cat.value).length})
          </Button>
        ))}
      </div>

      {(isCreating || editingItem) && (
        <GalleryItemForm
          item={editingItem}
          onSave={handleSave}
          onCancel={() => {
            setEditingItem(null);
            setIsCreating(false);
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="relative group">
                <img 
                  src={item.image_url} 
                  alt={item.alt_text || item.title}
                  className="w-full h-48 object-cover rounded-lg"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => togglePublished(item)}
                  >
                    {item.is_published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditingItem(item)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs">
                    {GALLERY_CATEGORIES.find(c => c.value === item.category)?.label}
                  </Badge>
                  <Badge variant={item.is_published ? "default" : "secondary"} className="text-xs">
                    {item.is_published ? "Published" : "Draft"}
                  </Badge>
                </div>
                
                {item.title && (
                  <h4 className="font-medium text-sm truncate">{item.title}</h4>
                )}
                
                {item.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

interface GalleryItemFormProps {
  item: GalleryItem | null;
  onSave: (data: Partial<GalleryItem>) => void;
  onCancel: () => void;
}

const GalleryItemForm: React.FC<GalleryItemFormProps> = ({ item, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: item?.title || '',
    description: item?.description || '',
    image_url: item?.image_url || '',
    alt_text: item?.alt_text || '',
    category: item?.category || 'general',
    sort_order: item?.sort_order || 0,
    is_published: item?.is_published ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url) {
      toast.error('Please upload an image');
      return;
    }
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{item ? 'Edit Gallery Item' : 'Add Gallery Item'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Image *</Label>
            <ImageUpload
              value={formData.image_url}
              onChange={(file) => setFormData({ ...formData, image_url: file ? (typeof file === 'string' ? file : URL.createObjectURL(file)) : '' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Image title"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {GALLERY_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Image description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="alt_text">Alt Text</Label>
              <Input
                id="alt_text"
                value={formData.alt_text}
                onChange={(e) => setFormData({ ...formData, alt_text: e.target.value })}
                placeholder="Descriptive text for accessibility"
              />
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
              Save Item
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};