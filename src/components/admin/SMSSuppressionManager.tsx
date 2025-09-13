import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { PhoneOff, Plus, Trash2, AlertTriangle, Phone, Search } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface SuppressedNumber {
  id: string
  phone_number: string
  reason: string
  event_data: any
  created_at: string
  created_by: string
}

export default function SMSSuppressionManager() {
  const [suppressedNumbers, setSuppressedNumbers] = useState<SuppressedNumber[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterReason, setFilterReason] = useState<string>('all')
  const [newPhone, setNewPhone] = useState('')
  const [newReason, setNewReason] = useState('opt_out')
  const { toast } = useToast()

  const reasons = [
    { value: 'opt_out', label: 'Opt-out Request', variant: 'default' as const },
    { value: 'bounced', label: 'Number Bounced', variant: 'destructive' as const },
    { value: 'invalid', label: 'Invalid Number', variant: 'secondary' as const },
    { value: 'admin_blocked', label: 'Admin Blocked', variant: 'outline' as const }
  ]

  useEffect(() => {
    loadSuppressedNumbers()
  }, [])

  const loadSuppressedNumbers = async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('sms_suppression_list')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading suppressed numbers:', error)
        return
      }

      setSuppressedNumbers(data || [])
    } catch (error) {
      console.error('Error loading suppressed numbers:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const addSuppressedNumber = async () => {
    if (!newPhone.trim()) {
      toast({
        title: 'Invalid Input',
        description: 'Please enter a phone number',
        variant: 'destructive'
      })
      return
    }

    // Basic phone number validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/
    if (!phoneRegex.test(newPhone.trim())) {
      toast({
        title: 'Invalid Phone Number',
        description: 'Please enter a valid phone number',
        variant: 'destructive'
      })
      return
    }

    try {
      const { data, error } = await supabase
        .rpc('suppress_phone_number', {
          phone_number: newPhone.trim(),
          reason: newReason,
          event_data: { added_via: 'admin_panel', timestamp: new Date().toISOString() }
        })

      if (error) {
        throw error
      }

      toast({
        title: 'Number Added',
        description: 'Phone number has been added to the suppression list',
      })

      setNewPhone('')
      setNewReason('opt_out')
      await loadSuppressedNumbers()
    } catch (error: any) {
      console.error('Error adding suppressed number:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to add phone number to suppression list',
        variant: 'destructive'
      })
    }
  }

  const removeSuppressedNumber = async (id: string, phoneNumber: string) => {
    try {
      const { error } = await supabase
        .from('sms_suppression_list')
        .delete()
        .eq('id', id)

      if (error) {
        throw error
      }

      toast({
        title: 'Number Removed',
        description: `${phoneNumber} has been removed from the suppression list`,
      })

      await loadSuppressedNumbers()
    } catch (error: any) {
      console.error('Error removing suppressed number:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove phone number from suppression list',
        variant: 'destructive'
      })
    }
  }

  const formatPhoneNumber = (phone: string) => {
    // Basic phone number formatting for display
    if (phone.startsWith('+234')) {
      return phone.replace('+234', '0')
    }
    return phone
  }

  const filteredNumbers = suppressedNumbers.filter(number => {
    const matchesSearch = number.phone_number.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesReason = filterReason === 'all' || number.reason === filterReason
    return matchesSearch && matchesReason
  })

  const getReasonConfig = (reason: string) => {
    return reasons.find(r => r.value === reason) || { label: reason, variant: 'outline' as const }
  }

  return (
    <div className="space-y-6">
      {/* Add New Suppressed Number */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Phone Number to Suppression List
          </CardTitle>
          <CardDescription>
            Add a phone number to prevent SMS delivery (for opt-outs, invalid numbers, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="newPhone">Phone Number</Label>
              <Input
                id="newPhone"
                placeholder="+234 or 0 format"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newReason">Reason</Label>
              <Select value={newReason} onValueChange={setNewReason}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={addSuppressedNumber} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Number
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneOff className="h-5 w-5" />
            Suppressed Phone Numbers
          </CardTitle>
          <CardDescription>
            Manage phone numbers that are blocked from receiving SMS
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search phone numbers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterReason} onValueChange={setFilterReason}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reasons</SelectItem>
                  {reasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{filteredNumbers.length}</strong> phone numbers in suppression list
                {searchTerm || filterReason !== 'all' ? ' (filtered)' : ''}
              </AlertDescription>
            </Alert>

            {/* Suppressed Numbers List */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse p-4 border rounded-lg">
                    <div className="flex justify-between items-center">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-32"></div>
                        <div className="h-3 bg-muted rounded w-24"></div>
                      </div>
                      <div className="h-6 bg-muted rounded w-20"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNumbers.length > 0 ? (
              <div className="space-y-3">
                {filteredNumbers.map((number) => (
                  <div key={number.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{formatPhoneNumber(number.phone_number)}</p>
                        <p className="text-sm text-muted-foreground">
                          Added {new Date(number.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getReasonConfig(number.reason).variant}>
                        {getReasonConfig(number.reason).label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSuppressedNumber(number.id, number.phone_number)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <PhoneOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No suppressed phone numbers found</p>
                <p className="text-sm">
                  {searchTerm || filterReason !== 'all' 
                    ? 'Try adjusting your search or filter'
                    : 'Phone numbers added to the suppression list will appear here'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}