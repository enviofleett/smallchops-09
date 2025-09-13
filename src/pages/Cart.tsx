import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { CartItemRow } from '@/components/cart/CartItemRow';
import { CartSummary } from '@/components/cart/CartSummary';

import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';


export default function Cart() {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeItem } = useCart();

  // Debug logging for production troubleshooting
  console.log('🛒 Cart Page - Current cart state:', cart);
  console.log('🛒 Cart Page - Items array:', cart.items);
  console.log('🛒 Cart Page - Item count:', cart.itemCount);
  console.log('🛒 Cart Page - Cart summary:', cart.summary);
  
  // Check localStorage directly
  const cartInStorage = localStorage.getItem('restaurant_cart');
  console.log('🛒 Cart Page - Raw localStorage data:', cartInStorage);
  if (cartInStorage) {
    try {
      const parsedStorage = JSON.parse(cartInStorage);
      console.log('🛒 Cart Page - Parsed localStorage:', parsedStorage);
    } catch (e) {
      console.log('🛒 Cart Page - Error parsing localStorage:', e);
    }
  }

  const handleBackClick = () => {
    navigate(-1);
  };


  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Public Header */}
      <PublicHeader />
      
      <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleBackClick}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-2xl font-bold">Cart</h1>
        </div>

        {cart.items.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
            <p className="text-muted-foreground mb-6">Add some items to get started</p>
            <Button onClick={handleBackClick}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            {/* Cart Items - Left Side */}
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg border">
                <div className="p-4 sm:p-6 border-b">
                  <h2 className="text-lg font-semibold">
                    Cart ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
                  </h2>
                </div>
                <div className="divide-y">
                  {cart.items.map((item) => (
                    <div key={item.id} className="p-3 sm:p-4 md:p-6">
                      <CartItemRow
                        item={item}
                        onUpdateQuantity={updateQuantity}
                        onRemove={removeItem}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cart Summary - Right Side */}
            <div className="lg:col-span-1">
              <CartSummary cart={cart} />
            </div>
          </div>
        )}
      </div>


      {/* Public Footer - Hidden on mobile when cart has items to avoid overlap */}
      <div className={cart.items.length > 0 ? "hidden lg:block" : ""}>
        <PublicFooter />
      </div>
    </div>
  );
}