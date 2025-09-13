import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MessageSquare, DollarSign, TrendingUp, AlertTriangle, Phone, Clock, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface SMSMetrics {
  total_sent: number
  total_failed: number
  total_cost: number
  success_rate: number
  recent_activity: Array<{
    id: string
    phone_number: string
    status: string
    cost_amount: number
    timestamp: string
    message_content: string
  }>
}

interface ProviderStatus {
  provider_name: string
  is_active: boolean
  wallet_balance: number
  last_balance_check: string
  settings: any
}

export default function SMSDashboard() {
  const [metrics, setMetrics] = useState<SMSMetrics | null>(null)
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [balanceAlert, setBalanceAlert] = useState<'low' | 'critical' | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadSMSMetrics(),
        loadProviderStatus()
      ])
    } catch (error) {
      console.error('Error loading SMS dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSMSMetrics = async () => {
    try {
      // Get SMS delivery logs for metrics
      const { data: deliveryLogs, error } = await supabase
        .from('sms_delivery_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error loading SMS metrics:', error)
        return
      }

      if (deliveryLogs) {
        const totalSent = deliveryLogs.filter(log => log.status === 'sent' || log.status === 'delivered').length
        const totalFailed = deliveryLogs.filter(log => log.status === 'failed').length
        const totalCost = deliveryLogs.reduce((sum, log) => sum + (log.cost_amount || 0), 0)
        const successRate = deliveryLogs.length > 0 ? (totalSent / deliveryLogs.length) * 100 : 0

        setMetrics({
          total_sent: totalSent,
          total_failed: totalFailed,
          total_cost: totalCost,
          success_rate: successRate,
          recent_activity: deliveryLogs.slice(0, 10)
        })
      }
    } catch (error) {
      console.error('Error loading SMS metrics:', error)
    }
  }

  const loadProviderStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('sms_provider_settings')
        .select('*')
        .eq('provider_name', 'mysmstab')
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading provider status:', error)
        return
      }

      if (data) {
        setProviderStatus(data)
        
        // Check balance alerts
        const balance = data.wallet_balance || 0
        if (balance <= 10) {
          setBalanceAlert('critical')
        } else if (balance <= 50) {
          setBalanceAlert('low')
        }
      }
    } catch (error) {
      console.error('Error loading provider status:', error)
    }
  }

  const refreshBalance = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('business-settings', {
        body: { action: 'check_sms_balance' }
      })

      if (error) {
        throw error
      }

      if (data.success) {
        setProviderStatus(prev => prev ? {
          ...prev,
          wallet_balance: data.balance,
          last_balance_check: new Date().toISOString()
        } : null)
      }
    } catch (error) {
      console.error('Error refreshing balance:', error)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount)
  }

  const formatPhone = (phone: string) => {
    if (phone.length > 8) {
      return phone.substring(0, 4) + '***' + phone.substring(phone.length - 3)
    }
    return phone
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-8 bg-muted rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Balance Alerts */}
      {balanceAlert && (
        <Alert className={balanceAlert === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}>
          <AlertTriangle className={`h-4 w-4 ${balanceAlert === 'critical' ? 'text-red-600' : 'text-amber-600'}`} />
          <AlertDescription className={balanceAlert === 'critical' ? 'text-red-800' : 'text-amber-800'}>
            <strong>
              {balanceAlert === 'critical' ? 'Critical:' : 'Warning:'} Low SMS Balance
            </strong>
            <br />
            Your SMS wallet balance is {balanceAlert === 'critical' ? 'critically low' : 'running low'}. 
            Please top up to avoid service interruption.
          </AlertDescription>
        </Alert>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_sent || 0}</div>
            <p className="text-xs text-muted-foreground">
              Last 100 transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.success_rate.toFixed(1) || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Delivery success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics?.total_cost || 0)}</div>
            <p className="text-xs text-muted-foreground">
              SMS spend (recent)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(providerStatus?.wallet_balance || 0)}
            </div>
            <Button 
              variant="link" 
              size="sm" 
              onClick={refreshBalance}
              className="text-xs p-0 h-auto text-muted-foreground"
            >
              Refresh balance
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Provider Status */}
      <Card>
        <CardHeader>
          <CardTitle>SMS Provider Status</CardTitle>
          <CardDescription>
            Current status of your SMS service provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          {providerStatus ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium">Provider</p>
                <p className="text-sm text-muted-foreground">MySmstab.com</p>
              </div>
              <div>
                <p className="text-sm font-medium">Status</p>
                <Badge variant={providerStatus.is_active ? 'default' : 'destructive'}>
                  {providerStatus.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Last Balance Check</p>
                <p className="text-sm text-muted-foreground">
                  {providerStatus.last_balance_check 
                    ? new Date(providerStatus.last_balance_check).toLocaleString()
                    : 'Never'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Rate Limit</p>
                <p className="text-sm text-muted-foreground">
                  {providerStatus.settings?.rate_limit_per_minute || 60} SMS/minute
                </p>
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                SMS provider not configured. Please configure your SMS settings.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent SMS Activity</CardTitle>
          <CardDescription>
            Latest SMS deliveries and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.recent_activity && metrics.recent_activity.length > 0 ? (
            <div className="space-y-4">
              {metrics.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {activity.status === 'sent' || activity.status === 'delivered' ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium">{formatPhone(activity.phone_number)}</p>
                      <p className="text-sm text-muted-foreground truncate max-w-[300px]">
                        {activity.message_content}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={
                      activity.status === 'sent' || activity.status === 'delivered' 
                        ? 'default' 
                        : 'destructive'
                    }>
                      {activity.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                    {activity.cost_amount && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(activity.cost_amount)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SMS activity yet</p>
              <p className="text-sm">SMS deliveries will appear here once you start sending messages</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}