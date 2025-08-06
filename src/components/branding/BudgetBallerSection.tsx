import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Save, Palette } from 'lucide-react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';

interface BudgetBallerItem {
  name: string;
  included: boolean;
}

interface BudgetBallerContent {
  id: string;
  title: string;
  description?: string;
  items: BudgetBallerItem[];
  background_color?: string;
  text_color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const BudgetBallerSection = ({ className }: { className?: string }) => {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('The Budget Baller');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<BudgetBallerItem[]>([
    { name: '5 Samosa', included: true },
    { name: '5 Spring Rolls', included: true },
    { name: '5 Stick Meat', included: true },
    { name: '20 Poff-Poff', included: true },
  ]);
  const [backgroundColor, setBackgroundColor] = useState('#f59e0b');
  const [textColor, setTextColor] = useState('#1f2937');
  const [isActive, setIsActive] = useState(true);

  // Fetch budget baller content
  const { data: budgetBaller, isLoading } = useQuery({
    queryKey: ['budget-baller-content'],
    queryFn: async () => {
      const { data, error } = await supabase
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

  // Load data when fetched
  useEffect(() => {
    if (budgetBaller) {
      const budgetItems = Array.isArray(budgetBaller.items) 
        ? (budgetBaller.items as unknown as BudgetBallerItem[])
        : [
            { name: '5 Samosa', included: true },
            { name: '5 Spring Rolls', included: true },
            { name: '5 Stick Meat', included: true },
            { name: '20 Poff-Poff', included: true },
          ];
      
      setTitle(budgetBaller.title);
      setDescription(budgetBaller.description || '');
      setItems(budgetItems);
      setBackgroundColor(budgetBaller.background_color || '#f59e0b');
      setTextColor(budgetBaller.text_color || '#1f2937');
      setIsActive(budgetBaller.is_active);
    }
  }, [budgetBaller]);

  // Save budget baller content mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title,
        description,
        items: items as any, // Cast to JSON for database storage
        background_color: backgroundColor,
        text_color: textColor,
        is_active: isActive,
      };

      if (budgetBaller?.id) {
        // Update existing
        const { error } = await supabase
          .from('budget_baller_content')
          .update(data)
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
          .insert(data);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-baller-content'] });
      toast.success('Budget Baller content updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to save Budget Baller content', {
        description: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const addItem = () => {
    setItems([...items, { name: '', included: true }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof BudgetBallerItem, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  return (
    <Card className={className}>
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
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Budget Baller"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Active</Label>
              <Switch
                id="active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional description text"
            />
          </div>

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
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Input
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    placeholder="Item name (e.g., 5 Samosa)"
                    className="flex-1"
                  />
                  
                  <Switch
                    checked={item.included}
                    onCheckedChange={(checked) => updateItem(index, 'included', checked)}
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    disabled={items.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bg-color">Background Color</Label>
              <div className="flex gap-2">
                <Input
                  id="bg-color"
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-16"
                />
                <Input
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  placeholder="#f59e0b"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="text-color">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="text-color"
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-16"
                />
                <Input
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  placeholder="#1f2937"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-4">
              <div 
                className="max-w-sm mx-auto p-4 rounded-2xl shadow-lg"
                style={{ backgroundColor: backgroundColor }}
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
                      style={{ color: textColor }}
                    >
                      {title}
                    </h3>
                  </div>
                </div>
                <div className="space-y-2">
                  {items.filter(item => item.included).map((item, index) => (
                    <div 
                      key={index}
                      className="text-sm text-center py-1 border-b border-dotted border-opacity-30"
                      style={{ 
                        color: textColor,
                        borderColor: textColor
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
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Saving..' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};