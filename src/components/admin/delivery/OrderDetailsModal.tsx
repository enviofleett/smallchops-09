"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog"
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
      <ul className="list-disc ml-5 text-xs print:text-sm">
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

  // Custom print handler prints only modal content
  const handlePrint = () => {
    if (modalPrintRef.current) {
      const printContents = modalPrintRef.current.innerHTML
      const printWindow = window.open("", "", "height=900,width=1200")
      printWindow!.document.write(`
        <html>
          <head>
            <title>Order Details</title>
            <style>
              body { font-family: 'Inter', Arial, sans-serif; background: #f6f8fa; color: #222; margin: 0; }
              .modal-print-main { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 32px #0002; }
              .print-header { display: flex; align-items: center; justify-content: space-between; background: linear-gradient(90deg, #1e293b 70%, #64748b 100%); color: #fff; border-radius: 16px 16px 0 0; padding: 32px 32px 18px 32px; }
              .print-title { font-size: 2rem; font-weight: bold; }
              .print-logo { height: 38px; margin-right: 20px; }
              .card-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 24px 32px; }
              .card { background: #f8fafc; border-radius: 14px; box-shadow: 0 2px 12px #0001; padding: 18px 20px; }
              .card .label { font-size: 1rem; font-weight: 500; color: #64748b; display: flex; align-items: center; }
              .card .value { font-size: 1.3rem; font-weight: bold; margin: 7px 0 5px 0; }
              .card .extra { font-size: 0.97rem; color: #475569; margin-top: 2px; }
              .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 0 32px 24px 32px; }
              .info-card { background: #f8fafc; border-radius: 14px; box-shadow: 0 2px 12px #0001; padding: 18px 20px; }
              .info-title { font-weight: 600; margin-bottom: 12px; font-size: 1.07rem; }
              .info-value { font-size: 1.08rem; font-weight: 500; margin-bottom: 6px; }
              .info-row .icon { margin-right: 8px; }
              .section-title { font-size: 1.15rem; font-weight: 600; margin: 28px 32px 10px 32px; letter-spacing: 0.01em; }
              .items-list { margin: 0 32px 24px 32px; }
              .item-card { background: #f8fafc; border-radius: 14px; box-shadow: 0 2px 12px #0001; padding: 20px 18px; margin-bottom: 14px; }
              .item-title { font-size: 1.08rem; font-weight: 600; margin-bottom: 3px; }
              .item-desc { font-size: 0.98rem; color: #475569; margin-bottom: 7px; }
              .item-features { margin-bottom: 9px; }
              .item-features ul { margin-left: 23px; font-size: 0.99rem; }
              .item-qty-row { text-align: right; font-size: 0.99rem; margin-top: 7px; }
              .summary-row { text-align: right; margin: 0 32px 32px 0; font-size: 1.02rem; }
              .summary-row .summary-label { font-weight: 600; margin-right: 8px; }
              @media print {
                body { background: #fff !important; }
                .modal-print-main { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; }
                .print-header { border-radius: 0 !important; }
                .card, .info-card, .item-card { box-shadow: none !important; }
                .section-title, .card-row, .info-row, .items-list { page-break-inside: avoid; }
                .item-card { page-break-inside: avoid; }
              }
            </style>
          </head>
          <body>
            <div class="modal-print-main">${printContents}</div>
          </body>
        </html>
      `)
      printWindow!.document.close()
      printWindow!.focus()
      printWindow!.print()
      setTimeout(() => printWindow!.close(), 1200)
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
          Order Details
        </DialogTitle>
        <DialogDescription id="order-details-description">
          Full information about this order, including customer, delivery, items, and status.
        </DialogDescription>
        <div ref={modalPrintRef}>
          {/* Header */}
          <div className="print-header">
            <div style={{ display: "flex", alignItems: "center" }}>
              <img src={STARTERS_LOGO} alt="Logo" className="print-logo" />
              <span className="print-title">Order Details</span>
            </div>
            <div className="no-print">
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

          {/* Summary grid */}
          <div className="card-row">
            <div className="card">
              <div className="label"><CreditCard className="h-5 w-5 icon" />Total Amount</div>
              <div className="value">{formatCurrency(order?.total_amount || 0)}</div>
              <div className="extra"><Clock className="h-4 w-4 icon" />Ordered {order?.order_time && formatDateTime(order?.order_time)}</div>
            </div>
            <div className="card">
              <div className="label"><Truck className="h-5 w-5 icon" />Delivery</div>
              <div className="value">{deliveryDate && formatDate(deliveryDate)}</div>
              {deliveryWindowStart && deliveryWindowEnd &&
                <div className="extra"><Clock className="h-4 w-4 icon" />{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</div>
              }
            </div>
            <div className="card">
              <div className="label"><CheckCircle className="h-5 w-5 icon" />Status</div>
              <div className="value">{order?.status?.replace(/_/g, " ") ?? "Unknown"}</div>
              {shippingFee > 0 &&
                <div className="extra">+{formatCurrency(shippingFee)} delivery</div>
              }
            </div>
          </div>

          {/* Info grid */}
          <div className="info-row">
            <div className="info-card">
              <div className="info-title"><User className="h-5 w-5 icon" />Customer Information</div>
              <div className="info-value">{order?.customer_name}</div>
              <div><Mail className="h-4 w-4 icon" />{order?.customer_email}</div>
              <div><Phone className="h-4 w-4 icon" />{order?.customer_phone}</div>
            </div>
            <div className="info-card">
              <div className="info-title"><MapPin className="h-5 w-5 icon" />Delivery Address</div>
              <div className="info-value">{formatAddress(order?.delivery_address)}</div>
              {deliveryDate &&
                <div><Calendar className="h-4 w-4 icon" />Scheduled for {formatDate(deliveryDate)}</div>
              }
              {deliveryWindowStart && deliveryWindowEnd &&
                <div><Clock className="h-4 w-4 icon" />{formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}</div>
              }
            </div>
          </div>
          {driverContact && (
            <div className="info-row">
              <div className="info-card">
                <div className="info-title"><Car className="h-5 w-5 icon" />Driver Contact</div>
                <div className="info-value">{driverContact.name}</div>
                <div><Phone className="h-4 w-4 icon" />{driverContact.phone}</div>
                {driverContact.email && <div><Mail className="h-4 w-4 icon" />{driverContact.email}</div>}
                {driverContact.vehicle && <div><Box className="h-4 w-4 icon" />{driverContact.vehicle}</div>}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="section-title"><Package className="h-5 w-5 icon" />Order Items ({order?.order_items?.length || 0})</div>
          <div className="items-list">
            {isLoading || featuresLoading ? (
              <div>Loading...</div>
            ) : (
              order?.order_items?.map((item: any, idx: number) => {
                const product = productsData[item.product_id] || item.product || {}
                return (
                  <div key={item.id || idx} className="item-card break-inside-avoid">
                    <div className="item-title">{item.product_name}</div>
                    {product.description && (
                      <div className="item-desc">{getCleanDescription(product.description)}</div>
                    )}
                    <div className="item-features">
                      <FeaturesList product={product} />
                    </div>
                    <div className="item-qty-row">
                      Qty: <b>{item.quantity}</b> &nbsp;
                      Unit: <b>{formatCurrency(item.unit_price)}</b> &nbsp;
                      Total: <b>{formatCurrency(item.total_price)}</b>
                    </div>
                  </div>
                )
              })
            )}
            {(!order?.order_items || order?.order_items.length === 0) && (
              <div className="item-card break-inside-avoid" style={{ textAlign: "center" }}>
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No order items found.</p>
              </div>
            )}
          </div>

          {/* Summary footer */}
          <div className="summary-row print-footer">
            <div><span className="summary-label">Subtotal:</span> {formatCurrency(subtotal)}</div>
            <div><span className="summary-label">Delivery Fee:</span> {formatCurrency(shippingFee)}</div>
            <div><span className="summary-label">Total:</span> <b>{formatCurrency(order?.total_amount || 0)}</b></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
