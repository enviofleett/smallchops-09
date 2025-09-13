import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, BarChart3, FileText, Settings, PhoneOff, TestTube } from 'lucide-react'
import SMSDashboard from '@/components/admin/SMSDashboard'
import SMSCredentialsManager from '@/components/admin/SMSCredentialsManager'
import SMSSuppressionManager from '@/components/admin/SMSSuppressionManager'
import SMSLogsViewer from '@/components/admin/SMSLogsViewer'
import SMSTemplateManager from '@/components/admin/SMSTemplateManager'
import SMSTester from '@/components/admin/SMSTester'

export default function AdminSMSCommunication() {
  const [activeTab, setActiveTab] = useState('dashboard')

  const tabs = [
    {
      value: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
      description: 'SMS usage, balance, and activity overview'
    },
    {
      value: 'templates',
      label: 'Templates',
      icon: FileText,
      description: 'Manage SMS message templates'
    },
    {
      value: 'logs',
      label: 'Logs',
      icon: MessageSquare,
      description: 'View SMS delivery logs and failures'
    },
    {
      value: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Configure SMS provider and credentials'
    },
    {
      value: 'suppression',
      label: 'Suppression',
      icon: PhoneOff,
      description: 'Manage opt-out and blocked numbers'
    },
    {
      value: 'testing',
      label: 'Testing',
      icon: TestTube,
      description: 'Test SMS functionality'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquare className="h-8 w-8" />
          SMS Communication
        </h1>
        <p className="text-muted-foreground">
          Manage SMS notifications, templates, and delivery settings
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Mobile Tab Selector */}
        <div className="block lg:hidden">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">SMS Management</CardTitle>
              <CardDescription>
                Select a section to manage SMS communication settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TabsList className="grid grid-cols-2 gap-1 h-auto p-1">
                {tabs.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex flex-col items-center gap-1 p-3 h-auto data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <tab.icon className="h-4 w-4" />
                    <span className="text-xs">{tab.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </CardContent>
          </Card>
        </div>

        {/* Desktop Tab Selector */}
        <div className="hidden lg:block">
          <TabsList className="grid w-full grid-cols-6 gap-1 p-1 bg-muted rounded-lg">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex items-center gap-2 px-4 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab Contents */}
        <div className="space-y-6">
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">SMS Dashboard</h2>
                <p className="text-muted-foreground">
                  Monitor SMS usage, delivery rates, and account balance
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Live Data
              </Badge>
            </div>
            <SMSDashboard />
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">SMS Templates</h2>
                <p className="text-muted-foreground">
                  Create and manage SMS message templates for different event types
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Templates
              </Badge>
            </div>
            <SMSTemplateManager />
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">SMS Delivery Logs</h2>
                <p className="text-muted-foreground">
                  View detailed logs of SMS deliveries, failures, and retries
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Activity Logs
              </Badge>
            </div>
            <SMSLogsViewer />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">SMS Settings</h2>
                <p className="text-muted-foreground">
                  Configure SMS provider credentials and service settings
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Configuration
              </Badge>
            </div>
            <SMSCredentialsManager />
          </TabsContent>

          {/* Suppression Tab */}
          <TabsContent value="suppression" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Phone Suppression List</h2>
                <p className="text-muted-foreground">
                  Manage opt-out requests and blocked phone numbers
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <PhoneOff className="h-3 w-3" />
                Suppression
              </Badge>
            </div>
            <SMSSuppressionManager />
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">SMS Testing</h2>
                <p className="text-muted-foreground">
                  Test SMS functionality and troubleshoot delivery issues
                </p>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <TestTube className="h-3 w-3" />
                Testing Tools
              </Badge>
            </div>
            <SMSTester />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}