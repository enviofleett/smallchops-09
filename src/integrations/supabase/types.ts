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
      admin_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_metrics: {
        Row: {
          dimensions: Json | null
          endpoint: string
          id: string
          metric_type: string
          metric_value: number
          timestamp: string
        }
        Insert: {
          dimensions?: Json | null
          endpoint: string
          id?: string
          metric_type: string
          metric_value: number
          timestamp?: string
        }
        Update: {
          dimensions?: Json | null
          endpoint?: string
          id?: string
          metric_type?: string
          metric_value?: number
          timestamp?: string
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          created_at: string
          customer_id: string | null
          endpoint: string
          error_details: Json | null
          id: string
          ip_address: unknown | null
          method: string
          request_payload: Json | null
          response_status: number | null
          response_time_ms: number | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          endpoint: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          method: string
          request_payload?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          endpoint?: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          method?: string
          request_payload?: Json | null
          response_status?: number | null
          response_time_ms?: number | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
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
      brand_assets: {
        Row: {
          asset_name: string | null
          asset_type: string
          asset_url: string
          created_at: string | null
          dimensions: Json | null
          file_size: number | null
          file_type: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          asset_name?: string | null
          asset_type: string
          asset_url: string
          created_at?: string | null
          dimensions?: Json | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          asset_name?: string | null
          asset_type?: string
          asset_url?: string
          created_at?: string | null
          dimensions?: Json | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      branding_audit_log: {
        Row: {
          action: string
          changed_at: string | null
          created_at: string | null
          field_name: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          created_at?: string | null
          field_name: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          created_at?: string | null
          field_name?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      business_analytics: {
        Row: {
          created_at: string
          dimensions: Json | null
          id: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
        }
        Insert: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name: string
          metric_value: number
          period_end: string
          period_start: string
        }
        Update: {
          created_at?: string
          dimensions?: Json | null
          id?: string
          metric_name?: string
          metric_value?: number
          period_end?: string
          period_start?: string
        }
        Relationships: []
      }
      business_settings: {
        Row: {
          accent_color: string | null
          address: string | null
          brand_guidelines: string | null
          business_hours: Json | null
          created_at: string
          email: string | null
          facebook_url: string | null
          favicon_url: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          logo_alt_text: string | null
          logo_dark_url: string | null
          logo_url: string | null
          logo_usage_rules: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          social_card_url: string | null
          tagline: string | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          website_url: string | null
          working_hours: string | null
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          logo_alt_text?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          logo_usage_rules?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          social_card_url?: string | null
          tagline?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          working_hours?: string | null
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          favicon_url?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          logo_alt_text?: string | null
          logo_dark_url?: string | null
          logo_url?: string | null
          logo_usage_rules?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          social_card_url?: string | null
          tagline?: string | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          website_url?: string | null
          working_hours?: string | null
          youtube_url?: string | null
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
          delivery_status: string | null
          email_type: string | null
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          last_error: string | null
          order_id: string | null
          payload: Json | null
          processed_at: string | null
          recipient_email: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          template_id: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string | null
          email_type?: string | null
          error_message?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          recipient_email?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          created_at?: string
          delivery_status?: string | null
          email_type?: string | null
          error_message?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          order_id?: string | null
          payload?: Json | null
          processed_at?: string | null
          recipient_email?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          updated_at?: string
          variables?: Json | null
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
          email_provider: string | null
          email_templates: Json | null
          id: string
          sender_email: string | null
          sender_name: string | null
          sms_templates: Json | null
          smtp_host: string | null
          smtp_pass: string | null
          smtp_port: number | null
          smtp_secure: boolean | null
          smtp_user: string | null
          triggers: Json | null
          updated_at: string
          use_smtp: boolean | null
        }
        Insert: {
          connected_by?: string | null
          created_at?: string
          email_provider?: string | null
          email_templates?: Json | null
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
          use_smtp?: boolean | null
        }
        Update: {
          connected_by?: string | null
          created_at?: string
          email_provider?: string | null
          email_templates?: Json | null
          id?: string
          sender_email?: string | null
          sender_name?: string | null
          sms_templates?: Json | null
          smtp_host?: string | null
          smtp_pass?: string | null
          smtp_port?: number | null
          smtp_secure?: boolean | null
          smtp_user?: string | null
          triggers?: Json | null
          updated_at?: string
          use_smtp?: boolean | null
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
      customer_accounts: {
        Row: {
          created_at: string
          date_of_birth: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
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
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notification_channels: {
        Row: {
          channel_type: string
          channel_value: string
          created_at: string
          customer_id: string
          id: string
          is_verified: boolean | null
          preferences: Json | null
        }
        Insert: {
          channel_type: string
          channel_value: string
          created_at?: string
          customer_id: string
          id?: string
          is_verified?: boolean | null
          preferences?: Json | null
        }
        Update: {
          channel_type?: string
          channel_value?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_verified?: boolean | null
          preferences?: Json | null
        }
        Relationships: []
      }
      customer_notification_preferences: {
        Row: {
          created_at: string
          customer_id: string
          digest_frequency: string
          id: string
          minimum_discount_percentage: number
          price_alerts: boolean
          promotion_alerts: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          digest_frequency?: string
          id?: string
          minimum_discount_percentage?: number
          price_alerts?: boolean
          promotion_alerts?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          digest_frequency?: string
          id?: string
          minimum_discount_percentage?: number
          price_alerts?: boolean
          promotion_alerts?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_preferences: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          id: string
          preferred_currency: string | null
          preferred_payment_method: string | null
          save_payment_methods: boolean | null
          sms_notifications: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          preferred_currency?: string | null
          preferred_payment_method?: string | null
          save_payment_methods?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          preferred_currency?: string | null
          preferred_payment_method?: string | null
          save_payment_methods?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      customer_purchase_analytics: {
        Row: {
          average_order_value: number | null
          created_at: string | null
          customer_email: string
          customer_id: string | null
          favorite_category_id: string | null
          id: string
          last_purchase_date: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          average_order_value?: number | null
          created_at?: string | null
          customer_email: string
          customer_id?: string | null
          favorite_category_id?: string | null
          id?: string
          last_purchase_date?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          average_order_value?: number | null
          created_at?: string | null
          customer_email?: string
          customer_id?: string | null
          favorite_category_id?: string | null
          id?: string
          last_purchase_date?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_purchase_analytics_favorite_category_id_fkey"
            columns: ["favorite_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_rate_limits: {
        Row: {
          created_at: string
          customer_id: string | null
          endpoint: string
          id: string
          ip_address: unknown | null
          request_count: number
          tier: string
          window_start: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          endpoint: string
          id?: string
          ip_address?: unknown | null
          request_count?: number
          tier?: string
          window_start?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          endpoint?: string
          id?: string
          ip_address?: unknown | null
          request_count?: number
          tier?: string
          window_start?: string
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
      delivery_tracking: {
        Row: {
          actual_arrival: string | null
          created_at: string
          driver_info: Json | null
          estimated_arrival: string | null
          id: string
          location: Json | null
          notes: string | null
          order_id: string
          status: string
          tracking_url: string | null
        }
        Insert: {
          actual_arrival?: string | null
          created_at?: string
          driver_info?: Json | null
          estimated_arrival?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          order_id: string
          status: string
          tracking_url?: string | null
        }
        Update: {
          actual_arrival?: string | null
          created_at?: string
          driver_info?: Json | null
          estimated_arrival?: string | null
          id?: string
          location?: Json | null
          notes?: string | null
          order_id?: string
          status?: string
          tracking_url?: string | null
        }
        Relationships: []
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
      email_consents: {
        Row: {
          consent_source: string | null
          consent_type: string
          created_at: string | null
          email_address: string
          id: string
          ip_address: unknown | null
          is_active: boolean | null
          unsubscribed_at: string | null
          user_agent: string | null
        }
        Insert: {
          consent_source?: string | null
          consent_type?: string
          created_at?: string | null
          email_address: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          consent_source?: string | null
          consent_type?: string
          created_at?: string | null
          email_address?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean | null
          unsubscribed_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      email_delivery_logs: {
        Row: {
          created_at: string | null
          email_id: string | null
          event_type: string
          id: string
          recipient_email: string
          status: string
          subject: string | null
          timestamp: string | null
          webhook_data: Json | null
        }
        Insert: {
          created_at?: string | null
          email_id?: string | null
          event_type: string
          id?: string
          recipient_email: string
          status: string
          subject?: string | null
          timestamp?: string | null
          webhook_data?: Json | null
        }
        Update: {
          created_at?: string | null
          email_id?: string | null
          event_type?: string
          id?: string
          recipient_email?: string
          status?: string
          subject?: string | null
          timestamp?: string | null
          webhook_data?: Json | null
        }
        Relationships: []
      }
      email_suppression_list: {
        Row: {
          created_at: string | null
          email_address: string
          event_data: Json | null
          id: string
          reason: string
        }
        Insert: {
          created_at?: string | null
          email_address: string
          event_data?: Json | null
          id?: string
          reason: string
        }
        Update: {
          created_at?: string | null
          email_address?: string
          event_data?: Json | null
          id?: string
          reason?: string
        }
        Relationships: []
      }
      email_unsubscribes: {
        Row: {
          email_address: string
          id: string
          ip_address: unknown | null
          reason: string | null
          unsubscribe_type: string
          unsubscribed_at: string
          user_agent: string | null
        }
        Insert: {
          email_address: string
          id?: string
          ip_address?: unknown | null
          reason?: string | null
          unsubscribe_type?: string
          unsubscribed_at?: string
          user_agent?: string | null
        }
        Update: {
          email_address?: string
          id?: string
          ip_address?: unknown | null
          reason?: string | null
          unsubscribe_type?: string
          unsubscribed_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      enhanced_email_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          html_template: string
          id: string
          is_active: boolean | null
          style: string | null
          subject_template: string
          template_key: string
          template_name: string
          template_type: string
          text_template: string | null
          updated_at: string
          updated_by: string | null
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          html_template: string
          id?: string
          is_active?: boolean | null
          style?: string | null
          subject_template: string
          template_key: string
          template_name: string
          template_type?: string
          text_template?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          html_template?: string
          id?: string
          is_active?: boolean | null
          style?: string | null
          subject_template?: string
          template_key?: string
          template_name?: string
          template_type?: string
          text_template?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      enhanced_rate_limits: {
        Row: {
          key: string
          request_count: number | null
          window_end: string
          window_start: string
        }
        Insert: {
          key: string
          request_count?: number | null
          window_end?: string
          window_start?: string
        }
        Update: {
          key?: string
          request_count?: number | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      environment_config: {
        Row: {
          created_at: string | null
          environment: string
          id: string
          is_live_mode: boolean
          paystack_live_public_key: string | null
          paystack_live_secret_key: string | null
          paystack_test_public_key: string | null
          paystack_test_secret_key: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          environment?: string
          id?: string
          is_live_mode?: boolean
          paystack_live_public_key?: string | null
          paystack_live_secret_key?: string | null
          paystack_test_public_key?: string | null
          paystack_test_secret_key?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          environment?: string
          id?: string
          is_live_mode?: boolean
          paystack_live_public_key?: string | null
          paystack_live_secret_key?: string | null
          paystack_test_public_key?: string | null
          paystack_test_secret_key?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      logo_versions: {
        Row: {
          created_at: string | null
          dimensions: Json | null
          file_size: number | null
          file_type: string | null
          id: string
          is_current: boolean | null
          logo_url: string
          replaced_at: string | null
          replaced_by: string | null
          upload_date: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          created_at?: string | null
          dimensions?: Json | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean | null
          logo_url: string
          replaced_at?: string | null
          replaced_by?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          version_number: number
        }
        Update: {
          created_at?: string | null
          dimensions?: Json | null
          file_size?: number | null
          file_type?: string | null
          id?: string
          is_current?: boolean | null
          logo_url?: string
          replaced_at?: string | null
          replaced_by?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
          version_number?: number
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
      menu_structure: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          key: string
          label: string
          parent_key: string | null
          permission_levels: Json | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key: string
          label: string
          parent_key?: string | null
          permission_levels?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          key?: string
          label?: string
          parent_key?: string | null
          permission_levels?: Json | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_structure_parent_key_fkey"
            columns: ["parent_key"]
            isOneToOne: false
            referencedRelation: "menu_structure"
            referencedColumns: ["key"]
          },
        ]
      }
      notification_queue: {
        Row: {
          created_at: string
          customer_id: string
          data: Json | null
          id: string
          notification_type: string
          processed_at: string | null
          product_id: string | null
          scheduled_for: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          data?: Json | null
          id?: string
          notification_type: string
          processed_at?: string | null
          product_id?: string | null
          scheduled_for?: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          data?: Json | null
          id?: string
          notification_type?: string
          processed_at?: string | null
          product_id?: string | null
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_queue_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      order_modifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          modification_type: string
          new_data: Json | null
          order_id: string
          original_data: Json | null
          processed_at: string | null
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          modification_type: string
          new_data?: Json | null
          order_id: string
          original_data?: Json | null
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          modification_type?: string
          new_data?: Json | null
          order_id?: string
          original_data?: Json | null
          processed_at?: string | null
          reason?: string | null
          status?: string
        }
        Relationships: []
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
      payment_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_status: string | null
          payment_reference: string
          previous_status: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_status?: string | null
          payment_reference: string
          previous_status?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_status?: string | null
          payment_reference?: string
          previous_status?: string | null
        }
        Relationships: []
      }
      payment_disputes: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          dispute_id: string
          id: string
          reason: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string
          transaction_reference: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          dispute_id: string
          id?: string
          reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          transaction_reference: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          dispute_id?: string
          id?: string
          reason?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string
          transaction_reference?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_error_logs: {
        Row: {
          created_at: string | null
          error_message: string
          error_stack: string | null
          error_type: string
          id: string
          occurred_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message: string
          error_stack?: string | null
          error_type: string
          id?: string
          occurred_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string
          error_stack?: string | null
          error_type?: string
          id?: string
          occurred_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_error_tracking: {
        Row: {
          created_at: string | null
          error_code: string
          error_context: Json | null
          error_message: string
          id: string
          order_id: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          severity: string
          transaction_reference: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_code: string
          error_context?: Json | null
          error_message: string
          id?: string
          order_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          transaction_reference?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string
          error_context?: Json | null
          error_message?: string
          id?: string
          order_id?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          severity?: string
          transaction_reference?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_health_metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_name: string
          metric_unit: string | null
          metric_value: number
          recorded_at: string | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_unit?: string | null
          metric_value: number
          recorded_at?: string | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_unit?: string | null
          metric_value?: number
          recorded_at?: string | null
        }
        Relationships: []
      }
      payment_integrations: {
        Row: {
          connected_by: string | null
          connection_status: string | null
          created_at: string
          currency: string | null
          environment: string | null
          id: string
          integration_data: Json | null
          live_public_key: string | null
          live_secret_key: string | null
          live_webhook_secret: string | null
          mode: string | null
          payment_methods: Json | null
          provider: string
          public_key: string | null
          secret_key: string | null
          supported_methods: Json | null
          test_mode: boolean | null
          transaction_fee: number | null
          updated_at: string
          webhook_endpoints: Json | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          environment?: string | null
          id?: string
          integration_data?: Json | null
          live_public_key?: string | null
          live_secret_key?: string | null
          live_webhook_secret?: string | null
          mode?: string | null
          payment_methods?: Json | null
          provider: string
          public_key?: string | null
          secret_key?: string | null
          supported_methods?: Json | null
          test_mode?: boolean | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_endpoints?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string
          currency?: string | null
          environment?: string | null
          id?: string
          integration_data?: Json | null
          live_public_key?: string | null
          live_secret_key?: string | null
          live_webhook_secret?: string | null
          mode?: string | null
          payment_methods?: Json | null
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          supported_methods?: Json | null
          test_mode?: boolean | null
          transaction_fee?: number | null
          updated_at?: string
          webhook_endpoints?: Json | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      payment_rate_limits: {
        Row: {
          attempts: number | null
          created_at: string | null
          id: string
          ip_address: string | null
          operation_type: string
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          operation_type: string
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          operation_type?: string
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          provider_refund_id: string | null
          reason: string
          status: string | null
          transaction_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          provider_refund_id?: string | null
          reason: string
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          provider_refund_id?: string | null
          reason?: string
          status?: string | null
          transaction_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_status_tracking: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          metadata: Json | null
          previous_status: string | null
          status: string
          status_reason: string | null
          transaction_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          previous_status?: string | null
          status: string
          status_reason?: string | null
          transaction_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          metadata?: Json | null
          previous_status?: string | null
          status?: string
          status_reason?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_status_tracking_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "payment_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          account_name: string | null
          amount: number
          authorization_code: string | null
          bank: string | null
          card_type: string | null
          channel: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_phone: string | null
          exp_month: string | null
          exp_year: string | null
          fees: number | null
          gateway_response: string | null
          id: string
          last4: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          processed_at: string | null
          provider_reference: string | null
          provider_response: Json | null
          provider_transaction_id: string | null
          status: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          amount: number
          authorization_code?: string | null
          bank?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          last4?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          status: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          amount?: number
          authorization_code?: string | null
          bank?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          last4?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ratings_summary: {
        Row: {
          average_rating: number
          last_updated: string
          product_id: string
          rating_distribution: Json
          total_reviews: number
        }
        Insert: {
          average_rating?: number
          last_updated?: string
          product_id: string
          rating_distribution?: Json
          total_reviews?: number
        }
        Update: {
          average_rating?: number
          last_updated?: string
          product_id?: string
          rating_distribution?: Json
          total_reviews?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_ratings_summary_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          content: string | null
          created_at: string
          customer_email: string
          customer_id: string
          helpful_votes: number
          id: string
          is_verified_purchase: boolean
          order_id: string | null
          product_id: string
          rating: number
          status: string
          title: string | null
          total_votes: number
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          customer_email: string
          customer_id: string
          helpful_votes?: number
          id?: string
          is_verified_purchase?: boolean
          order_id?: string | null
          product_id: string
          rating: number
          status?: string
          title?: string | null
          total_votes?: number
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string
          helpful_votes?: number
          id?: string
          is_verified_purchase?: boolean
          order_id?: string | null
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          total_votes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limits: {
        Row: {
          action: string
          count: number | null
          created_at: string | null
          id: string
          identifier: string
          window_start: string | null
        }
        Insert: {
          action: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          window_start?: string | null
        }
        Update: {
          action?: string
          count?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          window_start?: string | null
        }
        Relationships: []
      }
      review_media: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          media_type: string
          media_url: string
          review_id: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type: string
          media_url: string
          review_id: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_responses: {
        Row: {
          business_user_id: string
          created_at: string
          id: string
          response_content: string
          review_id: string
          updated_at: string
        }
        Insert: {
          business_user_id: string
          created_at?: string
          id?: string
          response_content: string
          review_id: string
          updated_at?: string
        }
        Update: {
          business_user_id?: string
          created_at?: string
          id?: string
          response_content?: string
          review_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_responses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_votes: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          review_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          review_id: string
          vote_type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          review_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_votes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_payment_methods: {
        Row: {
          authorization_code: string
          bank: string | null
          card_type: string | null
          created_at: string | null
          exp_month: string | null
          exp_year: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          last_used_at: string | null
          last4: string | null
          nickname: string | null
          provider: string
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          authorization_code: string
          bank?: string | null
          card_type?: string | null
          created_at?: string | null
          exp_month?: string | null
          exp_year?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          last4?: string | null
          nickname?: string | null
          provider: string
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          authorization_code?: string
          bank?: string | null
          card_type?: string | null
          created_at?: string | null
          exp_month?: string | null
          exp_year?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          last_used_at?: string | null
          last4?: string | null
          nickname?: string | null
          provider?: string
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      security_incidents: {
        Row: {
          created_at: string | null
          description: string | null
          error_message: string | null
          expected_amount: number | null
          expected_signature: string | null
          id: string
          ip_address: unknown | null
          received_amount: number | null
          received_signature: string | null
          reference: string | null
          request_data: Json | null
          severity: string | null
          type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          expected_amount?: number | null
          expected_signature?: string | null
          id?: string
          ip_address?: unknown | null
          received_amount?: number | null
          received_signature?: string | null
          reference?: string | null
          request_data?: Json | null
          severity?: string | null
          type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          expected_amount?: number | null
          expected_signature?: string | null
          id?: string
          ip_address?: unknown | null
          received_amount?: number | null
          received_signature?: string | null
          reference?: string | null
          request_data?: Json | null
          severity?: string | null
          type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      smtp_delivery_logs: {
        Row: {
          created_at: string
          delivery_status: string
          delivery_timestamp: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          provider: string
          recipient_email: string
          sender_email: string | null
          smtp_response: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          delivery_timestamp?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string
          recipient_email: string
          sender_email?: string | null
          smtp_response?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          delivery_timestamp?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string
          recipient_email?: string
          sender_email?: string | null
          smtp_response?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      transaction_analytics: {
        Row: {
          average_transaction_value: number | null
          channels_used: Json | null
          created_at: string | null
          date: string
          failed_transactions: number | null
          id: string
          success_rate: number | null
          successful_transactions: number | null
          total_amount: number | null
          total_fees: number | null
          total_transactions: number | null
          updated_at: string | null
        }
        Insert: {
          average_transaction_value?: number | null
          channels_used?: Json | null
          created_at?: string | null
          date: string
          failed_transactions?: number | null
          id?: string
          success_rate?: number | null
          successful_transactions?: number | null
          total_amount?: number | null
          total_fees?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Update: {
          average_transaction_value?: number | null
          channels_used?: Json | null
          created_at?: string | null
          date?: string
          failed_transactions?: number | null
          id?: string
          success_rate?: number | null
          successful_transactions?: number | null
          total_amount?: number | null
          total_fees?: number | null
          total_transactions?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      upload_rate_limits: {
        Row: {
          id: string
          upload_count: number | null
          user_id: string | null
          window_hour: string | null
        }
        Insert: {
          id?: string
          upload_count?: number | null
          user_id?: string | null
          window_hour?: string | null
        }
        Update: {
          id?: string
          upload_count?: number | null
          user_id?: string | null
          window_hour?: string | null
        }
        Relationships: []
      }
      user_permission_audit: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          menu_key: string
          menu_section: string | null
          new_values: Json | null
          old_values: Json | null
          permission_level: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          menu_key: string
          menu_section?: string | null
          new_values?: Json | null
          old_values?: Json | null
          permission_level: Database["public"]["Enums"]["permission_level"]
          user_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          menu_key?: string
          menu_section?: string | null
          new_values?: Json | null
          old_values?: Json | null
          permission_level?: Database["public"]["Enums"]["permission_level"]
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          id: string
          menu_key: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level: Database["public"]["Enums"]["permission_level"]
          sub_menu_section: string | null
          user_id: string
        }
        Insert: {
          id?: string
          menu_key: string
          menu_section: Database["public"]["Enums"]["menu_section"]
          permission_level?: Database["public"]["Enums"]["permission_level"]
          sub_menu_section?: string | null
          user_id: string
        }
        Update: {
          id?: string
          menu_key?: string
          menu_section?: Database["public"]["Enums"]["menu_section"]
          permission_level?: Database["public"]["Enums"]["permission_level"]
          sub_menu_section?: string | null
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
      webhook_events: {
        Row: {
          created_at: string | null
          event_data: Json
          event_type: string
          id: string
          paystack_event_id: string
          processed: boolean | null
          processed_at: string | null
          processing_result: Json | null
          signature: string
        }
        Insert: {
          created_at?: string | null
          event_data: Json
          event_type: string
          id?: string
          paystack_event_id: string
          processed?: boolean | null
          processed_at?: string | null
          processing_result?: Json | null
          signature: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          paystack_event_id?: string
          processed?: boolean | null
          processed_at?: string | null
          processing_result?: Json | null
          signature?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean | null
          provider: string
          provider_event_id: string | null
          transaction_reference: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean | null
          provider: string
          provider_event_id?: string | null
          transaction_reference?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean | null
          provider?: string
          provider_event_id?: string | null
          transaction_reference?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_brand_consistency_score: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      can_send_email_to: {
        Args: { email_address: string; email_type?: string }
        Returns: boolean
      }
      check_customer_rate_limit: {
        Args: {
          p_customer_id?: string
          p_ip_address?: unknown
          p_endpoint?: string
          p_tier?: string
        }
        Returns: boolean
      }
      check_enhanced_rate_limit: {
        Args: {
          p_user_id?: string
          p_ip_address?: string
          p_operation_type?: string
          p_limit_per_minute?: number
          p_limit_per_hour?: number
        }
        Returns: boolean
      }
      check_upload_rate_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_user_permission: {
        Args: {
          user_id_param: string
          menu_key_param: string
          required_level_param?: string
        }
        Returns: boolean
      }
      cleanup_expired_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_communication_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      confirm_payment_atomic: {
        Args: {
          p_reference: string
          p_amount: number
          p_paystack_data: Json
          p_confirmed_at: string
        }
        Returns: Json
      }
      create_logo_version: {
        Args: {
          p_logo_url: string
          p_file_size: number
          p_file_type: string
          p_dimensions: Json
          p_uploaded_by: string
        }
        Returns: string
      }
      customer_purchased_product: {
        Args: { customer_uuid: string; product_uuid: string }
        Returns: boolean
      }
      delete_customer_cascade: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_paystack_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          public_key: string
          secret_key: string
          webhook_secret: string
          test_mode: boolean
          environment: string
        }[]
      }
      get_all_customers_for_analytics: {
        Args: Record<PropertyKey, never>
        Returns: {
          customer_id: string
          customer_name: string
          customer_email: string
          customer_phone: string
          is_registered: boolean
          registration_date: string
        }[]
      }
      get_environment_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          environment: string
          is_live_mode: boolean
          webhook_url: string
        }[]
      }
      get_hourly_email_stats: {
        Args: { start_time: string; end_time: string }
        Returns: {
          hour_bucket: string
          total_sent: number
          successful_delivered: number
          failed_attempts: number
          bounce_rate: number
          delivery_rate: number
        }[]
      }
      get_user_role: {
        Args: { user_id_to_check: string }
        Returns: string
      }
      handle_successful_payment: {
        Args: {
          p_reference: string
          p_paid_at: string
          p_gateway_response: string
          p_fees: number
          p_channel: string
          p_authorization_code?: string
          p_card_type?: string
          p_last4?: string
          p_exp_month?: string
          p_exp_year?: string
          p_bank?: string
        }
        Returns: undefined
      }
      has_email_consent: {
        Args: { email_address: string; consent_type?: string }
        Returns: boolean
      }
      health_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_email_suppressed: {
        Args: { email_address: string }
        Returns: boolean
      }
      link_guest_to_authenticated_customer: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      log_admin_action: {
        Args: {
          action_type: string
          entity_type: string
          entity_id: string
          old_values?: Json
          new_values?: Json
          message?: string
        }
        Returns: undefined
      }
      log_admin_management_action: {
        Args: {
          action_type: string
          target_user_id?: string
          target_email?: string
          action_data?: Json
          action_result?: string
        }
        Returns: undefined
      }
      log_api_request: {
        Args: {
          p_endpoint: string
          p_method: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_request_payload?: Json
          p_response_status?: number
          p_response_time_ms?: number
          p_customer_id?: string
          p_session_id?: string
          p_error_details?: Json
        }
        Returns: string
      }
      log_branding_change: {
        Args: {
          p_action: string
          p_field_name: string
          p_old_value: string
          p_new_value: string
          p_metadata?: Json
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      log_payment_error: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_error_context?: Json
          p_user_id?: string
          p_order_id?: string
          p_transaction_reference?: string
          p_severity?: string
        }
        Returns: string
      }
      log_security_incident: {
        Args: {
          p_incident_type: string
          p_severity?: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_endpoint?: string
          p_details?: Json
        }
        Returns: string
      }
      record_payment_metric: {
        Args: {
          p_metric_name: string
          p_metric_value: number
          p_metric_unit?: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      sync_payment_to_order_status: {
        Args: {
          p_transaction_id: string
          p_payment_status: string
          p_order_status?: string
        }
        Returns: undefined
      }
      validate_admin_permission: {
        Args: { required_permission?: string }
        Returns: boolean
      }
      verify_payment_atomic: {
        Args: {
          p_reference: string
          p_paystack_data: Json
          p_verified_at: string
        }
        Returns: Json
      }
      verify_webhook_signature: {
        Args: { p_payload: string; p_signature: string; p_secret: string }
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
        | "delivery"
        | "payment"
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
        "delivery",
        "payment",
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
