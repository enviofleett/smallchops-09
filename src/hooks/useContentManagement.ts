
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from './useErrorHandler';

export interface SiteContent {
  id: string;
  content_type: 'about_us' | 'terms_of_service' | 'privacy_policy' | 'contact_info' | 'faq' | 'help_center';
  title: string;
  content: string;
  slug: string;
  is_published: boolean;
  version: number;
  seo_title?: string;
  seo_description?: string;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  unpublished_at?: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version: number;
  title: string;
  content: string;
  changed_by?: string;
  created_at: string;
  change_summary?: string;
}

const CONTENT_MANAGEMENT_URL = `https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/content-management`;

export const useContentManagement = () => {
  const { handleError, handleSuccess } = useErrorHandler();
  const queryClient = useQueryClient();

  const fetchContent = async (): Promise<SiteContent[]> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authentication session');
    }

    const response = await fetch(CONTENT_MANAGEMENT_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch content');
    }

    const result = await response.json();
    return result.data || [];
  };

  const fetchContentById = async (id: string, includeVersions = false): Promise<{ content: SiteContent; versions?: ContentVersion[] }> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authentication session');
    }

    const url = new URL(CONTENT_MANAGEMENT_URL);
    url.searchParams.set('id', id);
    if (includeVersions) {
      url.searchParams.set('versions', 'true');
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch content');
    }

    const result = await response.json();
    return { content: result.data, versions: result.versions };
  };

  const createContent = async (contentData: Partial<SiteContent>): Promise<SiteContent> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authentication session');
    }

    const response = await fetch(CONTENT_MANAGEMENT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create content');
    }

    const result = await response.json();
    return result.data;
  };

  const updateContent = async ({ id, ...contentData }: Partial<SiteContent> & { id: string }): Promise<SiteContent> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authentication session');
    }

    const url = new URL(CONTENT_MANAGEMENT_URL);
    url.searchParams.set('id', id);

    const response = await fetch(url.toString(), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contentData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update content');
    }

    const result = await response.json();
    return result.data;
  };

  const deleteContent = async (id: string): Promise<void> => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No authentication session');
    }

    const url = new URL(CONTENT_MANAGEMENT_URL);
    url.searchParams.set('id', id);

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete content');
    }
  };

  // Queries
  const useContentList = () => {
    return useQuery({
      queryKey: ['content-list'],
      queryFn: fetchContent,
    });
  };

  const useContentById = (id: string, includeVersions = false) => {
    return useQuery({
      queryKey: ['content', id, includeVersions],
      queryFn: () => fetchContentById(id, includeVersions),
      enabled: !!id,
    });
  };

  // Mutations
  const useCreateContent = () => {
    return useMutation({
      mutationFn: createContent,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['content-list'] });
        handleSuccess('Content created successfully');
      },
      onError: (error: any) => {
        handleError(error, 'creating content');
      },
    });
  };

  const useUpdateContent = () => {
    return useMutation({
      mutationFn: updateContent,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['content-list'] });
        queryClient.invalidateQueries({ queryKey: ['content', data.id] });
        handleSuccess('Content updated successfully');
      },
      onError: (error: any) => {
        handleError(error, 'updating content');
      },
    });
  };

  const useDeleteContent = () => {
    return useMutation({
      mutationFn: deleteContent,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['content-list'] });
        handleSuccess('Content deleted successfully');
      },
      onError: (error: any) => {
        handleError(error, 'deleting content');
      },
    });
  };

  return {
    useContentList,
    useContentById,
    useCreateContent,
    useUpdateContent,
    useDeleteContent,
  };
};
