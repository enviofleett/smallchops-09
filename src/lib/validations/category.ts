
import { z } from "zod";
import DOMPurify from 'dompurify';

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100, "Category name must be less than 100 characters"),
  description: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

export const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (html: string): string => {
  return DOMPurify.sanitize(html);
};
