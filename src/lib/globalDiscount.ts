// src/lib/globalDiscount.ts
export const applyGlobalDiscount = (price: number): number => {
    return price - (price * 0.10);
};
