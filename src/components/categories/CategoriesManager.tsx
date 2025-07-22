import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categories';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, PlusCircle, Edit, Trash2 } from 'lucide-react';
import { Category } from '@/types/database';
import { CategoryFormData, generateSlug } from '@/lib/validations/category';
import CategoryDialog from './CategoryDialog';
import DeleteCategoryDialog from './DeleteCategoryDialog';
import { useToast } from '@/hooks/use-toast';

const CategoriesManager = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories, isLoading, isError, error } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: getCategories
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsAddDialogOpen(false);
      toast({
        title: "Success",
        description: "Category created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create category: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Category> & { bannerFile?: File } }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategory(null);
      toast({
        title: "Success",
        description: "Category updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update category: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeletingCategory(null);
      toast({
        title: "Success",
        description: "Category deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete category: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const handleCreateCategory = (data: CategoryFormData & { bannerFile?: File }) => {
    const slug = generateSlug(data.name);
    createMutation.mutate({
      name: data.name,
      slug: slug,
      description: data.description || null,
      bannerFile: data.bannerFile,
    });
  };

  const handleUpdateCategory = (data: CategoryFormData & { bannerFile?: File }) => {
    if (!editingCategory) return;
    
    const slug = generateSlug(data.name);
    updateMutation.mutate({
      id: editingCategory.id,
      data: {
        name: data.name,
        slug: slug,
        description: data.description || null,
        bannerFile: data.bannerFile,
      },
    });
  };

  const handleDeleteCategory = () => {
    if (!deletingCategory) return;
    deleteMutation.mutate(deletingCategory.id);
  };

  const renderDescription = (description: string | null) => {
    if (!description) return 'No description';
    
    // Strip HTML tags for table display
    const plainText = description.replace(/<[^>]*>/g, '');
    return plainText.length > 100 ? `${plainText.substring(0, 100)}...` : plainText;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-1">
        <div className="flex justify-end">
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Banner</TableHead>
                <TableHead className="w-1/4">Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-1/6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-12 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-[124px] ml-auto" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to fetch categories: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="p-1">
      <div className="flex justify-end mb-4">
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Banner</TableHead>
              <TableHead className="w-1/4">Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-1/6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  No categories found. Create your first category to get started.
                </TableCell>
              </TableRow>
            ) : (
              categories?.map((category) => (
                <TableRow key={category.id}>
                  <TableCell>
                    {category.banner_url ? (
                      <img
                        src={category.banner_url}
                        alt={category.name}
                        className="w-16 h-12 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-16 h-12 bg-gray-100 rounded border flex items-center justify-center">
                        <span className="text-xs text-gray-400">No image</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {renderDescription(category.description)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mr-2"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => setDeletingCategory(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Category Dialog */}
      <CategoryDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreateCategory}
        isLoading={createMutation.isPending}
      />

      {/* Edit Category Dialog */}
      <CategoryDialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        category={editingCategory || undefined}
        onSubmit={handleUpdateCategory}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Category Dialog */}
      <DeleteCategoryDialog
        open={!!deletingCategory}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        category={deletingCategory}
        onConfirm={handleDeleteCategory}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default CategoriesManager;
