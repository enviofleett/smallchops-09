import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Save, Palette } from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

const budgetBallerItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  included: z.boolean().default(true),
});

const budgetBallerSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  items: z.array(budgetBallerItemSchema).min(1, 'At least one item is required'),
  background_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format').optional(),
  text_color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid color format').optional(),
  is_active: z.boolean().default(true),
});

type BudgetBallerFormData = z.infer<typeof budgetBallerSchema>;

interface BudgetBallerContent {
  id: string;
  title: string;
  description?: string;
  items: any; // JSONB field from database
  background_color?: string;
  text_color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const BudgetBallerManager = () => {
  const queryClient = useQueryClient();
  
  const form = useForm<BudgetBallerFormData>({
    resolver: zodResolver(budgetBallerSchema),
    defaultValues: {
      title: 'The Budget Baller',
      description: '',
      items: [
        { name: '5 Samosa', included: true },
        { name: '5 Spring Rolls', included: true },
        { name: '5 Stick Meat', included: true },
        { name: '20 Poff-Poff', included: true },
      ],
      background_color: '#f59e0b',
      text_color: '#1f2937',
      is_active: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  // Fetch budget baller content
  const { data: budgetBaller, isLoading } = useQuery({
    queryKey: ['budget-baller-content'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('budget_baller_content')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data ? { ...data, items: data.items || [] } : null;
    },
  });

  // Load data into form when fetched
  useEffect(() => {
    if (budgetBaller) {
      const items = Array.isArray(budgetBaller.items) 
        ? budgetBaller.items 
        : [
            { name: '5 Samosa', included: true },
            { name: '5 Spring Rolls', included: true },
            { name: '5 Stick Meat', included: true },
            { name: '20 Poff-Poff', included: true },
          ];
      
      form.reset({
        title: budgetBaller.title,
        description: budgetBaller.description || '',
        items: items as Array<{ name: string; included: boolean }>,
        background_color: budgetBaller.background_color || '#f59e0b',
        text_color: budgetBaller.text_color || '#1f2937',
        is_active: budgetBaller.is_active,
      });
    }
  }, [budgetBaller, form]);

  // Save budget baller content mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BudgetBallerFormData) => {
      if (budgetBaller?.id) {
        // Update existing
        const { error } = await supabase
          .from('budget_baller_content')
          .update({
            title: data.title,
            description: data.description,
            items: data.items,
            background_color: data.background_color,
            text_color: data.text_color,
            is_active: data.is_active,
          })
          .eq('id', budgetBaller.id);
        
        if (error) throw error;
      } else {
        // Create new (deactivate others first)
        await supabase
          .from('budget_baller_content')
          .update({ is_active: false })
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows
        
        const { error } = await supabase
          .from('budget_baller_content')
          .insert({
            title: data.title,
            description: data.description,
            items: data.items,
            background_color: data.background_color,
            text_color: data.text_color,
            is_active: data.is_active,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-baller-content'] });
      toast.success('Budget Baller content updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to save Budget Baller content', {
        description: error.message,
      });
    },
  });

  const handleSubmit = (data: BudgetBallerFormData) => {
    saveMutation.mutate(data);
  };

  const addItem = () => {
    append({ name: '', included: true });
  };

  const backgroundColor = form.watch('background_color');
  const textColor = form.watch('text_color');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Baller Section (Section B)</CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize the special offer section that appears alongside the hero images.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="The Budget Baller" />
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
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Additional description text" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Items Included</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
              
              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-3">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input {...field} placeholder="Item name (e.g., 5 Samosa)" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name={`items.${index}.included`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      disabled={fields.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="background_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Background Color</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="color" {...field} className="w-16" />
                      </FormControl>
                      <FormControl>
                        <Input {...field} placeholder="#f59e0b" className="flex-1" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="text_color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Text Color</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input type="color" {...field} className="w-16" />
                      </FormControl>
                      <FormControl>
                        <Input {...field} placeholder="#1f2937" className="flex-1" />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="border rounded-lg p-4">
                <div 
                  className="max-w-sm mx-auto p-4 rounded-2xl shadow-lg"
                  style={{ backgroundColor: backgroundColor || '#f59e0b' }}
                >
                  <div className="flex items-center justify-center mb-4">
                    <div 
                      className="px-4 py-2 rounded-full flex items-center space-x-2"
                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                    >
                      <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                        </svg>
                      </div>
                      <h3 
                        className="text-lg font-bold"
                        style={{ color: textColor || '#1f2937' }}
                      >
                        {form.watch('title')}
                      </h3>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {form.watch('items')?.filter(item => item.included).map((item, index) => (
                      <div 
                        key={index}
                        className="text-sm text-center py-1 border-b border-dotted border-opacity-30"
                        style={{ 
                          color: textColor || '#1f2937',
                          borderColor: textColor || '#1f2937'
                        }}
                      >
                        {item.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                  <Button type="submit" disabled={saveMutation.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              </Form>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};