
import { z } from 'zod';

export const productSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255, 'Product name must be less than 255 characters'),
  description: z.string().optional(),
  sku: z.string().optional(),
  price: z.number().min(0, 'Price must be a positive number'),
  stock_quantity: z.number().int().min(0, 'Stock quantity must be a non-negative integer'),
  category_id: z.string().uuid('Please select a valid category').optional(),
  status: z.enum(['active', 'archived', 'draft', 'discontinued']).default('draft'),
  image_url: z.string().url().optional().or(z.literal('')),
  features: z.array(z.string().min(1, 'Feature cannot be empty')).default([]),
  is_promotional: z.boolean().default(false),
  preparation_time: z.number().int().min(1, 'Preparation time must be at least 1 minute').optional(),
  allergen_info: z.array(z.string().min(1, 'Allergen info cannot be empty')).default([]),
});

export type ProductFormData = z.infer<typeof productSchema>;
