{/* Delivery Schedule Section */}
{isLoadingSchedule || recoveryMutation.isPending ? (
  <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
    <div className="h-4 bg-gray-300 rounded mb-2"></div>
    <div className="h-3 bg-gray-300 rounded w-2/3"></div>
    {recoveryMutation.isPending && (
      <p className="text-xs text-blue-600 mt-2">🔄 Attempting to recover schedule...</p>
    )}
  </div>
) : deliverySchedule ? (
  <DeliveryScheduleDisplay 
    schedule={deliverySchedule}
    orderType={order.order_type as 'delivery' | 'pickup'}
    orderStatus={order.status}
    className="mb-0" 
  />
) : (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
    <p className="text-sm text-yellow-800">
      No {order.order_type === 'delivery' ? 'delivery' : 'pickup'} schedule found for this order.
    </p>
    <p className="text-xs text-gray-600 mt-1">
      {recoveryMutation.isError ? 
        'Recovery failed. Schedule will be confirmed after payment is verified.' :
        'Schedule will be confirmed after payment is verified.'
      }
    </p>
    {/* Show order-level delivery info if available */}
    {order.delivery_address && (
      <div className="flex items-start gap-2 text-xs mt-2">
        <span className="font-semibold text-muted-foreground">Address:</span>
        <span className="break-words">{order.delivery_address}</span>
      </div>
    )}
    {order.delivery_zone && (
      <div className="flex items-start gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Zone:</span>
        <span>{order.delivery_zone}</span>
      </div>
    )}
    {order.estimated_delivery_date && (
      <div className="flex items-start gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Estimated Date:</span>
        <span>{order.estimated_delivery_date}</span>
      </div>
    )}
    {order.estimated_delivery_time && (
      <div className="flex items-start gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Estimated Time:</span>
        <span>{order.estimated_delivery_time}</span>
      </div>
    )}
    {(order.special_instructions ||
      (order.items && order.items.find((item: any) => item.special_instructions))) && (
      <div className="flex items-start gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Instructions:</span>
        <span>
          {order.special_instructions || 
            order.items?.find((item: any) => item.special_instructions)?.special_instructions ||
            'See order details'}
        </span>
      </div>
    )}
    {order.delivery_fee && order.delivery_fee > 0 && (
      <div className="flex items-start gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">Delivery Fee:</span>
        <span>₦{order.delivery_fee.toLocaleString()}</span>
      </div>
    )}
    <div className="flex items-start gap-2 text-xs">
      <span className="font-semibold text-muted-foreground">Order Status:</span>
      <span>{order.status.replace('_', ' ').toUpperCase()}</span>
    </div>
    {/* Recovery retry button */}
    {recoveryMutation.isError && (
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-2"
        onClick={() => recoveryMutation.mutate(order.id)}
        disabled={recoveryMutation.isPending}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Retry Recovery
      </Button>
    )}
  </div>
)}