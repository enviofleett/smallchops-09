
import { SupabaseAdminClient, Order } from '../utils/types.ts';

export class OrderService {
  constructor(private supabaseAdmin: SupabaseAdminClient) {}

  async getOrder(orderId: string): Promise<Order> {
    const { data: order, error: orderError } = await this.supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }
    
    return order;
  }
}
