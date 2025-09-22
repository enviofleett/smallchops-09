import React, { useState, useEffect } from 'react';
import { OrderWithItems } from '@/api/orders';
import { useOrdersNew, useOrderUpdate, useOrdersRealTime } from '@/hooks/useOrdersNew';
import { adaptNewOrdersToOld } from '@/utils/orderDataAdapter';
import { AdminOrdersContent } from './AdminOrdersContent';

// This adapter bridges the new backend with the old UI
export function OrdersAdapterForOldUI() {
  return <AdminOrdersContent />;
}