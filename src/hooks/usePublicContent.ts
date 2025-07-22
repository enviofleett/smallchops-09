
import { useQuery } from '@tanstack/react-query';

export interface PublicContent {
  id: string;
  content_type: string;
  title: string;
  content: string;
  slug: string;
  seo_title?: string;
  seo_description?: string;
  updated_at: string;
}

const PUBLIC_CONTENT_URL = `https://lpcviyjdsgghvuddthxr.supabase.co/functions/v1/content-management/public`;

export const usePublicContent = () => {
  const fetchPublicContent = async (type?: string, slug?: string): Promise<PublicContent[]> => {
    const url = new URL(PUBLIC_CONTENT_URL);
    if (type) url.searchParams.set('type', type);
    if (slug) url.searchParams.set('slug', slug);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch public content');
    }

    const result = await response.json();
    return result.data || [];
  };

  const usePublicContentByType = (type: string) => {
    return useQuery({
      queryKey: ['public-content', type],
      queryFn: () => fetchPublicContent(type),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const usePublicContentBySlug = (slug: string) => {
    return useQuery({
      queryKey: ['public-content-slug', slug],
      queryFn: () => fetchPublicContent(undefined, slug),
      enabled: !!slug,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const useAllPublicContent = () => {
    return useQuery({
      queryKey: ['public-content-all'],
      queryFn: () => fetchPublicContent(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return {
    usePublicContentByType,
    usePublicContentBySlug,
    useAllPublicContent,
  };
};
