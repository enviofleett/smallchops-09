import React, { useState } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, User, MapPin, Settings, Activity, ShoppingBag, ArrowLeft } from 'lucide-react';
import { PersonalInfoEditor } from '@/components/customer/PersonalInfoEditor';
import { AddressManager } from '@/components/customer/AddressManager';
import { AccountSettings } from '@/components/customer/AccountSettings';
import { ProfileAnalytics } from '@/components/customer/ProfileAnalytics';
import { OrderSummary } from '@/components/customer/OrderSummary';
import { ProfileActivityLog } from '@/components/customer/ProfileActivityLog';
import { useCustomerProfile, useProfileCompletion } from '@/hooks/useCustomerProfile';
import { Navigate, useNavigate } from 'react-router-dom';

export default function CustomerProfile() {
  const { isAuthenticated, customerAccount, isLoading: authLoading } = useCustomerAuth();
  const { profile, isLoading: profileLoading } = useCustomerProfile();
  const { data: completionPercentage = 0 } = useProfileCompletion();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCompletionStatus = (percentage: number) => {
    if (percentage >= 80) return 'Complete';
    if (percentage >= 50) return 'Good';
    return 'Needs Attention';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-lg">
                  {customerAccount?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  Welcome back, {customerAccount?.name || 'Customer'}!
                </h1>
                <p className="text-muted-foreground">
                  Manage your profile and preferences
                </p>
              </div>
            </div>
            
            <Card className="p-4 min-w-[200px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Profile Completion</span>
                  <Badge variant={completionPercentage >= 80 ? 'default' : 'secondary'}>
                    {getCompletionStatus(completionPercentage)}
                  </Badge>
                </div>
                <Progress value={completionPercentage} className="h-2" />
                <p className={`text-sm font-medium ${getCompletionColor(completionPercentage)}`}>
                  {completionPercentage}% Complete
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Warning for incomplete profile */}
        {completionPercentage < 50 && (
          <Card className="mb-6 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Complete Your Profile
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Complete your profile to unlock better recommendations and faster checkout.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProfileAnalytics />
              <OrderSummary />
            </div>
          </TabsContent>

          <TabsContent value="personal">
            <PersonalInfoEditor />
          </TabsContent>

          <TabsContent value="addresses">
            <AddressManager />
          </TabsContent>

          <TabsContent value="settings">
            <AccountSettings />
          </TabsContent>

          <TabsContent value="orders">
            <OrderSummary detailed />
          </TabsContent>

          <TabsContent value="activity">
            <ProfileActivityLog />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}