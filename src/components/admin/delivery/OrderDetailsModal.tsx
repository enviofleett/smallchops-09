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
} from "lucide-react"

// If you want to fetch full product features from API, import getProduct, and use below
// import { getProduct } from "@/api/products"

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

// Enhanced product features parser (array, object, string)
const getProductFeatures = (product: any) => {
  if (!product?.features) return null
  if (typeof product.features === "string") {
    try {
      return JSON.parse(product.features)
    } catch {
      return [product.features]
    }
  }
  return product.features
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const { data: detailedOrder, isLoading, error } = useDetailedOrderData(order?.id)
  const { data: businessSettings } = useBusinessSettings()

  useEffect(() => {
    if (error) {
      toast.error("Failed to load order details")
    }
  }, [error])

  // Delivery fee and subtotal calculation
  const shippingFee = Number(order?.delivery_fee ?? detailedOrder?.delivery_schedule?.delivery_fee ?? 0)
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - shippingFee)

  // Delivery schedule info
  const deliverySchedule = detailedOrder?.delivery_schedule || order?.delivery_schedule || null
  const deliveryDate = deliverySchedule?.delivery_date
  const deliveryWindowStart = deliverySchedule?.delivery_time_start
  const deliveryWindowEnd = deliverySchedule?.delivery_time_end

  const handlePrint = () => {
    window.print()
  }

  const modalContentStyles =
    "max-w-[96vw] w-full sm:max-w-5xl max-h-[95vh] overflow-hidden rounded-2xl bg-background p-0 border shadow-2xl"

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={modalContentStyles}>
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 px-8 py-6 border-b border-border/50">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <img src={STARTERS_LOGO || "/placeholder.svg"} alt="Starters Logo" className="h-10 w-auto" />
                  <div className="flex flex-col">
                    <h2 className="text-2xl font-bold text-foreground">Order Details</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-mono text-sm text-muted-foreground">#{order?.order_number}</span>
                      <Badge
                        className={`capitalize text-sm px-3 py-1 ${getStatusColor(order?.status)}`}
                        variant="outline"
                      >
                        {order?.status?.replace(/_/g, " ") ?? "Unknown"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 hover:bg-primary/10 bg-transparent"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                  Print Receipt
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="hover:bg-destructive/10" aria-label="Close">
                    <X className="h-5 w-5" />
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 bg-card/30">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order Total Card */}
              <Card className="bg-gradient-to-br from-primary/10 to-secondary/5 border-primary/20">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                  </div>
                  <div className="text-3xl font-bold text-primary">{formatCurrency(order?.total_amount || 0)}</div>
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Ordered {order?.order_time && formatDateTime(order?.order_time)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Schedule Card */}
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">Delivery</span>
                  </div>
                  {deliveryDate ? (
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-blue-700">{formatDate(deliveryDate)}</div>
                      {deliveryWindowStart && deliveryWindowEnd && (
                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                          {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-lg font-semibold text-muted-foreground">Schedule TBD</div>
                  )}
                </CardContent>
              </Card>

              {/* Status Card */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-muted-foreground">Status</span>
                  </div>
                  <div className="text-lg font-semibold text-green-700 capitalize">
                    {order?.status?.replace(/_/g, " ") ?? "Unknown"}
                  </div>
                  {shippingFee > 0 && (
                    <div className="mt-2">
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        +{formatCurrency(shippingFee)} delivery
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          <div className="px-8 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="border-none shadow-sm bg-card/50">
                <CardContent className="p-6">
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

              <Card className="border-none shadow-sm bg-card/50">
                <CardContent className="p-6">
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
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator />

          <div className="px-8 py-6">
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-6 w-6 text-primary" />
              <h3 className="text-xl font-semibold text-foreground">Order Items ({order?.order_items?.length || 0})</h3>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="border-border/50">
                    <CardContent className="p-6">
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
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {order?.order_items?.map((item: any, idx: number) => {
                  let features = getProductFeatures(item.product)
                  if (!features && item?.features) {
                    features = item.features
                  }
                  return (
                    <Card key={item.id || idx} className="border-border/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-lg font-semibold text-foreground mb-2">{item.product_name}</h4>
                            {item.product?.description && (
                              <p className="text-sm text-muted-foreground mb-3">{item.product.description}</p>
                            )}

                            {/* Features/details */}
                            {features && (
                              <div className="mb-3 p-3 bg-muted/30 rounded-lg">
                                <span className="text-sm font-medium text-foreground block mb-2">What's included:</span>
                                {typeof features === "object" && !Array.isArray(features) ? (
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    {Object.entries(features).map(([key, value], i) =>
                                      value ? (
                                        <li key={i} className="flex gap-2">
                                          <span className="font-medium">{key}:</span>
                                          <span>{String(value)}</span>
                                        </li>
                                      ) : null,
                                    )}
                                  </ul>
                                ) : Array.isArray(features) ? (
                                  <ul className="text-sm text-muted-foreground space-y-1">
                                    {features.map((f, i) =>
                                      f ? (
                                        <li key={i} className="flex items-center gap-2">
                                          <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                                          {String(f)}
                                        </li>
                                      ) : null,
                                    )}
                                  </ul>
                                ) : (
                                  <span className="text-sm text-muted-foreground">{String(features)}</span>
                                )}
                              </div>
                            )}

                            {item.special_instructions && (
                              <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
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
                  <Card className="border-dashed border-2 border-border/50">
                    <CardContent className="p-12 text-center">
                      <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No order items found.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
