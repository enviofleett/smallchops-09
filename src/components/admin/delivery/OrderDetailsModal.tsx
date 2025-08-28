"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  AlertTriangle,
  Box,
  Car,
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
    case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200"
    case "preparing": return "bg-green-50 text-green-700 border-green-200"
    case "ready": return "bg-green-50 text-green-700 border-green-200"
    case "out_for_delivery": return "bg-purple-50 text-purple-700 border-purple-200"
    case "delivered": return "bg-green-50 text-green-800 border-green-300"
    case "cancelled": return "bg-red-50 text-red-700 border-red-200"
    default: return "bg-muted text-muted-foreground border-border"
  }
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount)

const formatDateTime = (dateString: string) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleString("en-NG", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    })
  } catch { return dateString }
}

const formatDate = (dateString: string) => {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-NG", {
      year: "numeric", month: "long", day: "numeric"
    })
  } catch { return dateString }
}

const formatTimeWindow = (start: string, end: string) => {
  if (!start || !end) return ""
  try {
    const s = start.split(":"); const e = end.split(":")
    return `${s[0].padStart(2, "0")}:${s[1] || "00"} - ${e[0].padStart(2, "0")}:${e[1] || "00"}`
  } catch { return `${start} - ${end}` }
}

const formatAddress = (address: any) => {
  if (!address || typeof address !== "object") return "N/A"
  const parts = [address.address_line_1, address.address_line_2, address.city, address.state].filter(Boolean)
  return parts.join(", ") || "N/A"
}

function FeaturesList({ product }: { product: any }) {
  if (!product) return null
  const bulletPoints: string[] = []

  if (product.features) {
    if (Array.isArray(product.features)) {
      bulletPoints.push(...product.features.map(f => String(f)))
    } else if (typeof product.features === "object") {
      bulletPoints.push(...Object.entries(product.features).map(([k, v]) => v ? `${k}: ${v}` : ""))
    } else {
      bulletPoints.push(String(product.features))
    }
  }
  if (product.addOns?.length > 0) {
    bulletPoints.push(...product.addOns.map(a => `Add-on: ${a}`))
  }
  if (product.allergen_info?.length > 0) {
    bulletPoints.push(...product.allergen_info.map(a => `Allergen: ${a}`))
  }
  if (typeof product.preparation_time === "number") bulletPoints.push(`Prep: ${product.preparation_time} min`)
  if (typeof product.stock_quantity === "number") bulletPoints.push(`In stock: ${product.stock_quantity}`)
  if (typeof product.minimum_order_quantity === "number") bulletPoints.push(`Min order: ${product.minimum_order_quantity}`)

  return (
    <div className="mb-2">
      <span className="font-semibold">Product Details:</span>
      <ul className="list-disc ml-5 text-xs">
        {bulletPoints.map((point, i) => <li key={i}>{point}</li>)}
      </ul>
    </div>
  )
}

