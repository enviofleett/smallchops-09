import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Eye, Calendar, User } from 'lucide-react';
import { blogArticlesApi, blogCategoriesApi, BlogArticle } from '@/api/blog';
import { BlogArticleDialog } from './BlogArticleDialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export const BlogArticlesManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<BlogArticle | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['blog-articles', statusFilter, categoryFilter],
    queryFn: () => blogArticlesApi.getAll({
      status: statusFilter === 'all' ? undefined : statusFilter,
      category_id: categoryFilter === 'all' ? undefined : categoryFilter,
    }),
  });

  const { data: categories } = useQuery({
    queryKey: ['blog-categories'],
    queryFn: blogCategoriesApi.getAll,
  });

  const createMutation = useMutation({
    mutationFn: blogArticlesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-articles'] });
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Blog article created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create blog article",
        variant: "destructive",
      });
      console.error('Create error:', error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<BlogArticle> }) =>
      blogArticlesApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-articles'] });
      setEditingArticle(null);
      setIsDialogOpen(false);
      toast({
        title: "Success",
        description: "Blog article updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update blog article",
        variant: "destructive",
      });
      console.error('Update error:', error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: blogArticlesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blog-articles'] });
      toast({
        title: "Success",
        description: "Blog article deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete blog article",
        variant: "destructive",
      });
      console.error('Delete error:', error);
    },
  });

  const handleCreate = (data: Omit<BlogArticle, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'blog_categories'>) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: Omit<BlogArticle, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'blog_categories'>) => {
    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, updates: data });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this blog article?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (article: BlogArticle) => {
    setEditingArticle({
      ...article,
      status: article.status as 'draft' | 'published' | 'archived'
    });
    setIsDialogOpen(true);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'published': return 'default';
      case 'draft': return 'secondary';
      case 'archived': return 'outline';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
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
          <p className="text-destructive">Failed to load blog articles. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Blog Articles</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage your blog content
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Article
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {articles?.map((article) => (
          <Card key={article.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {article.featured_image_url && (
                    <img
                      src={article.featured_image_url}
                      alt={article.title}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <CardTitle className="text-base">{article.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={getStatusBadgeVariant(article.status)}>
                        {article.status}
                      </Badge>
                      {article.blog_categories && (
                        <Badge variant="outline">{article.blog_categories.name}</Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {article.view_count}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(article.created_at), 'MMM dd, yyyy')}
                      </div>
                      {article.published_at && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Published {format(new Date(article.published_at), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(article as BlogArticle)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(article.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            {article.excerpt && (
              <CardContent className="pt-0">
                <CardDescription>{article.excerpt}</CardDescription>
              </CardContent>
            )}
          </Card>
        ))}

        {articles?.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-medium mb-2">No blog articles yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first blog article to start publishing content
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Article
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <BlogArticleDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingArticle(null);
          }
        }}
        article={editingArticle}
        categories={categories || []}
        onSubmit={editingArticle ? handleUpdate : handleCreate}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
};