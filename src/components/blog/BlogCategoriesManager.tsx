import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { blogCategoriesApi, BlogCategory } from '@/api/blog';
import { BlogCategoryDialog } from './BlogCategoryDialog';
import { toast } from '@/hooks/use-toast';

export const BlogCategoriesManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
  const queryClient = useQueryClient();

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: blogCategoriesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: blogCategoriesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Blog category created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create blog category",
        variant: "destructive",
      });
      console.error('Create error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BlogCategory> }) =>
      blogCategoriesApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      setEditingCategory(null);
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Blog category updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update blog category",
        variant: "destructive",
      });
      console.error('Update error:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: blogCategoriesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-categories'] });
      toast({
        title: "Success",
        description: "Blog category deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete blog category",
        variant: "destructive",
      });
      console.error('Delete error:', error);
    },
  });

  const handleCreate = (data: Omit<BlogCategory, 'id' | 'created_at' | 'updated_at'>) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: Omit<BlogCategory, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, updates: data });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this blog category?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (category: BlogCategory) => {
    setEditingCategory(category);
    setIsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Failed to load blog categories. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Blog Categories</h3>
          <p className="text-sm text-muted-foreground">
            Manage categories for your blog articles
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>

      <div className="grid gap-4">
        {categories?.map((category) => (
          <Card key={category.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {category.banner_url && (
                    <img
                      src={category.banner_url}
                      alt={category.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  <div>
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={category.is_active ? "default" : "secondary"}>
                        {category.is_active ? (
                          <><Eye className="h-3 w-3 mr-1" /> Active</>
                        ) : (
                          <><EyeOff className="h-3 w-3 mr-1" /> Inactive</>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Order: {category.sort_order}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(category)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(category.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {category.description && (
              <CardContent className="pt-0">
                <CardDescription>{category.description}</CardDescription>
              </CardContent>
            )}
          </Card>
        ))}

        {categories?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No blog categories yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first blog category to organize your articles
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Category
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <BlogCategoryDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingCategory(null);
          }
        }}
        category={editingCategory}
        onSubmit={editingCategory ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};