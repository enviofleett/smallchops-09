import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Star, 
  Gift, 
  Users, 
  TrendingUp, 
  ArrowUp, 
  ArrowDown,
  Copy,
  Crown
} from 'lucide-react';
import { useLoyaltyProgram, useReferralProgram } from '@/hooks/useLoyaltyProgram';
import { useState } from 'react';
import { toast } from 'sonner';

interface LoyaltyDashboardProps {
  customerEmail?: string;
}

export const LoyaltyDashboard = ({ customerEmail = 'demo@example.com' }: LoyaltyDashboardProps) => {
  const { loyaltyData, transactions, loading, redeemPoints, generateReferralCode } = useLoyaltyProgram(customerEmail);
  const { referrals, fetchReferrals } = useReferralProgram();
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemReason, setRedeemReason] = useState('');

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'bronze':
        return 'bg-amber-600';
      case 'silver':
        return 'bg-gray-400';
      case 'gold':
        return 'bg-yellow-500';
      case 'platinum':
        return 'bg-purple-600';
      default:
        return 'bg-gray-500';
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'platinum':
        return <Crown className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const handleRedeemPoints = async () => {
    const points = parseInt(redeemAmount);
    if (!points || points <= 0) {
      toast.error('Please enter a valid point amount');
      return;
    }

    const success = await redeemPoints(points, redeemReason || 'Points redemption');
    if (success) {
      setRedeemAmount('');
      setRedeemReason('');
    }
  };

  const handleGenerateReferral = async () => {
    const code = await generateReferralCode();
    if (code) {
      navigator.clipboard.writeText(code);
      toast.success(`Referral code ${code} copied to clipboard!`);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading loyalty data...</div>
        </CardContent>
      </Card>
    );
  }

  if (!loyaltyData) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            No loyalty data found for this customer
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Loyalty Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Balance</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loyaltyData.pointsBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime: {loyaltyData.lifetimePoints.toLocaleString()} points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Tier</CardTitle>
            {getTierIcon(loyaltyData.currentTier)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge className={getTierColor(loyaltyData.currentTier)}>
                {loyaltyData.currentTier.toUpperCase()}
              </Badge>
            </div>
            {loyaltyData.pointsToNextTier > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">
                  {loyaltyData.pointsToNextTier} points to next tier
                </p>
                <Progress 
                  value={(loyaltyData.pointsBalance / (loyaltyData.pointsBalance + loyaltyData.pointsToNextTier)) * 100} 
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-muted-foreground">
              Points earned & redeemed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="redeem">Redeem Points</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest points activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`
                        rounded-full p-2 
                        ${transaction.type === 'earned' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-red-100 text-red-600'
                        }
                      `}>
                        {transaction.type === 'earned' ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`
                      font-semibold 
                      ${transaction.type === 'earned' ? 'text-green-600' : 'text-red-600'}
                    `}>
                      {transaction.type === 'earned' ? '+' : ''}{transaction.amount}
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No transactions yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="redeem" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Redeem Points</CardTitle>
              <CardDescription>
                Exchange your points for rewards (Available: {loyaltyData.pointsBalance} points)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="redeem-amount">Points to Redeem</Label>
                  <Input
                    id="redeem-amount"
                    type="number"
                    placeholder="Enter points amount"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    max={loyaltyData.pointsBalance}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redeem-reason">Reason (Optional)</Label>
                  <Input
                    id="redeem-reason"
                    placeholder="e.g., Discount on next order"
                    value={redeemReason}
                    onChange={(e) => setRedeemReason(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleRedeemPoints} className="w-full">
                <Gift className="h-4 w-4 mr-2" />
                Redeem Points
              </Button>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Available Rewards</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="border rounded-lg p-3">
                    <h5 className="font-medium">10% Discount</h5>
                    <p className="text-sm text-muted-foreground">100 points</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <h5 className="font-medium">Free Delivery</h5>
                    <p className="text-sm text-muted-foreground">50 points</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <h5 className="font-medium">Free Item</h5>
                    <p className="text-sm text-muted-foreground">200 points</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <h5 className="font-medium">VIP Status</h5>
                    <p className="text-sm text-muted-foreground">500 points</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Referral Program</CardTitle>
              <CardDescription>
                Invite friends and earn points for each successful referral
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={handleGenerateReferral} className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Generate Referral Code
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">How it works:</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Share your referral code with friends</p>
                  <p>• They get 10% off their first order</p>
                  <p>• You earn 50 points when they place their first order</p>
                  <p>• No limit on referrals!</p>
                </div>
              </div>

              {referrals.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">Your Referrals</h4>
                  <div className="space-y-2">
                    {referrals.map((referral) => (
                      <div key={referral.id} className="flex items-center justify-between p-2 rounded border">
                        <div>
                          <p className="font-medium">{referral.code}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(referral.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={referral.rewardGranted ? "default" : "secondary"}>
                          {referral.rewardGranted ? "Reward Earned" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};