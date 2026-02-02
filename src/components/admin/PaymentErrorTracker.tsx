import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentError {
  id: string;
  error_code: string;
  error_message: string;
  error_context: any;
  user_id?: string;
  order_id?: string;
  transaction_reference?: string;
  severity: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export const PaymentErrorTracker: React.FC = () => {
  const [errors, setErrors] = useState<PaymentError[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('payment_error_tracking')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setErrors((data || []) as PaymentError[]);
    } catch (error) {
      console.error('Failed to load payment errors:', error);
      toast({
        title: "Error",
        description: "Failed to load payment errors",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveError = async (errorId: string, notes: string) => {
    try {
      setResolving(errorId);
      const { error } = await (supabase as any)
        .from('payment_error_tracking')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: notes
        })
        .eq('id', errorId);

      if (error) throw error;

      setErrors(prev => prev.map(err => 
        err.id === errorId 
          ? { ...err, resolved: true, resolved_at: new Date().toISOString(), resolution_notes: notes }
          : err
      ));

      toast({
        title: "Error Resolved",
        description: "Payment error has been marked as resolved",
      });
    } catch (error) {
      console.error('Failed to resolve error:', error);
      toast({
        title: "Resolution Failed",
        description: "Failed to resolve payment error",
        variant: "destructive",
      });
    } finally {
      setResolving(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  const filteredErrors = errors.filter(error => {
    const matchesSearch = !searchTerm || 
      error.error_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.error_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      error.transaction_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSeverity = severityFilter === 'all' || error.severity === severityFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'resolved' && error.resolved) ||
      (statusFilter === 'unresolved' && !error.resolved);

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Error Tracker</CardTitle>
          <CardDescription>Loading payment errors...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Payment Error Tracker
          </CardTitle>
          <CardDescription>
            Monitor and resolve payment-related errors
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search errors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="unresolved">Unresolved</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadErrors} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Error Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{errors.length}</div>
                <p className="text-xs text-muted-foreground">Total Errors</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-500">
                  {errors.filter(e => !e.resolved).length}
                </div>
                <p className="text-xs text-muted-foreground">Unresolved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-green-500">
                  {errors.filter(e => e.resolved).length}
                </div>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-orange-500">
                  {errors.filter(e => e.severity === 'critical' && !e.resolved).length}
                </div>
                <p className="text-xs text-muted-foreground">Critical</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Error List */}
      <div className="space-y-4">
        {filteredErrors.map((error) => (
          <ErrorCard
            key={error.id}
            error={error}
            onResolve={resolveError}
            isResolving={resolving === error.id}
            getSeverityColor={getSeverityColor}
          />
        ))}
        
        {filteredErrors.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Errors Found</h3>
              <p className="text-muted-foreground">
                {errors.length === 0 
                  ? "No payment errors recorded yet." 
                  : "No errors match your current filters."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

interface ErrorCardProps {
  error: PaymentError;
  onResolve: (errorId: string, notes: string) => void;
  isResolving: boolean;
  getSeverityColor: (severity: string) => string;
}

const ErrorCard: React.FC<ErrorCardProps> = ({ error, onResolve, isResolving, getSeverityColor }) => {
  const [showResolution, setShowResolution] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const handleResolve = () => {
    if (!resolutionNotes.trim()) {
      return;
    }
    onResolve(error.id, resolutionNotes);
    setShowResolution(false);
    setResolutionNotes('');
  };

  return (
    <Card className={error.resolved ? 'opacity-75' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{error.error_code}</CardTitle>
              <Badge variant={getSeverityColor(error.severity) as any}>
                {error.severity}
              </Badge>
              {error.resolved && (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  Resolved
                </Badge>
              )}
            </div>
            <CardDescription>
              {format(new Date(error.created_at), 'PPpp')}
              {error.transaction_reference && (
                <span className="ml-2">• Ref: {error.transaction_reference}</span>
              )}
            </CardDescription>
          </div>
          {!error.resolved && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolution(!showResolution)}
            >
              Resolve
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Error Message</h4>
            <p className="text-sm bg-muted p-3 rounded">{error.error_message}</p>
          </div>

          {error.error_context && Object.keys(error.error_context).length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Context</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                {JSON.stringify(error.error_context, null, 2)}
              </pre>
            </div>
          )}

          {error.resolved && error.resolution_notes && (
            <div>
              <h4 className="font-medium mb-2">Resolution</h4>
              <p className="text-sm bg-green-50 border border-green-200 p-3 rounded">
                {error.resolution_notes}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Resolved on {format(new Date(error.resolved_at!), 'PPpp')}
              </p>
            </div>
          )}

          {showResolution && !error.resolved && (
            <div className="border-t pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Resolution Notes</label>
                <Textarea
                  placeholder="Describe how this error was resolved..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleResolve}
                  disabled={!resolutionNotes.trim() || isResolving}
                  size="sm"
                >
                  {isResolving ? 'Resolving...' : 'Mark as Resolved'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowResolution(false)}
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};