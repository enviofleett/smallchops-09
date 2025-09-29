// ...imports remain unchanged...

// (imports and helper components omitted for brevity)

export const NewOrderDetailsModal: React.FC<NewOrderDetailsModalProps> = ({
  open,
  onClose,
  order // Real order data is now required
}) => {
  const userContext = useUserContext();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: businessSettings } = useBusinessSettings();

  // Fetch real-time order data
  const {
    data: detailedOrderData,
    isLoading: isLoadingDetailed,
    error,
    lastUpdated,
    connectionStatus,
    reconnect
  } = useRealTimeOrderData(order?.id);

  const handlePrint = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `Order-${order?.order_number || 'Details'}`,
    // ...styles and event handlers unchanged...
  });

  const handleRefresh = () => {
    reconnect();
    setRefreshTrigger(prev => prev + 1);
  };

  // Show error state if no order provided
  if (!order) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="sm"
        title="Order Not Found"
        description="Order details are not available"
      >
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No order data provided.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </AdaptiveDialog>
    );
  }

  // Use detailed order data if available, otherwise fall back to basic order data
  const rawOrderData = detailedOrderData?.order || order;
  const rawOrderItems = detailedOrderData?.items || order.order_items || order.items || [];
  const fulfillmentInfo = detailedOrderData?.fulfillment_info || order.fulfillment_info || {};

  // Defensive logging for debugging structure
  console.log("Order item debug", rawOrderItems, rawOrderData);

  // Normalize order items - ensure .product is always present, even if nested under .products array
  const normalizedOrderItems = rawOrderItems.map((item: any) => ({
    ...item,
    product: item.product || (Array.isArray(item.products) ? item.products[0] : item.products)
  }));

  // Defensive validation - always provide both .items and .order_items for downstream
  const safeOrderData = safeOrder({
    ...rawOrderData,
    items: normalizedOrderItems,
    order_items: normalizedOrderItems
  });
  if (!safeOrderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Order Details"
        description="Unable to load order"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Invalid order data</p>
                <p className="text-sm text-muted-foreground">
                  The order data is corrupted or missing. Please try refreshing the page.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </AdaptiveDialog>
    );
  }

  // Use the validated safe order data for rendering
  const orderData = safeOrderData;
  const orderItems = safeOrderData.items;

  // Show loading state
  if (isLoadingDetailed && !orderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Loading Order Details..."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading order details...</span>
        </div>
      </AdaptiveDialog>
    );
  }

  const isAdmin = userContext === 'admin';
  const isCustomer = userContext === 'customer';

  // ...rest of the rendering logic unchanged (cards, items, timeline, etc.)...