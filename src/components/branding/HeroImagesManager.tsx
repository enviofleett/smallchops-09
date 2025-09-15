import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ImageUpload } from '@/components/ui/image-upload';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useImageUpload } from '@/hooks/useImageUpload';

const heroImageSchema = z.object({
  image_file: z.instanceof(File).optional(),
  image_url: z.string().optional(),
  alt_text: z.string().optional(),
  display_order: z.number().min(0),
  is_active: z.boolean().default(true),
}).refine((data) => data.image_file || data.image_url, {
  message: "Either upload a file or provide an image URL",
  path: ["image_file"],
});

type HeroImageFormData = z.infer<typeof heroImageSchema>;

interface HeroImage {
  id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const HeroImagesManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<HeroImage | null>(null);
  const queryClient = useQueryClient();
  const { uploadImage, isUploading } = useImageUpload();

  const form = useForm<HeroImageFormData>({
    resolver: zodResolver(heroImageSchema),
    defaultValues: {
      image_file: undefined,
      image_url: '',
      alt_text: '',
      display_order: 0,
      is_active: true,
    },
  });

  // Fetch hero images
  const { data: heroImages = [], isLoading } = useQuery({
    queryKey: ['hero-images'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_carousel_images')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data as HeroImage[];
    },
  });

  // Create/Update hero image mutation
  const saveImageMutation = useMutation({
    mutationFn: async (data: HeroImageFormData & { id?: string }) => {
      let imageUrl = data.image_url;

      // If there's a file to upload, upload it first
      if (data.image_file) {
        console.log('Uploading hero image file:', data.image_file.name);
        const uploadedUrl = await uploadImage(data.image_file, {
          bucket: 'hero-images',
          altText: data.alt_text
        });
        
        if (!uploadedUrl) {
          throw new Error('Failed to upload image');
        }
        
        imageUrl = uploadedUrl;
      }

      if (!imageUrl) {
        throw new Error('No image URL available');
      }

      if (data.id) {
        // Update existing
        const { error } = await supabase
          .from('hero_carousel_images')
          .update({
            image_url: imageUrl,
            alt_text: data.alt_text,
            display_order: data.display_order,
            is_active: data.is_active,
          })
          .eq('id', data.id);
        
        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('hero_carousel_images')
          .insert({
            image_url: imageUrl,
            alt_text: data.alt_text,
            display_order: data.display_order,
            is_active: data.is_active,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-images'] });
      setIsDialogOpen(false);
      setEditingImage(null);
      form.reset();
      toast.success(editingImage ? 'Hero image updated' : 'Hero image added');
    },
    onError: (error) => {
      toast.error('Failed to save hero image', {
        description: error.message,
      });
    },
  });

  // Delete hero image mutation
  const deleteImageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('hero_carousel_images')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-images'] });
      toast.success('Hero image deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete hero image', {
        description: error.message,
      });
    },
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('hero_carousel_images')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hero-images'] });
      toast.success('Hero image status updated');
    },
  });

  const handleEdit = (image: HeroImage) => {
    setEditingImage(image);
    form.reset({
      image_file: undefined,
      image_url: image.image_url,
      alt_text: image.alt_text || '',
      display_order: image.display_order,
      is_active: image.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: HeroImageFormData) => {
    saveImageMutation.mutate({
      ...data,
      id: editingImage?.id,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this hero image?')) {
      deleteImageMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    toggleActiveMutation.mutate({ id, is_active: !currentStatus });
  };

  const getMaxDisplayOrder = () => {
    return heroImages.length > 0 ? Math.max(...heroImages.map(img => img.display_order)) + 1 : 0;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Hero Images (Section A)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage images that rotate in the hero section. Images will fade in/out every 20 seconds.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingImage(null);
                  form.reset({
                    image_file: undefined,
                    image_url: '',
                    alt_text: '',
                    display_order: getMaxDisplayOrder(),
                    is_active: true,
                  });
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Hero Image
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingImage ? 'Edit Hero Image' : 'Add Hero Image'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="image_file"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Image</FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={form.watch('image_url')} // Show existing URL for editing
                            onChange={(file) => {
                              field.onChange(file);
                              // Clear image_url when new file is selected
                              if (file) {
                                form.setValue('image_url', '');
                              }
                            }}
                            disabled={isUploading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="alt_text"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alt Text</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Description for accessibility" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="display_order"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Order</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel>Active</FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveImageMutation.isPending || isUploading}>
                      {(saveImageMutation.isPending || isUploading) ? 'Saving...' : (editingImage ? 'Update' : 'Add')}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : heroImages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hero images yet. Add your first image to get started.
          </div>
        ) : (
          <div className="space-y-4">
            {heroImages.map((image) => (
              <div 
                key={image.id} 
                className="flex items-center gap-4 p-4 border rounded-lg"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                
                <div className="flex-shrink-0">
                  <img 
                    src={image.image_url} 
                    alt={image.alt_text || 'Hero image'} 
                    className="w-16 h-16 object-cover rounded"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {image.alt_text || 'Untitled Hero Image'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Order: {image.display_order}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleActive(image.id, image.is_active)}
                  >
                    {image.is_active ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(image)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(image.id)}
                    disabled={deleteImageMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};