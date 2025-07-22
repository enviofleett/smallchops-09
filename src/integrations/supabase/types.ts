export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          category: string | null
          entity_id: string | null
          entity_type: string | null
          event_time: string
          id: string
          ip_address: string | null
          message: string | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          category?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          category?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          address: string | null
          business_hours: Json | null
          created_at: string
          email: string | null
          id: string
          licenses: string | null
          logo_url: string | null
          name: string
          phone: string | null
          registration_number: string | null
          social_links: Json | null
          tax_id: string | null
          updated_at: string
          working_hours: string | null
        }
        Insert: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          licenses?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          registration_number?: string | null
          social_links?: Json | null
          tax_id?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Update: {
          address?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          id?: string
          licenses?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          registration_number?: string | null
          social_links?: Json | null
          tax_id?: string | null
          updated_at?: string
          working_hours?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          last_error: string | null
          order_id: string
          payload: Json | null
          processed_at: string | null
          retry_count: number
          status: Database["public"]["Enums"]["communication_event_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          last_error?: string | null
          order_id: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          last_error?: string | null
          order_id?: string
          payload?: Json | null
          processed_at?: string | null
          retry_count?: number
          status?: Database["public"]["Enums"]["communication_event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          event_id: string | null
          id: string
          order_id: string
          provider_response: Json | null
          recipient: string
          status: Database["public"]["Enums"]["communication_log_status"]
          subject: string | null
          template_name: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          order_id: string
          provider_response?: Json | null
          recipient: string
          status: Database["public"]["Enums"]["communication_log_status"]
          subject?: string | null
          template_name?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          id?: string
          order_id?: string
          provider_response?: Json | null
          recipient?: string
          status?: Database["public"]["Enums"]["communication_log_status"]
          subject?: string | null
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_settings: {
        Row: {
          connected_by: string | null
          created_at: string
          email_templates: Json | null
          enable_email: boolean | null
          enable_sms: boolean | null
          id: string
          sender_email: string | null
          sms_api_key: string | null
          sms_provider: string | null
          sms_sender_id: string | null
          sms_templates: Json | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_user: string | null
          triggers: Json | null
          updated_at: string
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          email_templates?: Json | null
          enable_email?: boolean | null
          enable_sms?: boolean | null
          id?: string
          sender_email?: string | null
          sms_api_key?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          email_templates?: Json | null
          enable_email?: boolean | null
          enable_sms?: boolean | null
          id?: string
          sender_email?: string | null
          sms_api_key?: string | null
          sms_provider?: string | null
          sms_sender_id?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      content_management: {
        Row: {
          content: string | null
          content_type: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean | null
          key: string
          title: string | null
          updated_at: string
          updated_by: string | null
          version: number | null
        }
        Insert: {
          content?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          key: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Update: {
          content?: string | null
          content_type?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean | null
          key?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number | null
        }
        Relationships: []
      }
      customer_communication_preferences: {
        Row: {
          allow_order_updates: boolean
          allow_promotions: boolean
          created_at: string
          customer_email: string
          id: string
          language: string
          preferred_channel: string
          updated_at: string
        }
        Insert: {
          allow_order_updates?: boolean
          allow_promotions?: boolean
          created_at?: string
          customer_email: string
          id?: string
          language?: string
          preferred_channel?: string
          updated_at?: string
        }
        Update: {
          allow_order_updates?: boolean
          allow_promotions?: boolean
          created_at?: string
          customer_email?: string
          id?: string
          language?: string
          preferred_channel?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          date_of_birth: string | null
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_fees: {
        Row: {
          base_fee: number
          created_at: string
          fee_per_km: number | null
          id: string
          min_order_for_free_delivery: number | null
          updated_at: string
          zone_id: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          fee_per_km?: number | null
          id?: string
          min_order_for_free_delivery?: number | null
          updated_at?: string
          zone_id: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          fee_per_km?: number | null
          id?: string
          min_order_for_free_delivery?: number | null
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_fees_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          area: Json
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          area: Json
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          area?: Json
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_api_usage: {
        Row: {
          count: number
          feature_used: string
          id: string
          log_time: string
          user_id: string | null
        }
        Insert: {
          count?: number
          feature_used: string
          id?: string
          log_time?: string
          user_id?: string | null
        }
        Update: {
          count?: number
          feature_used?: string
          id?: string
          log_time?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "map_api_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      map_settings: {
        Row: {
          created_at: string
          id: number
          monthly_usage_limit: number | null
          updated_at: string
          usage_alert_email: string | null
          usage_alert_threshold: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          monthly_usage_limit?: number | null
          updated_at?: string
          usage_alert_email?: string | null
          usage_alert_threshold?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          monthly_usage_limit?: number | null
          updated_at?: string
          usage_alert_email?: string | null
          usage_alert_threshold?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          customizations: Json | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          special_instructions: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          customizations?: Json | null
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          special_instructions?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          customizations?: Json | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          special_instructions?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          assigned_rider_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string | null
          delivery_fee: number | null
          delivery_time: string | null
          delivery_zone_id: string | null
          discount_amount: number | null
          id: string
          order_number: string
          order_time: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_time: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_time?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          id?: string
          order_number: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_time?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_time?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          id?: string
          order_number?: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_time?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_rider_id_fkey"
            columns: ["assigned_rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_integrations: {
        Row: {
          connected_by: string | null
          connection_status: string | null
          created_at: string
          currency: string | null
          id: string
          mode: string | null
          payment_methods: Json | null
          provider: string
          public_key: string | null
          secret_key: string | null
          transaction_fee: number | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          mode?: string | null
          payment_methods?: Json | null
          provider: string
          public_key?: string | null
          secret_key?: string | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          mode?: string | null
          payment_methods?: Json | null
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          name: string
          nutritional_info: Json | null
          price: number
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          name: string
          nutritional_info?: Json | null
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          name?: string
          nutritional_info?: Json | null
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      promotion_usage: {
        Row: {
          customer_email: string
          discount_amount: number
          id: string
          order_id: string
          promotion_id: string
          used_at: string
        }
        Insert: {
          customer_email: string
          discount_amount: number
          id?: string
          order_id: string
          promotion_id: string
          used_at?: string
        }
        Update: {
          customer_email?: string
          discount_amount?: number
          id?: string
          order_id?: string
          promotion_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_usage_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applicable_categories: string[] | null
          applicable_products: string[] | null
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          max_discount_amount: number | null
          min_order_amount: number | null
          name: string
          status: Database["public"]["Enums"]["promotion_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
          value: number
        }
        Insert: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name: string
          status?: Database["public"]["Enums"]["promotion_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value: number
        }
        Update: {
          applicable_categories?: string[] | null
          applicable_products?: string[] | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          id: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Insert: {
          id?: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level?: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Update: {
          id?: string
          menu_section?: Database["public"]["Enums"]["menu_section"]
          permission_level?: Database["public"]["Enums"]["permission_level"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          dispatch_rider_id: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          vehicle_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          dispatch_rider_id: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          vehicle_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          dispatch_rider_id?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_dispatch_rider_id_fkey"
            columns: ["dispatch_rider_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_assignments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          license_plate: string
          model: string | null
          notes: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          license_plate: string
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          license_plate?: string
          model?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          type?: Database["public"]["Enums"]["vehicle_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_role: {
        Args: { user_id_to_check: string }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      assignment_status: "active" | "inactive"
      communication_event_status: "queued" | "processing" | "sent" | "failed"
      communication_log_status:
        | "sent"
        | "delivered"
        | "bounced"
        | "failed"
        | "skipped"
      menu_section:
        | "dashboard"
        | "orders"
        | "categories"
        | "products"
        | "customers"
        | "delivery_pickup"
        | "promotions"
        | "reports"
        | "settings"
        | "audit_logs"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "refunded"
      order_type: "delivery" | "pickup" | "dine_in"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      permission_level: "none" | "view" | "edit"
      product_status: "active" | "archived" | "draft"
      promotion_status: "active" | "inactive" | "expired" | "scheduled"
      promotion_type:
        | "percentage"
        | "fixed_amount"
        | "buy_one_get_one"
        | "free_delivery"
      user_role: "admin" | "manager" | "staff" | "dispatch_rider"
      user_status: "active" | "inactive" | "pending"
      vehicle_status: "available" | "assigned" | "maintenance" | "inactive"
      vehicle_type: "bike" | "van" | "truck"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      assignment_status: ["active", "inactive"],
      communication_event_status: ["queued", "processing", "sent", "failed"],
      communication_log_status: [
        "sent",
        "delivered",
        "bounced",
        "failed",
        "skipped",
      ],
      menu_section: [
        "dashboard",
        "orders",
        "categories",
        "products",
        "customers",
        "delivery_pickup",
        "promotions",
        "reports",
        "settings",
        "audit_logs",
      ],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "refunded",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
      ],
      permission_level: ["none", "view", "edit"],
      product_status: ["active", "archived", "draft"],
      promotion_status: ["active", "inactive", "expired", "scheduled"],
      promotion_type: [
        "percentage",
        "fixed_amount",
        "buy_one_get_one",
        "free_delivery",
      ],
      user_role: ["admin", "manager", "staff", "dispatch_rider"],
      user_status: ["active", "inactive", "pending"],
      vehicle_status: ["available", "assigned", "maintenance", "inactive"],
      vehicle_type: ["bike", "van", "truck"],
    },
  },
} as const