function getCleanDescription(desc: string) {
  if (!desc) return ""
  return desc.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const { data: detailedOrder, isLoading, error } = useDetailedOrderData(order?.id)
  const { data: businessSettings } = useBusinessSettings()
  const [productsData, setProductsData] = useState<Record<string, any>>({})
  const [featuresLoading, setFeaturesLoading] = useState(false)
  const [driverContact, setDriverContact] = useState<any>(null)
  const modalPrintRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) toast.error("Failed to load order details")
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
    return () => { isMounted = false }
  }, [order?.order_items])

  useEffect(() => {
    async function fetchDriverContact() {
      if (order?.dispatch_id) {
        try {
          const resp = await fetch(`/api/dispatch/${order.dispatch_id}`)
          if (resp.ok) {
            const driver = await resp.json()
            setDriverContact(driver)
          }
        } catch { setDriverContact(null) }
      }
    }
    fetchDriverContact()
  }, [order?.dispatch_id])

  const shippingFee = Number(order?.delivery_fee ?? detailedOrder?.delivery_schedule?.delivery_fee ?? 0)
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - shippingFee)
  const deliverySchedule = detailedOrder?.delivery_schedule || order?.delivery_schedule || null
  const deliveryDate = deliverySchedule?.delivery_date
  const deliveryWindowStart = deliverySchedule?.delivery_time_start
  const deliveryWindowEnd = deliverySchedule?.delivery_time_end

  // Print logic fitted inside modal UI
  const handlePrint = () => {
    if (modalPrintRef.current) {
      // Save original body content
      const originalContents = document.body.innerHTML
      // Copy modal contents to body for print
      document.body.innerHTML = modalPrintRef.current.innerHTML
      window.print()
      // Restore original body content
      document.body.innerHTML = originalContents
      window.location.reload()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        id="order-details-modal-content"
        aria-describedby="order-details-description"
        className="max-w-full w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl"
      >
        <DialogTitle>
          <div className="flex items-center gap-3">
            <img src={STARTERS_LOGO} alt="Logo" className="h-8 w-auto rounded shadow" />
            <span className="text-2xl font-bold">Order Details</span>
          </div>
        </DialogTitle>
        <DialogDescription id="order-details-description">
          Full information about this order, including customer, delivery, items, and status.
        </DialogDescription>
        <div ref={modalPrintRef}>
          <div className="px-3 py-4 sm:px-6 sm:py-6 bg-background">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="shadow-none border border-border rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">Total Amount</span>
                  </div>
                  <div className="text-2xl font-bold text-primary">{formatCurrency(order?.total_amount || 0)}</div>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Ordered {order?.order_time && formatDateTime(order?.order_time)}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none border border-border rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium">Delivery</span>
                  </div>
                  <div className="text-md font-semibold text-blue-700">{deliveryDate && formatDate(deliveryDate)}</div>
                  {deliveryWindowStart && deliveryWindowEnd && (
                    <Badge variant="outline" className="mt-2 bg-blue-50 text-blue-700 border-blue-200">
                      {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                    </Badge>
                  )}
                </CardContent>
              </Card>
              <Card className="shadow-none border border-border rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <div className="font-bold text-green-700 capitalize">{order?.status?.replace(/_/g, " ") ?? "Unknown"}</div>
                  {shippingFee > 0 && (
                    <Badge variant="outline" className="mt-2 bg-green-100 text-green-700 border-green-300">
                      +{formatCurrency(shippingFee)} delivery
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="px-3 py-4 sm:px-6 sm:py-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-none border border-border rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Customer Information</span>
                  </div>
                  <div className="font-medium text-base">{order?.customer_name}</div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                    <Mail className="h-4 w-4" />
                    <span>{order?.customer_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                    <Phone className="h-4 w-4" />
                    <span>{order?.customer_phone}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-none border border-border rounded-xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Delivery Address</span>
                  </div>
                  <div className="text-base">{formatAddress(order?.delivery_address)}</div>
                  {deliveryDate && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                      <Calendar className="h-4 w-4" />
                      <span>Scheduled for {formatDate(deliveryDate)}</span>
                    </div>
                  )}
                  {deliveryWindowStart && deliveryWindowEnd && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                      <Clock className="h-4 w-4" />
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            {driverContact && (
              <Card className="shadow-none border border-border rounded-xl mt-4">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Car className="h-5 w-5 text-indigo-600" />
                    <span className="font-semibold">Driver Contact</span>
                  </div>
                  <div className="font-medium text-base">{driverContact.name}</div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                    <Phone className="h-4 w-4" />
                    <span>{driverContact.phone}</span>
                  </div>
                  {driverContact.email && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                      <Mail className="h-4 w-4" />
                      <span>{driverContact.email}</span>
                    </div>
                  )}
                  {driverContact.vehicle && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
                      <Box className="h-4 w-4" />
                      <span>{driverContact.vehicle}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          <div className="px-3 py-4 sm:px-6 sm:py-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">Order Items ({order?.order_items?.length || 0})</span>
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
                    <Card key={item.id || idx} className="shadow-none border border-border rounded-xl">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-base mb-1">{item.product_name}</h4>
                            {product.description && (
                              <div className="text-sm text-muted-foreground mb-2">
                                {getCleanDescription(product.description)}
                              </div>
                            )}
                            <FeaturesList product={product} />
                          </div>
                          <div className="flex flex-col gap-1 text-right sm:min-w-[160px]">
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-muted-foreground text-sm">Qty:</span>
                              <span className="font-bold">{item.quantity}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-muted-foreground text-sm">Unit:</span>
                              <span className="font-bold">{formatCurrency(item.unit_price)}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-muted-foreground text-sm">Total:</span>
                              <span className="font-bold text-primary">{formatCurrency(item.total_price)}</span>
                            </div>
                          </div>
                        </div>
                        {item.special_instructions && (
                          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-orange-600" />
                              <span className="font-medium text-orange-800">Special Instructions:</span>
                              <span className="text-sm text-orange-700">{item.special_instructions}</span>
                            </div>
                          </div>
                        )}
                        {item.status && (
                          <div className="flex justify-end mt-2">
                            <Badge variant="outline" className={`capitalize ${getStatusColor(item.status)}`}>
                              {item.status}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })
              )}
              {(!order?.order_items || order?.order_items.length === 0) && (
                <Card className="border-dashed border-2 border-border/50 bg-muted/20">
                  <CardContent className="p-8 text-center">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg">No order items found.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
          {/* FOOTER */}
          <div className="px-5 py-4 flex flex-col items-end bg-background rounded-b-2xl">
            <div className="flex flex-col gap-1">
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
            {/* Print Button */}
            <div className="mt-4 flex gap-2 no-print">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print</span>
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            </div>
          </div>
        </div>
      </DialogContent>
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #order-details-modal-content, #order-details-modal-content * {
            visibility: visible;
          }
          #order-details-modal-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100vw !important;
            height: auto !important;
            max-width: 100vw !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            background: #fff !important;
            color: #222 !important;
            z-index: 9999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </Dialog>
  )
}
