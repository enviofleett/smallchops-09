import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAdminInvitationStats, cleanupExpiredInvitations } from '@/api/adminInvitations';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, CheckCircle2, XCircle } from 'lucide-react';

export const AdminInvitationStats = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-invitation-stats'],
    queryFn: getAdminInvitationStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const cleanupMutation = useMutation({
    mutationFn: cleanupExpiredInvitations,
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: `Removed ${data.deleted_count} expired invitations`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-invitation-stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: any) => {
      toast({
        title: "Cleanup Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Invitation Statistics</span>
        </CardTitle>
        <CardDescription>
          Overview of admin invitation status and management
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <Badge variant="outline">
                {stats?.total_invitations || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>Pending</span>
              </span>
              <Badge variant="default">
                {stats?.pending_invitations || 0}
              </Badge>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center space-x-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Accepted</span>
              </span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {stats?.accepted_invitations || 0}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center space-x-1">
                <XCircle className="h-3 w-3" />
                <span>Expired</span>
              </span>
              <Badge variant="destructive">
                {stats?.expired_invitations || 0}
              </Badge>
            </div>
          </div>
        </div>

        {stats && stats.expired_invitations > 0 && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              className="w-full"
            >
              {cleanupMutation.isPending 
                ? "Cleaning up..." 
                : `Remove ${stats.expired_invitations} Expired Invitations`
              }
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>• Invitations expire after 7 days</p>
          <p>• Pending invitations can be resent or copied</p>
          <p>• Expired invitations should be cleaned up regularly</p>
        </div>
      </CardContent>
    </Card>
  );
};