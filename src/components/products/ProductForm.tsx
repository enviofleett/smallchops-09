import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { ImageUpload } from '@/components/ui/image-upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { FeaturesList } from './FeaturesList';
import { ProductFormData, productSchema } from '@/lib/validations/product';
import { Category, Product } from '@/types/database';
interface ProductFormProps {
  product?: Product;
  categories: Category[];
  onSubmit: (data: ProductFormData & {
    imageFile?: File;
  }) => Promise<void>;
  isLoading?: boolean;
}
export const ProductForm = ({
  product,
  categories,
  onSubmit,
  isLoading
}: ProductFormProps) => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      sku: product?.sku || '',
      price: product?.price || 0,
      stock_quantity: product?.stock_quantity || 0,
      category_id: product?.category_id || '',
      status: product?.status || 'draft',
      image_url: product?.image_url || '',
      features: Array.isArray(product?.features) ? product.features as string[] : [],
      is_promotional: Boolean(product?.is_promotional),
      preparation_time: typeof product?.preparation_time === 'number' ? product.preparation_time : undefined,
      allergen_info: Array.isArray(product?.allergen_info) ? product.allergen_info as string[] : []
    }
  });
  const handleSubmit = async (data: ProductFormData) => {
    await onSubmit({
      ...data,
      imageFile: imageFile || undefined
    });
  };
  return <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField control={form.control} name="name" render={({
            field
          }) => <FormItem>
                  <FormLabel>Product Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter product name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />

            <FormField control={form.control} name="sku" render={({
            field
          }) => <FormItem>
                  <FormLabel>SKU</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter SKU" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="price" render={({
              field
            }) => <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />

              <FormField control={form.control} name="stock_quantity" render={({
              field
            }) => <FormItem>
                    <FormLabel>Stock Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>} />
            </div>

            <FormField control={form.control} name="category_id" render={({
            field
          }) => <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(category => <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>} />

            <FormField control={form.control} name="status" render={({
            field
          }) => <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>} />

            <FormField control={form.control} name="is_promotional" render={({
            field
          }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Promotional Product</FormLabel>
                    <FormDescription>
                      Feature this product as promotional content
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>} />

            <FormField control={form.control} name="preparation_time" render={({
            field
          }) => <FormItem>
                  <FormLabel>Preparation Time (minutes)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter preparation time" {...field} onChange={e => field.onChange(parseInt(e.target.value) || undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>} />
          </div>

          <div className="space-y-4">
            <div>
              <Label>Product Image</Label>
              <ImageUpload value={form.watch('image_url')} onChange={setImageFile} className="mt-2" />
            </div>
          </div>
        </div>

        {/* Features Section */}
        <FormField control={form.control} name="features" render={({
        field
      }) => <FormItem>
              <FormLabel>Product Features</FormLabel>
              <FormDescription>
                Add key features and highlights for this product
              </FormDescription>
              <FormControl>
                <FeaturesList features={field.value} onChange={field.onChange} placeholder="Add a product feature..." />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        {/* Allergen Information */}
        <FormField control={form.control} name="allergen_info" render={({
        field
      }) => {}} />

        <FormField control={form.control} name="description" render={({
        field
      }) => <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <RichTextEditor value={field.value || ''} onChange={field.onChange} placeholder="Enter product description..." />
              </FormControl>
              <FormMessage />
            </FormItem>} />

        <div className="flex justify-end space-x-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Form>;
};