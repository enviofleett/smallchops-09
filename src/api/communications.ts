
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { CommunicationLogStatus } from '@/types/communications';

export type CommunicationLog = Tables<'communication_logs'>;

interface GetCommunicationLogsParams {
  page?: number;
  pageSize?: number;
  status?: CommunicationLogStatus | 'all';
  searchQuery?: string;
}

export const getCommunicationLogs = async ({
  page = 1,
  pageSize = 15,
  status = 'all',
  searchQuery = '',
}: GetCommunicationLogsParams): Promise<{ logs: CommunicationLog[]; count: number }> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('communication_logs')
    .select('*', { count: 'exact' });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (searchQuery) {
    const searchString = `%${searchQuery}%`;
    query = query.or(`recipient.ilike.${searchString},error_message.ilike.${searchString},order_id::text.ilike.${searchString}`);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching communication logs:', error);
    throw new Error(error.message);
  }

  return { logs: data || [], count: count || 0 };
};
