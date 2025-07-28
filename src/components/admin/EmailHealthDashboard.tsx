import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { useEmailMonitoring } from '@/hooks/useEmailMonitoring';

export const EmailHealthDashboard = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const { metrics, isLoading, error, refreshMetrics } = useEmailMonitoring(timeframe);

  const handleTimeframeChange = (newTimeframe: string) => {
    setTimeframe(newTimeframe);
    refreshMetrics(newTimeframe);
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 90) return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
    if (score >= 70) return <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
    return <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Email Health Dashboard</CardTitle>
          <CardDescription>Failed to load email metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button 
            onClick={() => refreshMetrics()} 
            className="mt-4"
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Email Health Dashboard</h2>
          <p className="text-muted-foreground">Monitor email delivery performance and health</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeframe} onValueChange={handleTimeframeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => refreshMetrics(timeframe)} 
            variant="outline" 
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!metrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded"></div>
                  <div className="h-8 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Health Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getHealthScoreIcon(metrics.healthScore)}
                Email Health Score
              </CardTitle>
              <CardDescription>Overall email system performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getHealthScoreColor(metrics.healthScore)}`}>
                  {metrics.healthScore}/100
                </div>
                <div className="flex-1">
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full ${
                        metrics.healthScore >= 90 ? 'bg-green-500' :
                        metrics.healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${metrics.healthScore}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {metrics.healthScore >= 90 ? 'Excellent' :
                     metrics.healthScore >= 70 ? 'Good' : 'Needs Attention'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalSent.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground">
                  Emails sent in {timeframe}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {metrics.deliveryRate.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {metrics.totalDelivered.toLocaleString()} delivered
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Bounce Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  metrics.bounceRate > 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {metrics.bounceRate.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {metrics.totalBounced.toLocaleString()} bounced
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Complaint Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  metrics.complaintRate > 0.5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {metrics.complaintRate.toFixed(2)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {metrics.totalComplained.toLocaleString()} complaints
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Issues and Recommendations */}
          {(metrics.issues.length > 0 || metrics.recommendations.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {metrics.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-5 w-5" />
                      Issues Found
                    </CardTitle>
                    <CardDescription>Problems that need attention</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.issues.map((issue, index) => (
                        <Badge key={index} variant="destructive" className="block w-fit">
                          {issue}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {metrics.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      Recommendations
                    </CardTitle>
                    <CardDescription>Suggested improvements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {metrics.recommendations.map((rec, index) => (
                        <div key={index} className="text-sm p-2 bg-muted rounded-md">
                          {rec}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Suppression Info */}
          <Card>
            <CardHeader>
              <CardTitle>Suppression List</CardTitle>
              <CardDescription>Email addresses that are suppressed from delivery</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalSuppressed.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">
                Addresses currently suppressed from receiving emails
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};