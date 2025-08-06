
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { FileImageUpload } from '@/components/ui/file-image-upload';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { categorySchema, CategoryFormData, generateSlug, sanitizeHtml } from '@/lib/validations/category';
import { Category } from '@/types/database';

interface CategoryFormProps {
  category?: Category;
  onSubmit: (data: CategoryFormData & { bannerFile?: File }) => void;
  isLoading?: boolean;
}

const CategoryForm = ({ category, onSubmit, isLoading }: CategoryFormProps) => {
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  
  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || '',
      description: category?.description || '',
    },
  });

  const handleSubmit = (data: CategoryFormData) => {
    const sanitizedData = {
      ...data,
      description: data.description ? sanitizeHtml(data.description) : '',
    };
    
    onSubmit({
      ...sanitizedData,
      bannerFile: bannerFile || undefined,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter category name" 
                  {...field} 
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-2">
          <FormLabel>Banner Image (Optional)</FormLabel>
          <FileImageUpload
            value={bannerFile}
            onChange={setBannerFile}
            disabled={isLoading}
          />
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <RichTextEditor
                  value={field.value || ''}
                  onChange={field.onChange}
                  placeholder="Enter category description"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : category ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CategoryForm;
