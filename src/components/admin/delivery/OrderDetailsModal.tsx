"use client"

import { useState, useEffect, useRef } from "react"
// ... (imports unchanged)

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  // ... (hooks unchanged)

  const modalPrintRef = useRef<HTMLDivElement>(null)

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

  // ... (features and driver hooks unchanged)

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          id="order-details-modal-content"
          className="max-w-full w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl"
        >
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
            {/* Driver info if dispatch is assigned */}
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
    </>
  )
}
