import { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Palette } from 'lucide-react';
import { BusinessSettingsFormData } from '../BusinessSettingsTab';

interface BrandColorsSectionProps {
  form: UseFormReturn<BusinessSettingsFormData>;
}

const colorFields = [
  {
    name: 'primary_color' as const,
    label: 'Primary Color',
    description: 'Main brand color used for buttons and key elements',
  },
  {
    name: 'secondary_color' as const,
    label: 'Secondary Color',
    description: 'Supporting color for secondary elements',
  },
  {
    name: 'accent_color' as const,
    label: 'Accent Color',
    description: 'Highlight color for special elements and CTAs',
  },
];

export const BrandColorsSection = ({ form }: BrandColorsSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Colors
        </CardTitle>
        <CardDescription>
          Define your brand color palette. These colors are used throughout the website and emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-3">
          {colorFields.map((colorField) => {
            const colorValue = form.watch(colorField.name) || '#000000';
            
            return (
              <FormField
                key={colorField.name}
                control={form.control}
                name={colorField.name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{colorField.label}</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <div 
                          className="w-10 h-10 rounded-md border shadow-sm shrink-0 cursor-pointer relative overflow-hidden"
                          style={{ backgroundColor: colorValue }}
                        >
                          <input
                            type="color"
                            value={colorValue}
                            onChange={(e) => field.onChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        </div>
                        <Input 
                          {...field}
                          value={field.value || ''}
                          placeholder="#3b82f6"
                          className="bg-background font-mono text-sm"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      {colorField.description}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            );
          })}
        </div>

        {/* Color Preview */}
        <div className="mt-6 p-4 rounded-lg border bg-muted/30">
          <p className="text-sm font-medium text-muted-foreground mb-3">Preview</p>
          <div className="flex flex-wrap gap-3">
            <div 
              className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm"
              style={{ backgroundColor: form.watch('primary_color') || '#3b82f6' }}
            >
              Primary Button
            </div>
            <div 
              className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm"
              style={{ backgroundColor: form.watch('secondary_color') || '#1e40af' }}
            >
              Secondary Button
            </div>
            <div 
              className="px-4 py-2 rounded-md text-white text-sm font-medium shadow-sm"
              style={{ backgroundColor: form.watch('accent_color') || '#f59e0b' }}
            >
              Accent Button
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
