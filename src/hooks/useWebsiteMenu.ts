import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WebsiteMenuItem {
  id: string;
  menu_key: string;
  label: string;
  url?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  target: string;
  icon_name?: string;
  children?: WebsiteMenuItem[];
}

export const useWebsiteMenu = () => {
  return useQuery({
    queryKey: ['website-menu'],
    queryFn: async (): Promise<WebsiteMenuItem[]> => {
      const { data, error } = await supabase
        .from('website_menu')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      // Build hierarchical structure
      const menuMap = new Map<string, WebsiteMenuItem>();
      const rootItems: WebsiteMenuItem[] = [];

      // First pass: create map of all items
      data.forEach(item => {
        menuMap.set(item.id, { ...item, children: [] });
      });

      // Second pass: build hierarchy
      data.forEach(item => {
        const menuItem = menuMap.get(item.id);
        if (!menuItem) return;

        if (item.parent_id) {
          const parent = menuMap.get(item.parent_id);
          if (parent) {
            parent.children = parent.children || [];
            parent.children.push(menuItem);
          }
        } else {
          rootItems.push(menuItem);
        }
      });

      return rootItems;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};