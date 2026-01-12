import { supabase } from '@/integrations/supabase/client';

export interface AdminInvitationStats {
  total_invitations: number;
  pending_invitations: number;
  accepted_invitations: number;
  expired_invitations: number;
}

export const getAdminInvitationStats = async (): Promise<AdminInvitationStats> => {
  const { data, error } = await (supabase as any)
    .from('admin_invitations')
    .select('status, expires_at, accepted_at');

  if (error) {
    console.error('Error fetching invitation stats:', error);
    throw new Error(error.message);
  }

  const now = new Date();
  
  const stats = (data || []).reduce(
    (acc: AdminInvitationStats, invitation: any) => {
      acc.total_invitations++;
      
      if (invitation.accepted_at) {
        acc.accepted_invitations++;
      } else if (new Date(invitation.expires_at) < now) {
        acc.expired_invitations++;
      } else if (invitation.status === 'pending') {
        acc.pending_invitations++;
      }
      
      return acc;
    },
    {
      total_invitations: 0,
      pending_invitations: 0,
      accepted_invitations: 0,
      expired_invitations: 0,
    }
  );

  return stats;
};

export const cleanupExpiredInvitations = async (): Promise<{ deleted_count: number }> => {
  const { data, error } = await (supabase as any)
    .from('admin_invitations')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'pending')
    .select('id');

  if (error) {
    console.error('Error cleaning up expired invitations:', error);
    throw new Error(error.message);
  }

  return { deleted_count: data?.length || 0 };
};

export const revokeInvitation = async (invitationId: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('admin_invitations')
    .update({ 
      status: 'revoked',
      invitation_token: null,
    })
    .eq('id', invitationId);

  if (error) {
    console.error('Error revoking invitation:', error);
    throw new Error(error.message);
  }
};
