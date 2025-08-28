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

  const handlePrint = () => {
    window.print()
  }

  function FeaturesList({ product }: { product: any }) {
    if (!product) return null
    return (
      <div className="mb-2">
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
        <div className="flex flex-wrap gap-2 mt-1">
          {typeof product.preparation_time === "number" && (
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">Prep: {product.preparation_time} min</Badge>
          )}
          {typeof product.calories === "number" && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">{product.calories} kcal</Badge>
          )}
          {product.isSpicy && (
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">Spicy</Badge>
          )}
          {product.isVegetarian && (
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">Vegetarian</Badge>
          )}
          {typeof product.stock_quantity === "number" && (
            <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300">In stock: {product.stock_quantity}</Badge>
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
          className="max-w-full w-full sm:max-w-4xl md:max-w-5xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-full print:h-auto print:bg-white"
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-primary via-primary to-secondary px-4 sm:px-8 py-5 sm:py-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <img src={STARTERS_LOGO || "/placeholder.svg"} alt="Starters Logo" className="h-6 w-auto" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">Order Details</h2>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm text-white/80 bg-white/10 px-2 sm:px-3 py-1 rounded-full">
                        #{order?.order_number}
                      </span>
                      <Badge className="capitalize text-xs sm:text-sm px-2 sm:px-3 py-1 bg-white/20 text-white border-white/30 backdrop-blur-sm" variant="outline">
                        {order?.status?.replace(/_/g, " ") ?? "Unknown"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 no-print">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print Receipt</span>
                </Button>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 backdrop-blur-sm"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>

          {/* SUMMARY GRID */}
          <div className="px-3 sm:px-8 py-4 bg-gradient-to-b from-card/20 to-transparent">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {/* ...cards as before... */}
              <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary mb-2">
                    {formatCurrency(order?.total_amount || 0)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-balance">
                      Ordered {order?.order_time && formatDateTime(order?.order_time)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 via-blue-25 to-indigo-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Delivery</span>
                  </div>
                  {deliveryDate ? (
                    <div className="space-y-2">
                      <div className="text-lg sm:text-xl font-semibold text-blue-700">{formatDate(deliveryDate)}</div>
                      {deliveryWindowStart && deliveryWindowEnd && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                          {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-muted-foreground">Schedule TBD</div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 via-green-25 to-emerald-50 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 md:col-span-2 lg:col-span-1">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                  </div>
                  <div className="text-lg sm:text-xl font-semibold text-green-700 capitalize mb-2">
                    {order?.status?.replace(/_/g, " ") ?? "Unknown"}
                  </div>
                  {shippingFee > 0 && (
                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
                      +{formatCurrency(shippingFee)} delivery
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator className="mx-8" />

          {/* INFO GRID */}
          <div className="px-3 sm:px-8 py-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-8">
              <Card className="border-border/50 shadow-md bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="text-xl font-medium text-foreground">{order?.customer_name}</div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span className="break-all">{order?.customer_email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Phone className="h-4 w-4 flex-shrink-0" />
                      <span>{order?.customer_phone}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50 shadow-md bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">Delivery Address</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="text-foreground leading-relaxed text-pretty">
                      {formatAddress(order?.delivery_address)}
                    </div>
                    {deliveryDate && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>Scheduled for {formatDate(deliveryDate)}</span>
                      </div>
                    )}
                    {deliveryWindowStart && deliveryWindowEnd && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                          {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator className="mx-8" />

          {/* ORDER ITEMS */}
          <div className="px-3 sm:px-8 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground">Order Items ({order?.order_items?.length || 0})</h3>
            </div>
            <div className="space-y-4 max-h-[38vh] overflow-y-auto scrollbar-thin pr-1 sm:pr-2">
              {isLoading || featuresLoading ? (
                <div>
                  {[...Array(2)].map((_, i) => (
                    <Card key={i} className="border-border/50">
                      <CardContent className="p-6">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-1/2 mb-4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                order?.order_items?.map((item: any, idx: number) => {
                  const product = productsData[item.product_id] || item.product || {}
                  return (
                    <Card key={item.id || idx} className="border-border/50 hover:shadow-lg transition-all duration-300 bg-card/30 backdrop-blur-sm">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-lg font-semibold text-foreground mb-2 text-balance">
                                {item.product_name}
                              </h4>
                              {product.description && (
                                <p className="text-sm text-muted-foreground mb-3 text-pretty">
                                  {product.description}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-row sm:flex-col gap-4 sm:gap-2 text-sm sm:text-right">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Qty:</span>
                                <Badge variant="outline" className="font-semibold bg-primary/10 text-primary border-primary/30">
                                  {item.quantity}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Unit:</span>
                                <span className="font-semibold">{formatCurrency(item.unit_price)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Total:</span>
                                <span className="text-lg font-bold text-primary">
                                  {formatCurrency(item.total_price)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <FeaturesList product={product} />
                          {item.special_instructions && (
                            <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-orange-800 block mb-1">
                                    Special Instructions:
                                  </span>
                                  <p className="text-sm text-orange-700 text-pretty">{item.special_instructions}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          {item.status && (
                            <div className="flex justify-end">
                              <Badge variant="outline" className={`capitalize ${getStatusColor(item.status)}`}>
                                {item.status}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })
              )}
              {(!order?.order_items || order?.order_items.length === 0) && (
                <Card className="border-dashed border-2 border-border/50 bg-muted/20">
                  <CardContent className="p-12 text-center">
                    <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg">No order items found.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        @media (max-width: 640px) {
          .max-w-full, .sm\\:max-w-4xl, .md\\:max-w-5xl {
            max-width: 100vw !important;
          }
          .px-3, .sm\\:px-8 { padding-left: 8px !important; padding-right: 8px !important; }
          .py-4, .sm\\:py-8 { padding-top: 8px !important; padding-bottom: 8px !important; }
          .rounded-2xl { border-radius: 0 !important; }
        }
        .scrollbar-thin {
          scrollbar-width: thin;
        }
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
          background: #e5e7eb;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #ea580c;
          border-radius: 8px;
        }
        @media print {
          html, body {
            background: #fff !important;
            color: #222 !important;
            font-size: 13px !important;
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
            background: #fff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}
