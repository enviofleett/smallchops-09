import { supabase } from "@/integrations/supabase/client";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  banner_url?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogArticle {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  featured_image_url?: string;
  banner_url?: string;
  status: 'draft' | 'published' | 'archived';
  category_id?: string;
  author_id?: string;
  published_at?: string;
  scheduled_for?: string;
  view_count: number;
  tags: string[];
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  created_at: string;
  updated_at: string;
  blog_categories?: BlogCategory;
}

// Blog Categories API
export const blogCategoriesApi = {
  getAll: async (): Promise<BlogCategory[]> => {
    const { data, error } = await (supabase as any)
      .from('blog_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<BlogCategory> => {
    const { data, error } = await (supabase as any)
      .from('blog_categories')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  create: async (category: Omit<BlogCategory, 'id' | 'created_at' | 'updated_at'>): Promise<BlogCategory> => {
    const { data, error } = await (supabase as any)
      .from('blog_categories')
      .insert([category])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<BlogCategory>): Promise<BlogCategory> => {
    const { data, error } = await (supabase as any)
      .from('blog_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await (supabase as any)
      .from('blog_categories')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }
};

// Blog Articles API
export const blogArticlesApi = {
  getAll: async (filters?: { status?: string; category_id?: string; limit?: number; offset?: number }): Promise<BlogArticle[]> => {
    let query = (supabase as any)
      .from('blog_articles')
      .select(`
        *,
        blog_categories (
          id,
          name,
          slug
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string): Promise<BlogArticle> => {
    const { data, error } = await (supabase as any)
      .from('blog_articles')
      .select(`
        *,
        blog_categories (
          id,
          name,
          slug
        )
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  getBySlug: async (slug: string): Promise<BlogArticle> => {
    const { data, error } = await (supabase as any)
      .from('blog_articles')
      .select(`
        *,
        blog_categories (
          id,
          name,
          slug
        )
      `)
      .eq('slug', slug)
      .single();
    
    if (error) throw error;
    return data;
  },

  create: async (article: Omit<BlogArticle, 'id' | 'created_at' | 'updated_at' | 'view_count' | 'blog_categories'>): Promise<BlogArticle> => {
    const { data, error } = await (supabase as any)
      .from('blog_articles')
      .insert([article])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Partial<BlogArticle>): Promise<BlogArticle> => {
    const { data, error } = await (supabase as any)
      .from('blog_articles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await (supabase as any)
      .from('blog_articles')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  incrementViewCount: async (id: string): Promise<void> => {
    const { data: current } = await (supabase as any)
      .from('blog_articles')
      .select('view_count')
      .eq('id', id)
      .single();
    
    const { error } = await (supabase as any)
      .from('blog_articles')
      .update({ view_count: (current?.view_count || 0) + 1 })
      .eq('id', id);
    if (error) throw error;
  }
};

// Utility functions
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
};
