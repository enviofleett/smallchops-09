import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export interface LoyaltyPoints {
  customerId: string;
  pointsBalance: number;
  currentTier: 'bronze' | 'silver' | 'gold' | 'platinum';
  pointsToNextTier: number;
  lifetimePoints: number;
}

export interface PointsTransaction {
  id: string;
  amount: number;
  type: 'earned' | 'redeemed';
  description: string;
  relatedOrderId?: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  referrerCustomerId: string;
  referredCustomerId: string;
  code: string;
  rewardGranted: boolean;
  createdAt: string;
}

// Mock data for demonstration
const mockLoyaltyData = {
  pointsBalance: 1250,
  currentTier: 'silver' as const,
  pointsToNextTier: 250,
  lifetimePoints: 1250
};

const mockTransactions = [
  {
    id: '1',
    amount: 50,
    type: 'earned' as const,
    description: 'Earned 50 points from order #ORD000001',
    relatedOrderId: 'order-1',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    amount: -100,
    type: 'redeemed' as const,
    description: 'Redeemed 100 points for discount',
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: '3',
    amount: 25,
    type: 'earned' as const,
    description: 'Earned 25 points from order #ORD000002',
    relatedOrderId: 'order-2',
    createdAt: new Date(Date.now() - 172800000).toISOString()
  }
];

const mockReferrals = [
  {
    id: '1',
    referrerCustomerId: 'customer-1',
    referredCustomerId: 'customer-2',
    code: 'REF123ABC',
    rewardGranted: true,
    createdAt: new Date(Date.now() - 259200000).toISOString()
  }
];

export const useLoyaltyProgram = (customerEmail?: string) => {
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyPoints | null>(null);
  const [transactions, setTransactions] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLoyaltyData = async (email: string) => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setLoyaltyData({
        customerId: `customer-${email}`,
        ...mockLoyaltyData
      });

      setTransactions(mockTransactions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch loyalty data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const redeemPoints = async (pointsToRedeem: number, description: string) => {
    if (!loyaltyData) return false;

    if (pointsToRedeem > loyaltyData.pointsBalance) {
      toast.error('Insufficient points balance');
      return false;
    }

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update local state
      setLoyaltyData(prev => prev ? {
        ...prev,
        pointsBalance: prev.pointsBalance - pointsToRedeem
      } : null);

      // Add new transaction
      const newTransaction: PointsTransaction = {
        id: Date.now().toString(),
        amount: -pointsToRedeem,
        type: 'redeemed',
        description,
        createdAt: new Date().toISOString()
      };

      setTransactions(prev => [newTransaction, ...prev]);

      toast.success(`Successfully redeemed ${pointsToRedeem} points!`);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to redeem points';
      toast.error(errorMessage);
      return false;
    }
  };

  const generateReferralCode = async () => {
    if (!loyaltyData) return null;

    try {
      const referralCode = `REF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      toast.success('Referral code generated successfully!');
      return referralCode;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate referral code';
      toast.error(errorMessage);
      return null;
    }
  };

  useEffect(() => {
    if (customerEmail) {
      fetchLoyaltyData(customerEmail);
    }
  }, [customerEmail]);

  return {
    loyaltyData,
    transactions,
    loading,
    error,
    redeemPoints,
    generateReferralCode,
    refetch: () => customerEmail ? fetchLoyaltyData(customerEmail) : null
  };
};

export const useReferralProgram = () => {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReferrals = async (customerEmail: string) => {
    setLoading(true);
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setReferrals(mockReferrals);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    } finally {
      setLoading(false);
    }
  };

  return {
    referrals,
    loading,
    fetchReferrals
  };
};