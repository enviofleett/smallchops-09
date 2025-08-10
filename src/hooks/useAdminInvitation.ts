
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateSecureToken } from '@/utils/crypto';

export interface AdminInvitationWithToken {
  id: string;
  email: string;
  role: 'admin' | 'manager';
  status: string;
  invited_at: string;
  expires_at: string;
  invited_by: string;
  invitation_token?: string;
  invitation_link?: string;
}

export const useAdminInvitation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      // Get the current invitation
      const { data: invitation, error: fetchError } = await supabase
        .from('admin_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (fetchError) throw fetchError;

      // Generate new token and update invitation using cryptographically secure randomness
      const newToken = generateSecureToken(64);
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + 7);

      const { error: updateError } = await supabase
        .from('admin_invitations')
        .update({
          invitation_token: newToken,
          expires_at: newExpiryDate.toISOString(),
          status: 'pending',
        })
        .eq('id', invitationId);

      if (updateError) throw updateError;

      // Trigger email sending
      const { error: emailError } = await supabase
        .from('communication_events')
        .insert({
          event_type: 'admin_invitation_resend',
          recipient_email: invitation.email,
          template_key: 'admin_invitation',
          template_variables: {
            companyName: 'Your Company',
            role: invitation.role.toUpperCase(),
            setupUrl: `${window.location.origin}/admin/setup?token=${newToken}`,
            expiryDate: newExpiryDate.toLocaleDateString(),
            supportEmail: 'support@yourcompany.com',
          },
          email_type: 'transactional',
          status: 'queued',
        });

      if (emailError) throw emailError;

      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Invitation Resent",
        description: "The admin invitation has been resent successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resend invitation",
        variant: "destructive",
      });
    },
  });

  // Generate invitation link
  const generateInvitationLink = async (invitationId: string): Promise<string | null> => {
    try {
      const { data: invitation, error } = await supabase
        .from('admin_invitations')
        .select('invitation_token')
        .eq('id', invitationId)
        .single();

      if (error) {
        console.error('Failed to fetch invitation:', error);
        return null;
      }

      if (invitation && 'invitation_token' in invitation && invitation.invitation_token) {
        return `${window.location.origin}/admin/setup?token=${invitation.invitation_token}`;
      }
      return null;
    } catch (error) {
      console.error('Failed to generate invitation link:', error);
      return null;
    }
  };

  // Copy invitation link to clipboard with robust fallback
  const copyInvitationLink = async (invitationId: string) => {
    const link = await generateInvitationLink(invitationId);
    if (!link) {
      toast({
        title: "Error",
        description: "Failed to generate invitation link",
        variant: "destructive",
      });
      return;
    }

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        // Fallback for insecure contexts or blocked clipboard
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({
        title: "Link Copied",
        description: "Invitation link copied to clipboard.",
      });
    } catch (err) {
      console.warn('Clipboard API failed, showing link for manual copy:', err);
      // As a last resort, prompt the user
      window.prompt('Copy the invitation link:', link);
      toast({
        title: "Link Ready",
        description: "Copy the link from the prompt.",
      });
    }
  };

  return {
    resendInvitation: resendInvitationMutation.mutate,
    isResending: resendInvitationMutation.isPending,
    generateInvitationLink,
    copyInvitationLink,
  };
};
