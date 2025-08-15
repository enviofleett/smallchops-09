import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProductionReadinessChecker } from '@/components/production/ProductionReadinessChecker';
import { Button } from '@/components/ui/button';
import { ExternalLink, Settings, Database, CreditCard, Mail, Users, Shield } from 'lucide-react';

const ProductionLaunchPage = () => {
  const configurationSteps = [
    {
      id: 'payment',
      title: 'Payment Configuration',
      icon: <CreditCard className="h-5 w-5" />,
      status: 'pending',
      description: 'Configure Paystack live API keys',
      actions: [
        'Replace PAYSTACK_SECRET_KEY with live key',
        'Update Paystack public key in frontend',
        'Configure webhook URL in Paystack dashboard',
        'Test payment flows in live mode'
      ]
    },
    {
      id: 'auth',
      title: 'Authentication Setup',
      icon: <Users className="h-5 w-5" />,
      status: 'pending',
      description: 'Configure Google OAuth and site URLs',
      actions: [
        'Set up Google OAuth in Google Cloud Console',
        'Configure Site URL in Supabase Auth settings',
        'Set redirect URLs for production domain',
        'Test login flows with production URLs'
      ]
    },
    {
      id: 'email',
      title: 'Email Configuration',
      icon: <Mail className="h-5 w-5" />,
      status: 'pending',
      description: 'Configure SMTP and email templates',
      actions: [
        'Verify Resend domain configuration',
        'Set up email templates in database',
        'Configure SMTP settings',
        'Test email delivery'
      ]
    },
    {
      id: 'security',
      title: 'Security Review',
      icon: <Shield className="h-5 w-5" />,
      status: 'pending',
      description: 'Review and fix security policies',
      actions: [
        'Enable RLS on all public tables',
        'Review database function security',
        'Audit user permissions',
        'Verify API access controls'
      ]
    },
    {
      id: 'database',
      title: 'Database Setup',
      icon: <Database className="h-5 w-5" />,
      status: 'pending',
      description: 'Ensure database is production-ready',
      actions: [
        'Verify all tables have proper indexes',
        'Check backup configuration',
        'Review connection limits',
        'Optimize query performance'
      ]
    }
  ];

  const externalLinks = [
    {
      title: 'Supabase Dashboard',
      description: 'Manage authentication and database settings',
      url: 'https://supabase.com/dashboard/project/oknnklksdiqaifhxaccs',
      icon: <Database className="h-4 w-4" />
    },
    {
      title: 'Paystack Dashboard',
      description: 'Configure payment settings and webhooks',
      url: 'https://dashboard.paystack.com',
      icon: <CreditCard className="h-4 w-4" />
    },
    {
      title: 'Google Cloud Console',
      description: 'Set up OAuth credentials',
      url: 'https://console.cloud.google.com',
      icon: <Settings className="h-4 w-4" />
    },
    {
      title: 'Resend Dashboard',
      description: 'Manage email delivery settings',
      url: 'https://resend.com/domains',
      icon: <Mail className="h-4 w-4" />
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Production Launch</h1>
          <p className="text-muted-foreground">
            Prepare your system for production deployment
          </p>
        </div>
        <Badge variant="outline" className="text-warning">
          Pre-Launch
        </Badge>
      </div>

      <Tabs defaultValue="health-check" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="health-check">Health Check</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="health-check" className="space-y-6">
          <ProductionReadinessChecker />
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <div className="grid gap-6">
            {configurationSteps.map((step) => (
              <Card key={step.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {step.icon}
                    {step.title}
                    <Badge variant={step.status === 'pending' ? 'secondary' : 'default'}>
                      {step.status === 'pending' ? 'Pending' : 'Complete'}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Required Actions:</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {step.actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>External Configuration Links</CardTitle>
              <CardDescription>
                Quick access to external services that need configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {externalLinks.map((link, index) => (
                  <Card key={index} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {link.icon}
                        <div>
                          <h4 className="font-semibold">{link.title}</h4>
                          <p className="text-sm text-muted-foreground">{link.description}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pre-Launch Checklist</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  'Configure production payment keys',
                  'Set up Google OAuth credentials',
                  'Configure site URLs for production domain',
                  'Set up email templates and SMTP',
                  'Review and enable RLS policies',
                  'Test complete user journey (register → shop → pay → receive order)',
                  'Verify email notifications are working',
                  'Test payment flows in live mode',
                  'Set up monitoring and alerts',
                  'Create admin user accounts'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionLaunchPage;