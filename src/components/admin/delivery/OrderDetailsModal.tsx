"use client"

import { useState, useEffect, useRef } from "react"
// FIX: Ensure dialog components are imported from the right path
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog"
// ... all other imports unchanged

// ... all helper functions unchanged

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  // ... all hooks and logic unchanged

  const modalPrintRef = useRef<HTMLDivElement>(null)

  // ... print logic unchanged

  return (
    <>
      {/* FIX: Defensive check for Dialog component */}
      {typeof Dialog !== "undefined" ? (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent
            id="order-details-modal-content"
            className="max-w-full w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl h-[98vh] max-h-[98vh] overflow-y-auto rounded-2xl bg-background p-0 border shadow-2xl"
          >
            <div ref={modalPrintRef}>
              {/* ...modal content as previously coded... */}
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <div style={{ padding: 24, color: "red" }}>
          Dialog component is missing. Please check your imports!
        </div>
      )}
    </>
  )
}
