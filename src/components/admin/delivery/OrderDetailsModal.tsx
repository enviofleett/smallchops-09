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

  // Features List UI block
  function FeaturesList({ product }: { product: any }) {
    if (!product) return null
    return (
      <table className="features-table print:features-table w-full mb-2">
        <tbody>
          {product.features && (
            <tr>
              <th className="text-xs text-left font-bold print:text-xs">Features</th>
              <td className="text-xs print:text-xs">
                {Array.isArray(product.features) ? (
                  <ul className="list-disc ml-4 mb-0">
                    {product.features.map((f: string, i: number) => <li key={i}>{f}</li>)}
                  </ul>
                ) : typeof product.features === "object" ? (
                  <ul className="list-disc ml-4 mb-0">
                    {Object.entries(product.features).map(([k, v], i) => v ? <li key={i}><span className="font-semibold">{k}:</span> {String(v)}</li> : null)}
                  </ul>
                ) : (
                  <span>{String(product.features)}</span>
                )}
              </td>
            </tr>
          )}
          {product.addOns?.length > 0 && (
            <tr>
              <th className="text-xs text-left font-bold print:text-xs">Add-ons</th>
              <td className="text-xs print:text-xs">
                <ul className="list-disc ml-4 mb-0">{product.addOns.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </td>
            </tr>
          )}
          {product.allergen_info?.length > 0 && (
            <tr>
              <th className="text-xs text-left font-bold print:text-xs">Allergens</th>
              <td className="text-xs text-orange-700 print:text-xs">
                <ul className="list-disc ml-4 mb-0">{product.allergen_info.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
              </td>
            </tr>
          )}
          <tr>
            <th className="text-xs text-left font-bold print:text-xs">Details</th>
            <td className="text-xs print:text-xs">
              <div className="flex flex-wrap gap-2">
                {typeof product.preparation_time === "number" && (
                  <span className="badge badge-blue print:badge-blue">Prep: {product.preparation_time} min</span>
                )}
                {typeof product.calories === "number" && (
                  <span className="badge badge-yellow print:badge-yellow">{product.calories} kcal</span>
                )}
                {product.isSpicy && (
                  <span className="badge badge-red print:badge-red">Spicy</span>
                )}
                {product.isVegetarian && (
                  <span className="badge badge-green print:badge-green">Vegetarian</span>
                )}
                {typeof product.stock_quantity === "number" && (
                  <span className="badge badge-gray print:badge-gray">In stock: {product.stock_quantity}</span>
                )}
                {typeof product.minimum_order_quantity === "number" && (
                  <span className="badge badge-indigo print:badge-indigo">Min order: {product.minimum_order_quantity}</span>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          id="order-details-modal-content"
          className="max-w-full w-full sm:max-w-[98vw] md:max-w-3xl lg:max-w-5xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl print:shadow-none print:border-none print:rounded-none print:p-0 print:max-w-full print:h-auto print:bg-white"
        >
          {/* Print-friendly header */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-border/50 print:pt-0 print:pb-2 print:px-0 print:border-b print:bg-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:flex-row print:items-center">
              <div className="flex items-center gap-4">
                <img src={STARTERS_LOGO || "/placeholder.svg"} alt="Starters Logo" className="h-10 w-auto print:h-12" />
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground print:text-2xl print:text-black">Order Details</h2>
                  <div className="flex items-center gap-3 mt-1 flex-wrap print:mt-2">
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

          {/* Section: Meta Summary */}
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2">
            <div className="print:grid print:grid-cols-3 print:gap-4 flex flex-col md:flex-row gap-4 sm:gap-6">
              <div className="print:border-r print:pr-8">
                <div className="font-bold text-lg text-primary print:text-lg">Total Amount</div>
                <div className="font-bold text-2xl text-primary print:text-2xl">{formatCurrency(order?.total_amount || 0)}</div>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground print:text-xs">
                  <Clock className="h-4 w-4" />
                  <span>Ordered {order?.order_time && formatDateTime(order?.order_time)}</span>
                </div>
              </div>
              <div className="print:border-r print:pr-8">
                <div className="font-bold text-lg text-blue-700 print:text-lg">Delivery</div>
                <div className="text-md font-semibold">{deliveryDate && formatDate(deliveryDate)}</div>
                {deliveryWindowStart && deliveryWindowEnd && (
                  <span className="badge badge-blue print:badge-blue">{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</span>
                )}
              </div>
              <div>
                <div className="font-bold text-lg text-green-700 print:text-lg">Status</div>
                <div className="font-semibold capitalize">{order?.status?.replace(/_/g, " ") ?? "Unknown"}</div>
                {shippingFee > 0 && (
                  <span className="badge badge-green print:badge-green">{formatCurrency(shippingFee)} delivery</span>
                )}
              </div>
            </div>
          </div>

          {/* Section: Customer & Delivery Info */}
          <hr className="my-3 print:my-2 border-t border-border" />
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2 print:grid print:grid-cols-2 print:gap-4 flex flex-col md:flex-row gap-4 sm:gap-8">
            <div>
              <div className="font-bold text-md mb-2 print:mb-1">Customer Information</div>
              <div className="mb-1">{order?.customer_name}</div>
              <div className="mb-1">{order?.customer_email}</div>
              <div className="mb-2">{order?.customer_phone}</div>
            </div>
            <div>
              <div className="font-bold text-md mb-2 print:mb-1">Delivery Address</div>
              <div className="mb-1">{formatAddress(order?.delivery_address)}</div>
              {deliveryDate && (
                <div className="mb-1">
                  <Calendar className="inline h-4 w-4" /> Scheduled for {formatDate(deliveryDate)}
                </div>
              )}
              {deliveryWindowStart && deliveryWindowEnd && (
                <div>
                  <Clock className="inline h-4 w-4" /> <span className="badge badge-blue print:badge-blue">{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section: Order Items */}
          <hr className="my-3 print:my-2 border-t border-border" />
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2">
            <div className="font-bold text-md mb-2">Order Items ({order?.order_items?.length || 0})</div>
            {isLoading || featuresLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-2 print:p-1">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                  </div>
                ))}
              </div>
            ) : (
              order?.order_items?.map((item: any, idx: number) => {
                const product = productsData[item.product_id] || item.product || {}
                return (
                  <div key={item.id || idx} className="mb-5 pb-2 print:mb-4 print:pb-2 border-b border-border print:border-b print:border-gray-300">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-2 print:flex-row print:justify-between print:items-center">
                      <div>
                        <div className="font-semibold text-lg">{item.product_name}</div>
                        {product.description && (
                          <div className="text-xs text-muted-foreground print:text-xs">{product.description}</div>
                        )}
                      </div>
                      <div className="flex flex-row gap-4 print:gap-4 text-sm mt-2 md:mt-0">
                        <span><b>Qty:</b> {item.quantity}</span>
                        <span><b>Unit:</b> {formatCurrency(item.unit_price)}</span>
                        <span><b>Total:</b> {formatCurrency(item.total_price)}</span>
                      </div>
                    </div>
                    <FeaturesList product={product} />
                    {item.special_instructions && (
                      <div className="p-2 print:p-1 my-2 bg-orange-50 border border-orange-200 rounded-lg print:bg-white print:border-none print:rounded-none">
                        <span className="font-medium text-orange-800">Special Instructions:</span>
                        <span className="text-sm text-orange-700 ml-2">{item.special_instructions}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
            {(!order?.order_items || order?.order_items.length === 0) && (
              <div className="border-dashed border-2 border-border/50 print:border-none p-6 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No order items found.</p>
              </div>
            )}
          </div>

          {/* Section: Summary */}
          <hr className="my-3 print:my-2 border-t border-border" />
          <div className="px-4 py-4 sm:px-8 sm:py-6 print:px-0 print:py-2 flex flex-col items-end">
            <table className="summary-table print:summary-table">
              <tbody>
                <tr>
                  <td className="font-semibold pr-4">Subtotal:</td>
                  <td>{formatCurrency(subtotal)}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-4">Delivery Fee:</td>
                  <td>{formatCurrency(shippingFee)}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-4">Total:</td>
                  <td className="font-bold text-lg">{formatCurrency(order?.total_amount || 0)}</td>
                </tr>
              </tbody>
            </table>
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
        .features-table th {
          font-weight: bold;
          min-width: 80px;
          vertical-align: top;
          padding-right: 8px;
        }
        .features-table td {
          padding-bottom: 4px;
        }
        .summary-table td {
          padding: 2px 8px 2px 0;
        }
        .badge {
          display: inline-block;
          border-radius: 4px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 500;
          margin-right: 4px;
          margin-bottom: 2px;
        }
        .badge-blue { background: #e0eaff; color: #2563eb; }
        .badge-yellow { background: #fef3c7; color: #d97706; }
        .badge-red { background: #fee2e2; color: #dc2626; }
        .badge-green { background: #d1fae5; color: #059669; }
        .badge-gray { background: #f3f4f6; color: #4b5563; }
        .badge-indigo { background: #e0e7ff; color: #3730a3; }
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
          .features-table, .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px !important;
            margin-bottom: 0 !important;
          }
          .features-table th, .features-table td, .summary-table td {
            padding: 2px 8px 2px 0 !important;
            border: none !important;
          }
          .badge {
            font-size: 11px !important;
            margin-bottom: 0 !important;
          }
          hr {
            border-top: 1px solid #e5e7eb !important;
            margin: 12px 0 !important;
          }
        }
      `}</style>
    </>
  )
}
