import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ImageUpload } from '@/components/ui/image-upload';
import { BlogArticle, BlogCategory, generateSlug } from '@/api/blog';

const blogArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().optional(),
  excerpt: z.string().max(500, 'Excerpt must be less than 500 characters').optional(),
  featured_image_url: z.string().optional(),
  banner_url: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  category_id: z.string().optional(),
  published_at: z.string().optional(),
  scheduled_for: z.string().optional(),
  tags: z.array(z.string()),
  seo_title: z.string().max(60, 'SEO title should be under 60 characters').optional(),
  seo_description: z.string().max(160, 'SEO description should be under 160 characters').optional(),
  seo_keywords: z.string().optional(),
});

type BlogArticleFormData = z.infer<typeof blogArticleSchema>;

interface BlogArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article?: BlogArticle | null;
  categories: BlogCategory[];
  onSubmit: (data: Omit<BlogArticle, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'blog_categories'>) => void;
  isLoading?: boolean;
}

export const BlogArticleDialog = ({ 
  open, 
  onOpenChange, 
  article, 
  categories, 
  onSubmit, 
  isLoading 
}: BlogArticleDialogProps) => {
  const form = useForm<BlogArticleFormData>({
    resolver: zodResolver(blogArticleSchema),
    defaultValues: {
      title: '',
      content: '',
      excerpt: '',
      featured_image_url: '',
      banner_url: '',
      status: 'draft',
      category_id: '',
      published_at: '',
      scheduled_for: '',
      tags: [],
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
    },
  });

  useEffect(() => {
    if (article) {
      form.reset({
        title: article.title,
        content: article.content || '',
        excerpt: article.excerpt || '',
        featured_image_url: article.featured_image_url || '',
        banner_url: article.banner_url || '',
        status: article.status,
        category_id: article.category_id || '',
        published_at: article.published_at ? new Date(article.published_at).toISOString().slice(0, 16) : '',
        scheduled_for: article.scheduled_for ? new Date(article.scheduled_for).toISOString().slice(0, 16) : '',
        tags: article.tags || [],
        seo_title: article.seo_title || '',
        seo_description: article.seo_description || '',
        seo_keywords: article.seo_keywords || '',
      });
    } else {
      form.reset({
        title: '',
        content: '',
        excerpt: '',
        featured_image_url: '',
        banner_url: '',
        status: 'draft',
        category_id: '',
        published_at: '',
        scheduled_for: '',
        tags: [],
        seo_title: '',
        seo_description: '',
        seo_keywords: '',
      });
    }
  }, [article, form]);

  const handleSubmit = (data: BlogArticleFormData) => {
    const slug = generateSlug(data.title);
    const tagsString = data.tags.join(',');
    
    onSubmit({
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      featured_image_url: data.featured_image_url,
      banner_url: data.banner_url,
      status: data.status,
      category_id: data.category_id || undefined,
      published_at: data.status === 'published' && data.published_at ? data.published_at : undefined,
      scheduled_for: data.scheduled_for || undefined,
      tags: tagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      seo_title: data.seo_title,
      seo_description: data.seo_description,
      seo_keywords: data.seo_keywords,
      slug,
      author_id: undefined,
    });
  };

  const handleTagsChange = (value: string) => {
    const tags = value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    form.setValue('tags', tags);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {article ? 'Edit Blog Article' : 'Add New Blog Article'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="content" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Article Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter article title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="excerpt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Excerpt</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the article"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Article Content</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Write your article content..."
                          className="min-h-[400px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <FormField
                  control={form.control}
                  name="featured_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Featured Image</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="banner_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Article Banner</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="published_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Publish Date</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scheduled_for"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schedule For</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter tags separated by commas"
                          value={field.value.join(', ')}
                          onChange={(e) => handleTagsChange(e.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <FormField
                  control={form.control}
                  name="seo_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Title</FormLabel>
                      <FormControl>
                        <Input placeholder="SEO-friendly title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seo_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Meta description for search engines"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seo_keywords"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SEO Keywords</FormLabel>
                      <FormControl>
                        <Input placeholder="Keywords separated by commas" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : article ? 'Update Article' : 'Create Article'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};