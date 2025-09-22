import React, { useState, useEffect } from 'react';
import { OrderWithItems } from '@/api/orders';
import { useOrdersSmart } from '@/hooks/useOrdersFallback';
import { useOrderUpdate, useOrdersRealTime } from '@/hooks/useOrdersNew';
import { adaptNewOrdersToOld } from '@/utils/orderDataAdapter';
import { AdminOrdersContent } from './AdminOrdersContent';

// This adapter bridges multiple backend approaches with the old UI
export function OrdersAdapterForOldUI() {
  return <AdminOrdersContent />;
}