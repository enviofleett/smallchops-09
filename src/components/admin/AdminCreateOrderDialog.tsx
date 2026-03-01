import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RequiredFieldLabel } from '@/components/ui/required-field-label';
import { DeliveryScheduler } from '@/components/checkout/DeliveryScheduler';
import { DeliveryZoneDropdown } from '@/components/delivery/DeliveryZoneDropdown';
import { PickupPointSelector } from '@/components/delivery/PickupPointSelector';
import { OrderSummaryCard } from '@/components/checkout/OrderSummaryCard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { generateAdminOrderPDF } from '@/utils/adminOrderPDF';
import { cn } from '@/lib/utils';
import { 
  X, Truck, MapPin, ShoppingBag, User, Clock, 
  ChevronLeft, ChevronRight, CheckCircle, Download, Loader2,
  Plus, Minus, Search, Package
} from 'lucide-react';

type Step = 'products' | 'customer' | 'fulfillment' | 'review' | 'confirmation';

interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  image_url?: string;
}

interface VirtualAccount {
  account_number: string;
  bank_name: string;
  account_name: string;
}

interface AdminCreateOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: () => void;
}

export const AdminCreateOrderDialog: React.FC<AdminCreateOrderDialogProps> = ({
  isOpen,
  onClose,
  onOrderCreated
}) => {
  const [step, setStep] = useState<Step>('products');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);

  // Customer form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Fulfillment
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryZone, setDeliveryZone] = useState<any>(null);
  const [pickupPoint, setPickupPoint] = useState<any>(null);
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState<{ start_time: string; end_time: string } | undefined>();
  const [deliveryAddress, setDeliveryAddress] = useState({ address_line_1: '', city: '', landmark: '' });
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Fetch products from the actual products table
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['admin-products-catalog'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('products')
        .select('id, name, price, image_url, minimum_order_quantity, stock_quantity, is_active, category_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: isOpen
  });

  // Fetch business info for PDF
  const { data: businessInfo } = useQuery({
    queryKey: ['business-settings-pdf'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('business_settings')
        .select('name, admin_notification_email, whatsapp_support_number')
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000
  });

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p: any) => p.name.toLowerCase().includes(q));
  }, [products, searchQuery]);

  const deliveryFee = useMemo(() => {
    return fulfillmentType === 'pickup' ? 0 : (deliveryZone?.base_fee || 0);
  }, [fulfillmentType, deliveryZone?.base_fee]);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const total = subtotal + deliveryFee;

  const addToCart = useCallback((product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      const moq = product.minimum_order_quantity || 1;
      if (existing) {
        return prev.map(item => item.product_id === product.id 
          ? { ...item, quantity: item.quantity + 1 } 
          : item);
      }
      return [...prev, {
        id: product.id,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: moq,
        image_url: product.image_url
      }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      const product = products.find((p: any) => p.id === productId);
      const moq = product?.minimum_order_quantity || 1;
      const newQty = item.quantity + delta;
      if (newQty < moq) return item;
      return { ...item, quantity: newQty };
    }));
  }, [products]);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  }, []);

  const canProceedFromProducts = cart.length > 0;
  const canProceedFromCustomer = customerName.trim() && /\S+@\S+\.\S+/.test(customerEmail) && customerPhone.trim().length >= 10;
  const canProceedFromFulfillment = deliveryDate && deliveryTimeSlot && (
    fulfillmentType === 'pickup' ? !!pickupPoint : (!!deliveryZone && deliveryAddress.address_line_1.trim())
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price
        })),
        customer: {
          name: customerName.trim(),
          email: customerEmail.trim().toLowerCase(),
          phone: customerPhone.trim()
        },
        fulfillment: {
          type: fulfillmentType,
          address: fulfillmentType === 'delivery' ? deliveryAddress : undefined,
          pickup_point_id: fulfillmentType === 'pickup' ? pickupPoint?.id : undefined,
          delivery_zone_id: deliveryZone?.id || undefined,
          delivery_fee: deliveryFee
        },
        delivery_schedule: {
          delivery_date: deliveryDate,
          delivery_time_start: deliveryTimeSlot?.start_time || '09:00',
          delivery_time_end: deliveryTimeSlot?.end_time || '17:00',
          special_instructions: specialInstructions || null
        }
      };

      console.log('📦 Submitting admin order:', payload);

      const { data, error } = await supabase.functions.invoke('admin-create-order', { body: payload });

      if (error) {
        console.error('❌ Edge function error:', error);
        throw new Error(error.message || 'Failed to create order');
      }

      if (!data?.success) {
        console.error('❌ Order creation failed:', data);
        throw new Error(data?.error || 'Failed to create order');
      }

      console.log('✅ Order created:', data);
      setCreatedOrder(data.order);
      setVirtualAccount(data.virtual_account || null);
      setStep('confirmation');
      toast.success(`Order ${data.order.order_number} created successfully!`);
      onOrderCreated?.();
    } catch (error: any) {
      console.error('Admin order creation failed:', error);
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!createdOrder) return;
    generateAdminOrderPDF(
      {
        ...createdOrder,
        items: cart.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        })),
        subtotal,
        delivery_fee: deliveryFee,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      },
      virtualAccount,
      businessInfo ? { name: businessInfo.name, phone: businessInfo.whatsapp_support_number, email: businessInfo.admin_notification_email } : undefined
    );
  };

  const resetState = () => {
    setStep('products');
    setCart([]);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setFulfillmentType('delivery');
    setDeliveryZone(null);
    setPickupPoint(null);
    setDeliveryDate('');
    setDeliveryTimeSlot(undefined);
    setDeliveryAddress({ address_line_1: '', city: '', landmark: '' });
    setSpecialInstructions('');
    setCreatedOrder(null);
    setVirtualAccount(null);
    setSearchQuery('');
  };

  const handleClose = () => {
    if (step === 'confirmation') {
      resetState();
    }
    onClose();
  };

  const steps: { key: Step; label: string; icon: React.ReactNode }[] = [
    { key: 'products', label: 'Products', icon: <ShoppingBag className="w-4 h-4" /> },
    { key: 'customer', label: 'Customer', icon: <User className="w-4 h-4" /> },
    { key: 'fulfillment', label: 'Fulfillment', icon: <Truck className="w-4 h-4" /> },
    { key: 'review', label: 'Review', icon: <Package className="w-4 h-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  const goToNext = () => {
    const nextMap: Record<Step, Step> = {
      products: 'customer',
      customer: 'fulfillment',
      fulfillment: 'review',
      review: 'review',
      confirmation: 'confirmation'
    };
    setStep(nextMap[step]);
  };

  const goToPrev = () => {
    const prevMap: Record<Step, Step> = {
      products: 'products',
      customer: 'products',
      fulfillment: 'customer',
      review: 'fulfillment',
      confirmation: 'review'
    };
    setStep(prevMap[step]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl h-[95vh] md:h-[90vh] overflow-hidden p-0 flex flex-col">
        {/* Header with stepper */}
        <div className="flex items-center justify-between p-4 border-b bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">Create Order for Customer</h2>
          </div>
          {step !== 'confirmation' && (
            <div className="hidden md:flex items-center gap-2">
              {steps.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    i <= currentStepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {s.icon}
                    <span className="hidden lg:inline">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
                </div>
              ))}
            </div>
          )}
          {/* Mobile step indicator */}
          {step !== 'confirmation' && (
            <div className="flex md:hidden items-center gap-1.5">
              <Badge variant="outline" className="text-xs">
                Step {currentStepIndex + 1}/{steps.length}
              </Badge>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {/* STEP 1: Product Selection */}
          {step === 'products' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search products..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="pl-10" 
                />
              </div>

              {/* Cart Summary */}
              {cart.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Cart ({cart.length} items)</span>
                      <span className="font-bold text-primary">₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="space-y-2">
                      {cart.map(item => (
                        <div key={item.product_id} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1 mr-2">{item.product_name}</span>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center font-medium">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.product_id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Product Grid */}
              {productsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No products found</p>
                  <p className="text-sm mt-1">
                    {searchQuery ? 'Try a different search term' : 'No active products available'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredProducts.map((product: any) => {
                    const cartItem = cart.find(c => c.product_id === product.id);
                    return (
                      <Card key={product.id} className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        cartItem && "ring-2 ring-primary"
                      )} onClick={() => !cartItem && addToCart(product)}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            {product.image_url ? (
                              <img src={product.image_url} alt={product.name} className="w-14 h-14 rounded-md object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{product.name}</p>
                              <p className="text-primary font-bold text-sm">₦{product.price?.toLocaleString()}</p>
                              {product.minimum_order_quantity > 1 && (
                                <p className="text-xs text-muted-foreground">MOQ: {product.minimum_order_quantity}</p>
                              )}
                            </div>
                            {cartItem ? (
                              <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(product.id, -1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Badge variant="default" className="min-w-[28px] justify-center">{cartItem.quantity}</Badge>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(product.id, 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); addToCart(product); }}>
                                <Plus className="h-3 w-3 mr-1" /> Add
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Customer Info */}
          {step === 'customer' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Information
                </CardTitle>
                <CardDescription>Enter the customer's contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <RequiredFieldLabel htmlFor="admin_customer_name" required>Full Name</RequiredFieldLabel>
                  <Input id="admin_customer_name" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer full name" />
                </div>
                <div>
                  <RequiredFieldLabel htmlFor="admin_customer_email" required>Email</RequiredFieldLabel>
                  <Input id="admin_customer_email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com" />
                  {customerEmail && !/\S+@\S+\.\S+/.test(customerEmail) && (
                    <p className="text-xs text-destructive mt-1">Please enter a valid email address</p>
                  )}
                </div>
                <div>
                  <RequiredFieldLabel htmlFor="admin_customer_phone" required>Phone Number</RequiredFieldLabel>
                  <Input id="admin_customer_phone" type="tel" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="08012345678" />
                  {customerPhone && customerPhone.trim().length < 10 && (
                    <p className="text-xs text-destructive mt-1">Phone number must be at least 10 digits</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* STEP 3: Fulfillment (identical to storefront) */}
          {step === 'fulfillment' && (
            <div className="space-y-6">
              {/* Delivery Scheduler */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    When does the customer need the order?
                    <span className="text-destructive text-sm font-bold ml-1">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryScheduler
                    onScheduleChange={(date, timeSlot) => {
                      setDeliveryDate(date);
                      setDeliveryTimeSlot(timeSlot);
                    }}
                    selectedDate={deliveryDate}
                    selectedTimeSlot={deliveryTimeSlot}
                    showHeader={false}
                  />
                </CardContent>
              </Card>

              {/* Fulfillment Type */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base text-center">
                    Fulfillment Type <span className="text-destructive">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={fulfillmentType}
                    onValueChange={value => {
                      setFulfillmentType(value as 'delivery' | 'pickup');
                      // Reset the other option
                      if (value === 'pickup') {
                        setDeliveryZone(null);
                        setDeliveryAddress({ address_line_1: '', city: '', landmark: '' });
                      } else {
                        setPickupPoint(null);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <RadioGroupItem value="delivery" id="admin_delivery" className="peer sr-only" />
                      <Label htmlFor="admin_delivery" className={cn(
                        "flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all duration-300 hover:border-primary/30",
                        fulfillmentType === 'delivery' && "border-primary bg-primary/5 shadow-lg ring-4 ring-primary/20"
                      )}>
                        <Truck className="w-8 h-8 mb-3 text-primary" />
                        <span className="font-medium">Delivery</span>
                        {deliveryFee > 0 && <span className="text-xs text-primary mt-2">Fee: ₦{deliveryFee.toLocaleString()}</span>}
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="pickup" id="admin_pickup" className="peer sr-only" />
                      <Label htmlFor="admin_pickup" className={cn(
                        "flex flex-col items-center justify-center p-6 border-2 rounded-lg cursor-pointer transition-all duration-300 hover:border-primary/30",
                        fulfillmentType === 'pickup' && "border-primary bg-primary/5 shadow-lg ring-4 ring-primary/20"
                      )}>
                        <MapPin className="w-8 h-8 mb-3 text-primary" />
                        <span className="font-medium">Pickup</span>
                        <span className="text-xs text-muted-foreground mt-2">No delivery fee</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Delivery Address */}
              {fulfillmentType === 'delivery' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> Delivery Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <DeliveryZoneDropdown
                      selectedZoneId={deliveryZone?.id}
                      onZoneSelect={(zoneId, fee) => setDeliveryZone({ id: zoneId, base_fee: fee })}
                      orderSubtotal={subtotal}
                    />
                    <div>
                      <RequiredFieldLabel htmlFor="admin_address" required>Street Address</RequiredFieldLabel>
                      <Input id="admin_address" value={deliveryAddress.address_line_1} onChange={e => setDeliveryAddress(prev => ({ ...prev, address_line_1: e.target.value }))} placeholder="Enter street address" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <RequiredFieldLabel htmlFor="admin_city">City / Area</RequiredFieldLabel>
                        <Input id="admin_city" value={deliveryAddress.city} onChange={e => setDeliveryAddress(prev => ({ ...prev, city: e.target.value }))} placeholder="City" />
                      </div>
                      <div>
                        <RequiredFieldLabel htmlFor="admin_landmark">Landmark</RequiredFieldLabel>
                        <Input id="admin_landmark" value={deliveryAddress.landmark} onChange={e => setDeliveryAddress(prev => ({ ...prev, landmark: e.target.value }))} placeholder="Nearby landmark" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pickup Point */}
              {fulfillmentType === 'pickup' && (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-base text-center flex items-center justify-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      Select Pickup Location <span className="text-destructive">*</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PickupPointSelector
                      selectedPointId={pickupPoint?.id}
                      onSelect={point => setPickupPoint(point)}
                    />
                    {pickupPoint && (
                      <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                        <p className="text-sm font-medium">✅ Selected: {pickupPoint.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{pickupPoint.address}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Special Instructions */}
              <div>
                <RequiredFieldLabel htmlFor="admin_instructions">Special Instructions</RequiredFieldLabel>
                <Textarea 
                  id="admin_instructions" 
                  value={specialInstructions} 
                  onChange={e => setSpecialInstructions(e.target.value.slice(0, 250))} 
                  placeholder="Any special instructions for this order..." 
                  className="resize-none"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">{specialInstructions.length}/250</p>
              </div>
            </div>
          )}

          {/* STEP 4: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-4 h-4" /> Customer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><strong>Name:</strong> {customerName}</p>
                  <p><strong>Email:</strong> {customerEmail}</p>
                  <p><strong>Phone:</strong> {customerPhone}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {fulfillmentType === 'delivery' ? <Truck className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    Fulfillment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><strong>Type:</strong> {fulfillmentType === 'delivery' ? '🚚 Delivery' : '📍 Pickup'}</p>
                  {deliveryDate && <p><strong>Date:</strong> {new Date(deliveryDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  {deliveryTimeSlot && <p><strong>Time:</strong> {deliveryTimeSlot.start_time} - {deliveryTimeSlot.end_time}</p>}
                  {fulfillmentType === 'delivery' && deliveryAddress.address_line_1 && (
                    <p><strong>Address:</strong> {deliveryAddress.address_line_1}{deliveryAddress.city ? `, ${deliveryAddress.city}` : ''}{deliveryAddress.landmark ? ` (Near ${deliveryAddress.landmark})` : ''}</p>
                  )}
                  {fulfillmentType === 'pickup' && pickupPoint && (
                    <p><strong>Pickup:</strong> {pickupPoint.name} — {pickupPoint.address}</p>
                  )}
                  {specialInstructions && <p><strong>Instructions:</strong> {specialInstructions}</p>}
                </CardContent>
              </Card>

              {/* Order Summary - show on all screen sizes */}
              <OrderSummaryCard
                items={cart}
                subtotal={subtotal}
                deliveryFee={deliveryFee}
                total={total}
                className="block md:block border shadow-sm"
              />

              <div className="p-3 bg-accent/50 border border-accent rounded-lg text-sm">
                <p className="font-medium text-accent-foreground">💳 Payment Method: Bank Transfer</p>
                <p className="mt-1 text-muted-foreground">A virtual account number will be generated for the customer to make payment.</p>
              </div>
            </div>
          )}

          {/* STEP 5: Confirmation */}
          {step === 'confirmation' && createdOrder && (
            <div className="space-y-6 text-center py-8">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-primary" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold">Order Created Successfully!</h3>
                <p className="text-muted-foreground mt-1">Order #{createdOrder.order_number}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Total: <span className="font-bold text-primary">₦{createdOrder.total_amount?.toLocaleString()}</span>
                </p>
              </div>

              {virtualAccount && (
                <Card className="text-left border-accent bg-accent/30 max-w-md mx-auto">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-accent-foreground">🏦 Virtual Account Details</CardTitle>
                    <CardDescription>Customer should transfer to this account</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank:</span>
                        <span className="font-medium">{virtualAccount.bank_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account No:</span>
                        <span className="font-bold text-lg tracking-wider">{virtualAccount.account_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Name:</span>
                        <span className="font-medium">{virtualAccount.account_name}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="font-bold text-primary text-lg">₦{total.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!virtualAccount && (
                <Card className="text-left border-muted bg-muted/50 max-w-md mx-auto">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">
                      ⚠️ Virtual account generation is pending. The customer will receive payment details via email once available.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-center gap-3 pt-4">
                <Button onClick={handleDownloadPDF} variant="outline" size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download Invoice PDF
                </Button>
                <Button onClick={handleClose} size="lg">
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step !== 'confirmation' && (
          <div className="flex items-center justify-between p-4 border-t bg-background flex-shrink-0">
            <Button
              variant="outline"
              onClick={goToPrev}
              disabled={step === 'products'}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="text-sm text-muted-foreground">
              {cart.length > 0 && step !== 'products' && (
                <span>{cart.length} items • ₦{total.toLocaleString()}</span>
              )}
            </div>

            {step === 'review' ? (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="min-w-[180px]">
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                ) : (
                  <>Create Order • ₦{total.toLocaleString()}</>
                )}
              </Button>
            ) : (
              <Button
                onClick={goToNext}
                disabled={
                  (step === 'products' && !canProceedFromProducts) ||
                  (step === 'customer' && !canProceedFromCustomer) ||
                  (step === 'fulfillment' && !canProceedFromFulfillment)
                }
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};