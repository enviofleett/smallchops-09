import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Search, Download, Eye, Phone, MessageSquare, Clock, DollarSign } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface SMSLog {
  id: string
  communication_event_id: string
  phone_number: string
  message_content: string
  provider_message_id: string
  status: string
  provider_response: any
  cost_amount: number
  timestamp: string
}

export default function SMSLogsViewer() {
  const [logs, setLogs] = useState<SMSLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateRange, setDateRange] = useState<string>('today')
  const [selectedLog, setSelectedLog] = useState<SMSLog | null>(null)
  const { toast } = useToast()

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'sent', label: 'Sent' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'failed', label: 'Failed' },
    { value: 'bounced', label: 'Bounced' }
  ]

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'week', label: 'Last 7 days' },
    { value: 'month', label: 'Last 30 days' }
  ]

  useEffect(() => {
    loadLogs()
  }, [statusFilter, dateRange])

  const loadLogs = async () => {
    setIsLoading(true)
    try {
      let query = supabase
        .from('sms_delivery_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100)

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply date range filter
      const now = new Date()
      let startDate: Date
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          query = query.gte('timestamp', startDate.toISOString()).lt('timestamp', endDate.toISOString())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          query = query.gte('timestamp', startDate.toISOString())
          break
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          query = query.gte('timestamp', startDate.toISOString())
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      }

      if (dateRange !== 'yesterday') {
        query = query.gte('timestamp', startDate.toISOString())
      }

      const { data, error } = await query

      if (error) {
        console.error('Error loading SMS logs:', error)
        toast({
          title: 'Error Loading Logs',
          description: 'Failed to load SMS delivery logs',
          variant: 'destructive'
        })
        return
      }

      setLogs(data || [])
    } catch (error) {
      console.error('Error loading SMS logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const retryFailedSMS = async (logId: string) => {
    try {
      const { error } = await supabase.functions.invoke('sms-sender', {
        body: { retry_log_id: logId }
      })

      if (error) {
        throw error
      }

      toast({
        title: 'SMS Retry Queued',
        description: 'The SMS has been queued for retry',
      })

      await loadLogs()
    } catch (error: any) {
      toast({
        title: 'Retry Failed',
        description: error.message || 'Failed to retry SMS delivery',
        variant: 'destructive'
      })
    }
  }

  const exportLogs = async () => {
    try {
      const csvContent = [
        'Timestamp,Phone Number,Status,Cost,Message',
        ...filteredLogs.map(log => 
          `"${log.timestamp}","${log.phone_number}","${log.status}","${log.cost_amount || 0}","${log.message_content.replace(/"/g, '""')}"`
        )
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `sms-logs-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Export Complete',
        description: 'SMS logs have been exported to CSV',
      })
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export SMS logs',
        variant: 'destructive'
      })
    }
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.phone_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.message_content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.provider_message_id?.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesSearch
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">Sent</Badge>
      case 'delivered':
        return <Badge variant="default" className="bg-green-600">Delivered</Badge>
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>
      case 'bounced':
        return <Badge variant="destructive">Bounced</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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

  return (
    <div className="space-y-6">
      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS Delivery Logs
          </CardTitle>
          <CardDescription>
            View and manage SMS delivery logs, retry failed messages, and export data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateRangeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" onClick={exportLogs} disabled={filteredLogs.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                Showing <strong>{filteredLogs.length}</strong> of <strong>{logs.length}</strong> SMS logs
                {searchTerm && ` matching "${searchTerm}"`}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse p-4 border-b">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-32"></div>
                      <div className="h-3 bg-muted rounded w-48"></div>
                    </div>
                    <div className="h-6 bg-muted rounded w-20"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLogs.length > 0 ? (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {log.status === 'failed' || log.status === 'bounced' ? (
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        ) : (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{formatPhone(log.phone_number)}</span>
                          {getStatusBadge(log.status)}
                          {log.cost_amount && (
                            <span className="text-sm text-muted-foreground">
                              {formatCurrency(log.cost_amount)}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md truncate">
                          {log.message_content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                          {log.provider_message_id && (
                            <span>ID: {log.provider_message_id}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(log.status === 'failed' || log.status === 'bounced') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryFailedSMS(log.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No SMS logs found</p>
              <p className="text-sm">
                {searchTerm 
                  ? 'Try adjusting your search criteria'
                  : 'SMS delivery logs will appear here once messages are sent'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <Card className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
            <CardHeader className="border-b">
              <CardTitle>SMS Log Details</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4"
                onClick={() => setSelectedLog(null)}
              >
                ×
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-medium">Phone Number</p>
                  <p className="text-sm text-muted-foreground">{selectedLog.phone_number}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <p className="text-sm font-medium">Message Content</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedLog.message_content}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Timestamp</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </p>
                </div>
                {selectedLog.provider_message_id && (
                  <div>
                    <p className="text-sm font-medium">Provider Message ID</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {selectedLog.provider_message_id}
                    </p>
                  </div>
                )}
                {selectedLog.cost_amount && (
                  <div>
                    <p className="text-sm font-medium">Cost</p>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(selectedLog.cost_amount)}
                    </p>
                  </div>
                )}
                {selectedLog.provider_response && (
                  <div>
                    <p className="text-sm font-medium">Provider Response</p>
                    <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-auto">
                      {JSON.stringify(selectedLog.provider_response, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </div>
        </Card>
      )}
    </div>
  )
}