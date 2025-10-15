/**
 * Calculate Paystack transaction fee
 * 
 * Paystack Fee Structure:
 * - 1.5% of transaction amount
 * - Plus ₦100 flat fee
 * - Capped at ₦2,000 maximum
 * - Free for transactions ≤ ₦2,500
 * 
 * @param amount - The order amount in Naira
 * @returns The calculated transaction fee
 */
export const calculatePaystackFee = (amount: number): number => {
  // No fee for small transactions
  if (amount <= 2500) {
    return 0;
  }

  // Calculate 1.5% + ₦100
  const percentageFee = amount * 0.015; // 1.5%
  const flatFee = 100; // ₦100
  const totalFee = percentageFee + flatFee;

  // Cap at ₦2,000
  const cappedFee = Math.min(totalFee, 2000);

  // Round to 2 decimal places
  return Math.round(cappedFee * 100) / 100;
};
