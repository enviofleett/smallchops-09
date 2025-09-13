import { useUploadRateLimit } from '@/hooks/useUploadRateLimit';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

export const UploadRateLimitStatus = () => {
  const { rateLimitStatus, isChecking, checkRateLimit, getRateLimitMessage } = useUploadRateLimit();

  if (!rateLimitStatus && !isChecking) {
    return null;
  }

  return (
    <Card className="mb-4">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {rateLimitStatus?.allowed ? (
              <CheckCircle className="h-5 w-5 text-success" />
            ) : (
              <AlertCircle className="h-5 w-5 text-warning" />
            )}
            <div>
              <p className="text-sm font-medium">Upload Status</p>
              <p className="text-xs text-muted-foreground">
                {isChecking 
                  ? 'Checking upload limits...' 
                  : rateLimitStatus 
                    ? getRateLimitMessage(rateLimitStatus)
                    : 'Unable to check upload limits'
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rateLimitStatus && (
              <Badge variant={rateLimitStatus.allowed ? 'default' : 'destructive'}>
                {rateLimitStatus.user_role === 'admin' ? 'Admin' : 'User'} Account
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={checkRateLimit}
              disabled={isChecking}
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};