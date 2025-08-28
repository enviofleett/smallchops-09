"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDetailedOrderData } from "@/hooks/useDetailedOrderData"
import { useBusinessSettings } from "@/hooks/useBusinessSettings"
import { toast } from "sonner"
import {
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Package,
  Printer,
  Calendar,
  AlertCircle,
  X,
  Truck,
  CreditCard,
  CheckCircle,
  Flame,
  Leaf,
  Soup,
  Box,
  AlertTriangle,
} from "lucide-react"
import { getProduct } from "@/api/products"

interface OrderDetailsModalProps {
  order: any
  isOpen: boolean
  onClose: () => void
}

const STARTERS_LOGO = "/logo-starters.svg"

const getStatusColor = (status: string) => {
  switch (status) {
    case "confirmed":
      return "bg-blue-50 text-blue-700 border-blue-200"
    case "preparing":
      return "bg-orange-50 text-orange-700 border-orange-200"
    case "ready":
      return "bg-green-50 text-green-700 border-green-200"
    case "out_for_delivery":
      return "bg-purple-50 text-purple-700 border-purple-200"
    case "delivered":
      return "bg-green-50 text-green-800 border-green-300"
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200"
    default:
      return "bg-muted text-muted-foreground border-border"
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(amount)

const formatDateTime = (dateString: string) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleString("en-NG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-NG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}

const formatTimeWindow = (start: string, end: string) => {
  if (!start || !end) return ""
  try {
    const s = start.split(":")
    const e = end.split(":")
    return `${s[0].padStart(2, "0")}:${s[1] || "00"} - ${e[0].padStart(2, "0")}:${e[1] || "00"}`
  } catch {
    return `${start} - ${end}`
  }
}

const formatAddress = (address: any) => {
  if (!address || typeof address !== "object") return "N/A"
  const parts = [address.address_line_1, address.address_line_2, address.city, address.state].filter(Boolean)
  return parts.join(", ") || "N/A"
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const { data: detailedOrder, isLoading, error } = useDetailedOrderData(order?.id)
  const { data: businessSettings } = useBusinessSettings()

  // Product features fetching
  const [productsData, setProductsData] = useState<Record<string, any>>({})
  const [featuresLoading, setFeaturesLoading] = useState(false)

  useEffect(() => {
    if (error) {
      toast.error("Failed to load order details")
    }
  }, [error])

  useEffect(() => {
    let isMounted = true
    async function fetchAllProducts() {
      if (!order?.order_items?.length) return
      setFeaturesLoading(true)
      try {
        const prods: Record<string, any> = {}
        await Promise.all(
          order.order_items.map(async (item: any) => {
            if (item.product_id) {
              try {
                const fullProduct = await getProduct(item.product_id)
                prods[item.product_id] = fullProduct
              } catch (err) {
                prods[item.product_id] = item.product || {}
              }
            } else {
              prods[item.id] = item.product || {}
            }
          })
        )
        if (isMounted) setProductsData(prods)
      } finally {
        if (isMounted) setFeaturesLoading(false)
      }
    }
    fetchAllProducts()
    return () => {
      isMounted = false
    }
  }, [order?.order_items])

  const shippingFee = Number(order?.delivery_fee ?? detailedOrder?.delivery_schedule?.delivery_fee ?? 0)
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - shippingFee)

  const deliverySchedule = detailedOrder?.delivery_schedule || order?.delivery_schedule || null
  const deliveryDate = deliverySchedule?.delivery_date
  const deliveryWindowStart = deliverySchedule?.delivery_time_start
  const deliveryWindowEnd = deliverySchedule?.delivery_time_end

  // Print handler: print modal content in a clear, full-width layout
  const handlePrint = () => {
    window.print()
  }

  // Features List UI block
  function FeaturesList({ product }: { product: any }) {
    if (!product) return null
    return (
      <div className="space-y-2">
        {product.features && (
          <div>
            <span className="font-semibold">Features:</span>
            {Array.isArray(product.features) ? (
              <ul className="list-disc ml-5 text-xs">
                {product.features.map((f: string, i: number) => <li key={i}>{f}</li>)}
              </ul>
            ) : typeof product.features === "object" ? (
              <ul className="list-disc ml-5 text-xs">
                {Object.entries(product.features).map(([k, v], i) => v ? <li key={i}><span className="font-semibold">{k}:</span> {String(v)}</li> : null)}
              </ul>
            ) : (
              <span className="ml-2 text-xs">{String(product.features)}</span>
            )}
          </div>
        )}
        {product.addOns?.length > 0 && (
          <div>
            <span className="font-semibold">Add-ons:</span>
            <ul className="list-disc ml-5 text-xs">
              {product.addOns.map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
        {product.allergen_info?.length > 0 && (
          <div>
            <span className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-orange-700" />Allergens:</span>
            <ul className="list-disc ml-5 text-xs text-orange-700">{product.allergen_info.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
          </div>
        )}
        <div className="flex flex-wrap gap-3 mt-1">
          {typeof product.preparation_time === "number" && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200"><Soup className="h-3 w-3 inline" /> Prep: {product.preparation_time} min</Badge>
          )}
          {typeof product.calories === "number" && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200"><Flame className="h-3 w-3 inline" /> {product.calories} kcal</Badge>
          )}
          {product.isSpicy && (
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300"><Flame className="h-3 w-3 inline" /> Spicy</Badge>
          )}
          {product.isVegetarian && (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300"><Leaf className="h-3 w-3 inline" /> Vegetarian</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mt-1">
          {typeof product.stock_quantity === "number" && (
            <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300"><Box className="h-3 w-3 inline" /> In stock: {product.stock_quantity}</Badge>
          )}
          {typeof product.minimum_order_quantity === "number" && (
            <Badge variant="outline" className="bg-indigo-100 text-indigo-700 border-indigo-300">Min order: {product.minimum_order_quantity}</Badge>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          id="order-details-modal-content"
          className="max-w-full w-full sm:max-w-[98vw] md:max-w-3xl lg:max-w-5xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-full print:h-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-4 py-4 sm:px-8 sm:py-6 border-b border-border/50 print:bg-white print:border-b print:px-0 print:py-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:flex-row print:items-center">
              <div className="flex items-center gap-4">
                <img src={STARTERS_LOGO || "/placeholder.svg"} alt="Starters Logo" className="h-10 w-auto print:h-12" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground print:text-black">Order Details</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="font-mono text-sm text-muted-foreground print:text-black">#{order?.order_number}</span>
                    <Badge className={`capitalize text-sm px-3 py-1 ${getStatusColor(order?.status)}`} variant="outline">
                      {order?.status?.replace(/_/g, " ") ?? "Unknown"}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 no-print">
                <Button variant="outline" size="sm" className="flex items-center gap-2 hover:bg-primary/10 bg-transparent" onClick={handlePrint}>
                  <Printer className="h-4 w-4" /> Print Receipt
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-destructive/10" aria-label="Close">
                    <X className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>

          {/* Order Summary Cards */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 bg-card/30 print:bg-white print:px-0 print:py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 print:grid-cols-3 print:gap-2">
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/5 border-primary/20 print:bg-white print:border-none print:shadow-none">
                <CardContent className="p-4 sm:p-6 print:p-2">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">{formatCurrency(order?.total_amount || 0)}</div>
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Ordered {order?.order_time && formatDateTime(order?.order_time)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 print:bg-white print:border-none print:shadow-none">
                <CardContent className="p-4 sm:p-6 print:p-2">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">Delivery</span>
                  </div>
                  {deliveryDate ? (
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-blue-700">{formatDate(deliveryDate)}</div>
                      {deliveryWindowStart && deliveryWindowEnd && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-muted-foreground">Schedule TBD</div>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 print:bg-white print:border-none print:shadow-none">
                <CardContent className="p-4 sm:p-6 print:p-2">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                  </div>
                  <div className="text-lg font-semibold text-green-700 capitalize">{order?.status?.replace(/_/g, " ") ?? "Unknown"}</div>
                  {shippingFee > 0 && (
                    <div className="mt-2">
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">{formatCurrency(shippingFee)} delivery</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator className="print:hidden" />

          {/* Customer & Delivery Info */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8 print:grid-cols-2 print:gap-2">
              <Card className="border-none shadow-sm bg-card/50 print:bg-white print:shadow-none print:border-none">
                <CardContent className="p-4 sm:p-6 print:p-2">
                  <div className="flex items-center gap-3 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="text-lg font-medium text-foreground">{order?.customer_name}</div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail className="h-4 w-4" />
                      <span>{order?.customer_email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{order?.customer_phone}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm bg-card/50 print:bg-white print:shadow-none print:border-none">
                <CardContent className="p-4 sm:p-6 print:p-2">
                  <div className="flex items-center gap-3 mb-4">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Delivery Address</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="text-foreground leading-relaxed">{formatAddress(order?.delivery_address)}</div>
                    {deliveryDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Scheduled for {formatDate(deliveryDate)}</span>
                      </div>
                    )}
                    {deliveryWindowStart && deliveryWindowEnd && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator className="print:hidden" />

          {/* Order Items */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2">
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Order Items ({order?.order_items?.length || 0})</h3>
            </div>
            {isLoading || featuresLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="border-border/50 print:shadow-none print:border-none">
                    <CardContent className="p-4 sm:p-6 print:p-2">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <div className="flex justify-between">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4 max-h-[38vh] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent print:max-h-full print:overflow-visible print:overflow-auto">
                {order?.order_items?.map((item: any, idx: number) => {
                  const product = productsData[item.product_id] || item.product || {}
                  return (
                    <Card key={item.id || idx} className="border-border/50 hover:shadow-md transition-shadow print:shadow-none print:border-none">
                      <CardContent className="p-4 sm:p-6 print:p-2">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-foreground mb-2">{item.product_name}</h4>
                            {product.description && (
                              <p className="text-sm text-muted-foreground mb-3">{product.description}</p>
                            )}
                            <FeaturesList product={product} />
                            {item.special_instructions && (
                              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mt-3 print:bg-white print:border-none print:rounded-none">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="text-sm font-medium text-orange-800">Special Instructions:</span>
                                    <p className="text-sm text-orange-700 mt-1">{item.special_instructions}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Qty:</span>
                              <Badge variant="outline" className="font-semibold">
                                {item.quantity}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Unit:</span>
                              <span className="font-semibold">{formatCurrency(item.unit_price)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="text-lg font-bold text-primary">{formatCurrency(item.total_price)}</span>
                            </div>
                            {item.status && (
                              <Badge variant="outline" className={`capitalize ${getStatusColor(item.status)}`}>
                                {item.status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {(!order?.order_items || order?.order_items.length === 0) && (
                  <Card className="border-dashed border-2 border-border/50 print:shadow-none print:border-none">
                    <CardContent className="p-12 text-center print:p-6">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No order items found.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
          {/* Cost Summary */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2">
            <div className="flex flex-col sm:flex-row justify-end gap-6 print:gap-2 bg-white print:bg-white">
              <div className="flex flex-col items-end gap-1">
                <div>
                  <span className="font-semibold">Subtotal:</span>{" "}
                  <span className="text-md">{formatCurrency(subtotal)}</span>
                </div>
                <div>
                  <span className="font-semibold">Delivery Fee:</span>{" "}
                  <span className="text-md">{formatCurrency(shippingFee)}</span>
                </div>
                <div>
                  <span className="font-semibold">Total:</span>{" "}
                  <span className="text-lg font-bold">{formatCurrency(order?.total_amount || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        @media (max-width: 640px) {
          #order-details-modal-content {
            max-width: 100vw !important;
            padding: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          .px-4, .sm\\:px-8 { padding-left: 8px !important; padding-right: 8px !important; }
          .py-4, .sm\\:py-6 { padding-top: 8px !important; padding-bottom: 8px !important; }
          .rounded-2xl { border-radius: 0 !important; }
        }
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        .scrollbar-thumb-primary\\/20 {
          scrollbar-color: var(--primary) #f3f4f6;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: var(--primary);
          border-radius: 8px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: #f3f4f6;
        }
        @media print {
          html, body {
            background: #fff !important;
            color: #222 !important;
          }
          #order-details-modal-content {
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            max-width: 100vw !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
          .scrollbar-thin, .scrollbar-thumb-primary\\/20, .scrollbar-track-transparent {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            overflow: visible !important;
          }
          .print\\:shadow-none, .print\\:border-none, .print\\:rounded-none, .print\\:p-0, .print\\:max-w-full {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            max-width: 100vw !important;
          }
          .print\\:bg-white {
            background: #fff !important;
          }
        }
      `}</style>
    </>
  )
}
