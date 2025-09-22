import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'

export function Toaster() {
  const { toasts } = useToast()

  const getToastIcon = (variant?: string) => {
    switch (variant) {
      case 'destructive':
        return <XCircle className="w-4 h-4 text-destructive" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      default:
        return <Info className="w-4 h-4 text-blue-600" />
    }
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} {...props} variant={variant}>
            <div className="flex gap-2 w-full">
              <div className="flex-shrink-0 mt-0.5">
                {getToastIcon(variant)}
              </div>
              <div className="grid gap-1 flex-1 min-w-0">
                {title && (
                  <ToastTitle className="text-sm font-medium leading-tight">
                    {title}
                  </ToastTitle>
                )}
                {description && (
                  <ToastDescription className="text-sm leading-relaxed print-preview-enabled">
                    {typeof description === 'string' ? description : description}
                  </ToastDescription>
                )}
              </div>
              {action && (
                <div className="flex-shrink-0 ml-2">
                  {action}
                </div>
              )}
            </div>
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
