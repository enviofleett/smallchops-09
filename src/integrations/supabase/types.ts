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
      about_us_gallery: {
        Row: {
          alt_text: string | null
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string
          is_published: boolean | null
          sort_order: number | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url: string
          is_published?: boolean | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string
          is_published?: boolean | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      about_us_sections: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          section_type: string
          seo_description: string | null
          seo_title: string | null
          sort_order: number | null
          title: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          section_type: string
          seo_description?: string | null
          seo_title?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          section_type?: string
          seo_description?: string | null
          seo_title?: string | null
          sort_order?: number | null
          title?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invitation_token: string | null
          invited_at: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          setup_completed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invitation_token?: string | null
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          setup_completed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string | null
          invited_at?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          setup_completed_at?: string | null
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
      admin_notification_preferences: {
        Row: {
          admin_id: string | null
          created_at: string
          id: string
          is_enabled: boolean
          notification_channel: string
          notification_type: string
          threshold_value: number | null
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_channel?: string
          notification_type: string
          threshold_value?: number | null
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          id?: string
          is_enabled?: boolean
          notification_channel?: string
          notification_type?: string
          threshold_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_notification_preferences_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown | null
          is_active: boolean
          last_activity: string
          session_token: string
          terminated_at: string | null
          termination_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          last_activity?: string
          session_token: string
          terminated_at?: string | null
          termination_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown | null
          is_active?: boolean
          last_activity?: string
          session_token?: string
          terminated_at?: string | null
          termination_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
      blog_articles: {
        Row: {
          author_id: string | null
          banner_url: string | null
          category_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published_at: string | null
          scheduled_for: string | null
          seo_description: string | null
          seo_keywords: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          banner_url?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          banner_url?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          scheduled_for?: string | null
          seo_description?: string | null
          seo_keywords?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
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
          is_active?: boolean | null
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
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      bogo_allocations: {
        Row: {
          created_at: string | null
          free_quantity: number
          id: string
          order_id: string | null
          paid_quantity: number
          product_id: string
          promotion_id: string
        }
        Insert: {
          created_at?: string | null
          free_quantity?: number
          id?: string
          order_id?: string | null
          paid_quantity?: number
          product_id: string
          promotion_id: string
        }
        Update: {
          created_at?: string | null
          free_quantity?: number
          id?: string
          order_id?: string | null
          paid_quantity?: number
          product_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bogo_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bogo_allocations_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
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
          admin_notification_email: string | null
          admin_order_notifications: boolean | null
          admin_payment_notifications: boolean | null
          brand_guidelines: string | null
          business_hours: Json | null
          created_at: string
          default_vat_rate: number | null
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
          site_url: string | null
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
          admin_notification_email?: string | null
          admin_order_notifications?: boolean | null
          admin_payment_notifications?: boolean | null
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          default_vat_rate?: number | null
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
          site_url?: string | null
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
          admin_notification_email?: string | null
          admin_order_notifications?: boolean | null
          admin_payment_notifications?: boolean | null
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          default_vat_rate?: number | null
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
          site_url?: string | null
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
      cart_sessions: {
        Row: {
          abandoned_at: string | null
          cart_data: Json
          checkout_started_at: string | null
          converted_to_customer_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_phone: string | null
          id: string
          is_abandoned: boolean | null
          last_activity: string | null
          session_id: string
          total_items: number | null
          total_value: number | null
          updated_at: string | null
        }
        Insert: {
          abandoned_at?: string | null
          cart_data?: Json
          checkout_started_at?: string | null
          converted_to_customer_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          id?: string
          is_abandoned?: boolean | null
          last_activity?: string | null
          session_id: string
          total_items?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Update: {
          abandoned_at?: string | null
          cart_data?: Json
          checkout_started_at?: string | null
          converted_to_customer_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          id?: string
          is_abandoned?: boolean | null
          last_activity?: string | null
          session_id?: string
          total_items?: number | null
          total_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_sessions_converted_to_customer_id_fkey"
            columns: ["converted_to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      catering_bookings: {
        Row: {
          additional_details: string | null
          admin_notes: string | null
          created_at: string
          email: string
          event_date: string
          full_name: string
          id: string
          number_of_guests: number
          phone_number: string
          quote_amount: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_details?: string | null
          admin_notes?: string | null
          created_at?: string
          email: string
          event_date: string
          full_name: string
          id?: string
          number_of_guests: number
          phone_number: string
          quote_amount?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_details?: string | null
          admin_notes?: string | null
          created_at?: string
          email?: string
          event_date?: string
          full_name?: string
          id?: string
          number_of_guests?: number
          phone_number?: string
          quote_amount?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
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
          priority: string | null
          processed_at: string | null
          recipient_email: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          template_id: string | null
          template_key: string | null
          template_variables: Json | null
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
          priority?: string | null
          processed_at?: string | null
          recipient_email?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          template_key?: string | null
          template_variables?: Json | null
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
          priority?: string | null
          processed_at?: string | null
          recipient_email?: string | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          template_key?: string | null
          template_variables?: Json | null
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
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          email_verification_expires_at: string | null
          email_verification_token: string | null
          email_verified: boolean | null
          id: string
          name: string
          phone: string | null
          phone_verified: boolean | null
          profile_completion_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_verification_expires_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          id?: string
          name: string
          phone?: string | null
          phone_verified?: boolean | null
          profile_completion_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          email_verification_expires_at?: string | null
          email_verification_token?: string | null
          email_verified?: boolean | null
          id?: string
          name?: string
          phone?: string | null
          phone_verified?: boolean | null
          profile_completion_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_line_1: string
          address_line_2: string | null
          address_type: string
          city: string
          country: string
          created_at: string
          customer_id: string
          delivery_instructions: string | null
          id: string
          is_default: boolean
          landmark: string | null
          phone_number: string | null
          postal_code: string
          state: string
          updated_at: string
        }
        Insert: {
          address_line_1: string
          address_line_2?: string | null
          address_type?: string
          city: string
          country?: string
          created_at?: string
          customer_id: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone_number?: string | null
          postal_code: string
          state: string
          updated_at?: string
        }
        Update: {
          address_line_1?: string
          address_line_2?: string | null
          address_type?: string
          city?: string
          country?: string
          created_at?: string
          customer_id?: string
          delivery_instructions?: string | null
          id?: string
          is_default?: boolean
          landmark?: string | null
          phone_number?: string | null
          postal_code?: string
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      customer_auth_audit: {
        Row: {
          action: string
          created_at: string | null
          customer_id: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          session_id: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          customer_id?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          customer_id?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          session_id?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_auth_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      customer_delivery_preferences: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          customer_id: string
          delivery_instructions: string | null
          email_notifications: boolean | null
          id: string
          notifications_enabled: boolean | null
          preferred_days: string[] | null
          preferred_delivery_time_end: string | null
          preferred_delivery_time_start: string | null
          sms_notifications: boolean | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id: string
          delivery_instructions?: string | null
          email_notifications?: boolean | null
          id?: string
          notifications_enabled?: boolean | null
          preferred_days?: string[] | null
          preferred_delivery_time_end?: string | null
          preferred_delivery_time_start?: string | null
          sms_notifications?: boolean | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          customer_id?: string
          delivery_instructions?: string | null
          email_notifications?: boolean | null
          id?: string
          notifications_enabled?: boolean | null
          preferred_days?: string[] | null
          preferred_delivery_time_end?: string | null
          preferred_delivery_time_start?: string | null
          sms_notifications?: boolean | null
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
      customer_otp_codes: {
        Row: {
          attempts: number | null
          created_at: string | null
          created_by_ip: unknown | null
          customer_id: string | null
          email: string
          expires_at: string
          id: string
          max_attempts: number | null
          otp_code: string
          otp_type: string
          used_at: string | null
          verification_metadata: Json | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          created_by_ip?: unknown | null
          customer_id?: string | null
          email: string
          expires_at: string
          id?: string
          max_attempts?: number | null
          otp_code: string
          otp_type: string
          used_at?: string | null
          verification_metadata?: Json | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          created_by_ip?: unknown | null
          customer_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          otp_code?: string
          otp_type?: string
          used_at?: string | null
          verification_metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_otp_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
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
      customer_preferences: {
        Row: {
          created_at: string
          customer_id: string
          email_notifications: boolean
          id: string
          marketing_emails: boolean
          newsletter_subscription: boolean
          order_updates: boolean
          preferred_currency: string
          preferred_language: string
          price_alerts: boolean
          promotion_alerts: boolean
          push_notifications: boolean
          sms_notifications: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_notifications?: boolean
          id?: string
          marketing_emails?: boolean
          newsletter_subscription?: boolean
          order_updates?: boolean
          preferred_currency?: string
          preferred_language?: string
          price_alerts?: boolean
          promotion_alerts?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_notifications?: boolean
          id?: string
          marketing_emails?: boolean
          newsletter_subscription?: boolean
          order_updates?: boolean
          preferred_currency?: string
          preferred_language?: string
          price_alerts?: boolean
          promotion_alerts?: boolean
          push_notifications?: boolean
          sms_notifications?: boolean
          updated_at?: string
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
      customer_satisfaction_ratings: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_rating: number | null
          delivery_time_rating: number | null
          driver_id: string | null
          driver_rating: number | null
          feedback: string | null
          id: string
          order_id: string | null
          overall_rating: number | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_rating?: number | null
          delivery_time_rating?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          feedback?: string | null
          id?: string
          order_id?: string | null
          overall_rating?: number | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_rating?: number | null
          delivery_time_rating?: number | null
          driver_id?: string | null
          driver_rating?: number | null
          feedback?: string | null
          id?: string
          order_id?: string | null
          overall_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_satisfaction_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      debug_logs: {
        Row: {
          category: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown | null
          level: string
          message: string
          session_id: string | null
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          level?: string
          message: string
          session_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown | null
          level?: string
          message?: string
          session_id?: string | null
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      delivery_analytics: {
        Row: {
          average_delivery_time: number | null
          created_at: string
          customer_rating: number | null
          date: string
          driver_id: string | null
          failed_deliveries: number | null
          fuel_cost: number | null
          id: string
          successful_deliveries: number | null
          total_deliveries: number | null
          total_distance: number | null
          total_duration: number | null
        }
        Insert: {
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          date: string
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_distance?: number | null
          total_duration?: number | null
        }
        Update: {
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          date?: string
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_distance?: number | null
          total_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_analytics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
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
      delivery_notifications: {
        Row: {
          channel: string
          content: Json | null
          created_at: string
          customer_email: string
          id: string
          notification_type: string
          order_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel: string
          content?: Json | null
          created_at?: string
          customer_email: string
          id?: string
          notification_type: string
          order_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string
          content?: Json | null
          created_at?: string
          customer_email?: string
          id?: string
          notification_type?: string
          order_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_performance_metrics: {
        Row: {
          average_delivery_time: number | null
          created_at: string
          customer_rating: number | null
          driver_id: string | null
          failed_deliveries: number | null
          fuel_cost: number | null
          id: string
          metric_date: string
          on_time_deliveries: number | null
          successful_deliveries: number | null
          total_deliveries: number | null
          total_distance: number | null
          zone_id: string | null
        }
        Insert: {
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          metric_date: string
          on_time_deliveries?: number | null
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_distance?: number | null
          zone_id?: string | null
        }
        Update: {
          average_delivery_time?: number | null
          created_at?: string
          customer_rating?: number | null
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          metric_date?: string
          on_time_deliveries?: number | null
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_distance?: number | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_performance_metrics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_performance_metrics_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_routes: {
        Row: {
          actual_duration: number | null
          created_at: string
          driver_id: string | null
          estimated_duration: number | null
          id: string
          route_date: string
          route_points: Json | null
          status: string
          total_distance: number | null
          total_orders: number | null
          updated_at: string
        }
        Insert: {
          actual_duration?: number | null
          created_at?: string
          driver_id?: string | null
          estimated_duration?: number | null
          id?: string
          route_date: string
          route_points?: Json | null
          status?: string
          total_distance?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Update: {
          actual_duration?: number | null
          created_at?: string
          driver_id?: string | null
          estimated_duration?: number | null
          id?: string
          route_date?: string
          route_points?: Json | null
          status?: string
          total_distance?: number | null
          total_orders?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_time_slots: {
        Row: {
          created_at: string
          current_bookings: number | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          max_capacity: number | null
          start_time: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string
          current_bookings?: number | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          max_capacity?: number | null
          start_time: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string
          current_bookings?: number | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_capacity?: number | null
          start_time?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_time_slots_zone_id_fkey"
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
      driver_location_tracking: {
        Row: {
          accuracy: number | null
          battery_level: number | null
          driver_id: string | null
          heading: number | null
          id: string
          is_online: boolean | null
          latitude: number
          longitude: number
          speed: number | null
          tracked_at: string
        }
        Insert: {
          accuracy?: number | null
          battery_level?: number | null
          driver_id?: string | null
          heading?: number | null
          id?: string
          is_online?: boolean | null
          latitude: number
          longitude: number
          speed?: number | null
          tracked_at?: string
        }
        Update: {
          accuracy?: number | null
          battery_level?: number | null
          driver_id?: string | null
          heading?: number | null
          id?: string
          is_online?: boolean | null
          latitude?: number
          longitude?: number
          speed?: number | null
          tracked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_location_tracking_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          current_location: Json | null
          email: string | null
          id: string
          is_active: boolean | null
          license_number: string | null
          license_plate: string | null
          name: string
          phone: string
          profile_id: string | null
          updated_at: string
          vehicle_brand: string | null
          vehicle_model: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string
          current_location?: Json | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          license_plate?: string | null
          name: string
          phone: string
          profile_id?: string | null
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string
          current_location?: Json | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          license_number?: string | null
          license_plate?: string | null
          name?: string
          phone?: string
          profile_id?: string | null
          updated_at?: string
          vehicle_brand?: string | null
          vehicle_model?: string | null
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_bounce_tracking: {
        Row: {
          bounce_count: number | null
          bounce_reason: string | null
          bounce_type: string
          created_at: string | null
          email_address: string
          first_bounce_at: string | null
          id: string
          last_bounce_at: string | null
          smtp_provider: string | null
          suppressed_at: string | null
          suppression_reason: string | null
        }
        Insert: {
          bounce_count?: number | null
          bounce_reason?: string | null
          bounce_type: string
          created_at?: string | null
          email_address: string
          first_bounce_at?: string | null
          id?: string
          last_bounce_at?: string | null
          smtp_provider?: string | null
          suppressed_at?: string | null
          suppression_reason?: string | null
        }
        Update: {
          bounce_count?: number | null
          bounce_reason?: string | null
          bounce_type?: string
          created_at?: string | null
          email_address?: string
          first_bounce_at?: string | null
          id?: string
          last_bounce_at?: string | null
          smtp_provider?: string | null
          suppressed_at?: string | null
          suppression_reason?: string | null
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
      email_delivery_confirmations: {
        Row: {
          communication_event_id: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_status: string
          id: string
          provider_response: Json | null
          updated_at: string | null
        }
        Insert: {
          communication_event_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status: string
          id?: string
          provider_response?: Json | null
          updated_at?: string | null
        }
        Update: {
          communication_event_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          provider_response?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_delivery_confirmations_communication_event_id_fkey"
            columns: ["communication_event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
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
      email_health_metrics: {
        Row: {
          created_at: string
          delivery_rate: number
          failed_events: number
          id: string
          period: string
          sent_events: number
          timestamp: string
          total_events: number
        }
        Insert: {
          created_at?: string
          delivery_rate?: number
          failed_events?: number
          id?: string
          period?: string
          sent_events?: number
          timestamp?: string
          total_events?: number
        }
        Update: {
          created_at?: string
          delivery_rate?: number
          failed_events?: number
          id?: string
          period?: string
          sent_events?: number
          timestamp?: string
          total_events?: number
        }
        Relationships: []
      }
      email_processing_metrics: {
        Row: {
          average_processing_time: number | null
          bounce_rate: number | null
          created_at: string
          date: string
          delivery_rate: number | null
          error_categories: Json | null
          id: string
          peak_queue_size: number | null
          total_bounced: number | null
          total_delivered: number | null
          total_failed: number | null
          total_queued: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          average_processing_time?: number | null
          bounce_rate?: number | null
          created_at?: string
          date: string
          delivery_rate?: number | null
          error_categories?: Json | null
          id?: string
          peak_queue_size?: number | null
          total_bounced?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_queued?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          average_processing_time?: number | null
          bounce_rate?: number | null
          created_at?: string
          date?: string
          delivery_rate?: number | null
          error_categories?: Json | null
          id?: string
          peak_queue_size?: number | null
          total_bounced?: number | null
          total_delivered?: number | null
          total_failed?: number | null
          total_queued?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      email_processing_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_details: Json | null
          event_id: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          next_retry_at: string | null
          priority: string | null
          scheduled_for: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_details?: Json | null
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          priority?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_details?: Json | null
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          next_retry_at?: string | null
          priority?: string | null
          scheduled_for?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_processing_queue_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
      }
      email_rate_limits: {
        Row: {
          created_at: string
          email_type: string
          id: string
          identifier: string
          limit_per_day: number
          limit_per_hour: number
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          email_type: string
          id?: string
          identifier: string
          limit_per_day?: number
          limit_per_hour?: number
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          identifier?: string
          limit_per_day?: number
          limit_per_hour?: number
          request_count?: number
          window_start?: string
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
      enhanced_email_config: {
        Row: {
          batch_size: number | null
          created_at: string | null
          fallback_ports: number[] | null
          id: string
          instant_processing_enabled: boolean | null
          max_retries: number | null
          processing_interval_seconds: number | null
          retry_intervals: number[] | null
          updated_at: string | null
          use_enhanced_smtp: boolean | null
        }
        Insert: {
          batch_size?: number | null
          created_at?: string | null
          fallback_ports?: number[] | null
          id?: string
          instant_processing_enabled?: boolean | null
          max_retries?: number | null
          processing_interval_seconds?: number | null
          retry_intervals?: number[] | null
          updated_at?: string | null
          use_enhanced_smtp?: boolean | null
        }
        Update: {
          batch_size?: number | null
          created_at?: string | null
          fallback_ports?: number[] | null
          id?: string
          instant_processing_enabled?: boolean | null
          max_retries?: number | null
          processing_interval_seconds?: number | null
          retry_intervals?: number[] | null
          updated_at?: string | null
          use_enhanced_smtp?: boolean | null
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
      notification_delivery_log: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          order_id: string | null
          provider_response: Json | null
          recipient: string
          sent_at: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          order_id?: string | null
          provider_response?: Json | null
          recipient: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          order_id?: string | null
          provider_response?: Json | null
          recipient?: string
          sent_at?: string | null
          status?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "notification_templates"
            referencedColumns: ["id"]
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
      notification_templates: {
        Row: {
          channel: string
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          subject: string | null
          template_key: string
          template_name: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          channel: string
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          subject?: string | null
          template_key: string
          template_name: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          channel?: string
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          subject?: string | null
          template_key?: string
          template_name?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          cost_price: number | null
          customizations: Json | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          special_instructions: string | null
          total_price: number
          unit_price: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          cost_price?: number | null
          customizations?: Json | null
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          special_instructions?: string | null
          total_price: number
          unit_price: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          cost_price?: number | null
          customizations?: Json | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          special_instructions?: string | null
          total_price?: number
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
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
          delivery_time_slot_id: string | null
          delivery_zone_id: string | null
          discount_amount: number | null
          guest_session_id: string | null
          id: string
          order_number: string
          order_time: string
          order_type: Database["public"]["Enums"]["order_type"]
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          pickup_point_id: string | null
          pickup_time: string | null
          preferred_delivery_time: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          subtotal_cost: number | null
          tax_amount: number
          total_amount: number
          total_vat: number | null
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
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          guest_session_id?: string | null
          id?: string
          order_number: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_point_id?: string | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
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
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          guest_session_id?: string | null
          id?: string
          order_number?: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          pickup_point_id?: string | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
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
            foreignKeyName: "orders_delivery_time_slot_id_fkey"
            columns: ["delivery_time_slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_time_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          created_at: string
          email: string
          expires_at: string
          id: string
          is_used: boolean
          max_attempts: number
          otp_code: string
          otp_type: string
          used_at: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          is_used?: boolean
          max_attempts?: number
          otp_code: string
          otp_type: string
          used_at?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          max_attempts?: number
          otp_code?: string
          otp_type?: string
          used_at?: string | null
        }
        Relationships: []
      }
      otp_rate_limits: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          email: string
          id: string
          is_blocked: boolean | null
          last_attempt: string | null
          window_start: string | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          email: string
          id?: string
          is_blocked?: boolean | null
          last_attempt?: string | null
          window_start?: string | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          email?: string
          id?: string
          is_blocked?: boolean | null
          last_attempt?: string | null
          window_start?: string | null
        }
        Relationships: []
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
          last_health_check: string | null
          live_public_key: string | null
          live_secret_key: string | null
          live_webhook_secret: string | null
          mode: string | null
          payment_methods: Json | null
          provider: string
          public_key: string | null
          secret_key: string | null
          security_score: number | null
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
          last_health_check?: string | null
          live_public_key?: string | null
          live_secret_key?: string | null
          live_webhook_secret?: string | null
          mode?: string | null
          payment_methods?: Json | null
          provider: string
          public_key?: string | null
          secret_key?: string | null
          security_score?: number | null
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
          last_health_check?: string | null
          live_public_key?: string | null
          live_secret_key?: string | null
          live_webhook_secret?: string | null
          mode?: string | null
          payment_methods?: Json | null
          provider?: string
          public_key?: string | null
          secret_key?: string | null
          security_score?: number | null
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
      performance_analytics: {
        Row: {
          cache_hit: boolean | null
          database_query_time_ms: number | null
          endpoint: string
          error_details: Json | null
          id: string
          ip_address: unknown | null
          method: string
          recorded_at: string
          request_size_bytes: number | null
          response_size_bytes: number | null
          response_time_ms: number
          status_code: number
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean | null
          database_query_time_ms?: number | null
          endpoint: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          method: string
          recorded_at?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_time_ms: number
          status_code: number
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean | null
          database_query_time_ms?: number | null
          endpoint?: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          method?: string
          recorded_at?: string
          request_size_bytes?: number | null
          response_size_bytes?: number | null
          response_time_ms?: number
          status_code?: number
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pickup_points: {
        Row: {
          address: string
          capacity: number | null
          contact_phone: string | null
          coordinates: Json | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean | null
          name: string
          operating_hours: Json | null
          updated_at: string
        }
        Insert: {
          address: string
          capacity?: number | null
          contact_phone?: string | null
          coordinates?: Json | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name: string
          operating_hours?: Json | null
          updated_at?: string
        }
        Update: {
          address?: string
          capacity?: number | null
          contact_phone?: string | null
          coordinates?: Json | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          name?: string
          operating_hours?: Json | null
          updated_at?: string
        }
        Relationships: []
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
      production_checklist: {
        Row: {
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          is_completed: boolean | null
          item_description: string | null
          item_name: string
          priority_level: string | null
          updated_at: string
        }
        Insert: {
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          item_description?: string | null
          item_name: string
          priority_level?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean | null
          item_description?: string | null
          item_name?: string
          priority_level?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      production_readiness_audit: {
        Row: {
          audit_date: string | null
          completed_fixes: Json | null
          critical_issues: number | null
          id: string
          info_issues: number | null
          metadata: Json | null
          recommendations: string[] | null
          security_score: number | null
          status: string | null
          warning_issues: number | null
        }
        Insert: {
          audit_date?: string | null
          completed_fixes?: Json | null
          critical_issues?: number | null
          id?: string
          info_issues?: number | null
          metadata?: Json | null
          recommendations?: string[] | null
          security_score?: number | null
          status?: string | null
          warning_issues?: number | null
        }
        Update: {
          audit_date?: string | null
          completed_fixes?: Json | null
          critical_issues?: number | null
          id?: string
          info_issues?: number | null
          metadata?: Json | null
          recommendations?: string[] | null
          security_score?: number | null
          status?: string | null
          warning_issues?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          allergen_info: string[] | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          created_by: string | null
          description: string | null
          features: Json | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_promotional: boolean | null
          name: string
          nutritional_info: Json | null
          preparation_time: number | null
          price: number
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          updated_at: string
          updated_by: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          allergen_info?: string[] | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_promotional?: boolean | null
          name: string
          nutritional_info?: Json | null
          preparation_time?: number | null
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          allergen_info?: string[] | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_promotional?: boolean | null
          name?: string
          nutritional_info?: Json | null
          preparation_time?: number | null
          price?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          updated_at?: string
          updated_by?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
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
      profile_activity_log: {
        Row: {
          action_type: string
          created_at: string
          customer_id: string
          field_changed: string | null
          id: string
          ip_address: unknown | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          customer_id: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          customer_id?: string
          field_changed?: string | null
          id?: string
          ip_address?: unknown | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Relationships: []
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
      promotion_analytics: {
        Row: {
          avg_order_value: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          promotion_id: string
          total_discount_given: number | null
          total_revenue_impact: number | null
          total_usage: number | null
          unique_customers: number | null
          updated_at: string | null
        }
        Insert: {
          avg_order_value?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          promotion_id: string
          total_discount_given?: number | null
          total_revenue_impact?: number | null
          total_usage?: number | null
          unique_customers?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_order_value?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          promotion_id?: string
          total_discount_given?: number | null
          total_revenue_impact?: number | null
          total_usage?: number | null
          unique_customers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_analytics_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
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
      promotion_usage_audit: {
        Row: {
          created_at: string | null
          customer_email: string | null
          discount_amount: number
          final_order_amount: number | null
          id: string
          metadata: Json | null
          order_id: string | null
          original_order_amount: number | null
          promotion_id: string
          usage_type: string
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          discount_amount?: number
          final_order_amount?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          original_order_amount?: number | null
          promotion_id: string
          usage_type: string
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          discount_amount?: number
          final_order_amount?: number | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          original_order_amount?: number | null
          promotion_id?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_usage_audit_promotion_id_fkey"
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
      registration_attempts: {
        Row: {
          attempt_type: string
          created_at: string | null
          customer_id: string | null
          email: string
          error_details: Json | null
          id: string
          ip_address: unknown | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempt_type: string
          created_at?: string | null
          customer_id?: string | null
          email: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_type?: string
          created_at?: string | null
          customer_id?: string | null
          email?: string
          error_details?: Json | null
          id?: string
          ip_address?: unknown | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
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
      route_order_assignments: {
        Row: {
          actual_arrival: string | null
          created_at: string
          delivery_notes: string | null
          delivery_status: string | null
          estimated_arrival: string | null
          id: string
          order_id: string | null
          route_id: string | null
          sequence_number: number
        }
        Insert: {
          actual_arrival?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_status?: string | null
          estimated_arrival?: string | null
          id?: string
          order_id?: string | null
          route_id?: string | null
          sequence_number: number
        }
        Update: {
          actual_arrival?: string | null
          created_at?: string
          delivery_notes?: string | null
          delivery_status?: string | null
          estimated_arrival?: string | null
          id?: string
          order_id?: string | null
          route_id?: string | null
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_order_assignments_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "delivery_routes"
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
      security_alerts: {
        Row: {
          affected_resource: string | null
          alert_type: string
          assigned_to: string | null
          created_at: string
          description: string | null
          detection_method: string | null
          id: string
          raw_data: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          severity: string
          source_ip: unknown | null
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          affected_resource?: string | null
          alert_type: string
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          id?: string
          raw_data?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity: string
          source_ip?: unknown | null
          status?: string
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          affected_resource?: string | null
          alert_type?: string
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          detection_method?: string | null
          id?: string
          raw_data?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          severity?: string
          source_ip?: unknown | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          description: string
          event_type: string
          id: string
          ip_address: unknown | null
          metadata: Json | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_type: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          severity?: string
          user_agent?: string | null
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
      smtp_connection_audit: {
        Row: {
          connection_attempt_at: string | null
          connection_success: boolean
          connection_time_ms: number | null
          created_at: string | null
          error_message: string | null
          id: string
          provider_name: string
          source_ip: unknown | null
          user_agent: string | null
        }
        Insert: {
          connection_attempt_at?: string | null
          connection_success: boolean
          connection_time_ms?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          provider_name: string
          source_ip?: unknown | null
          user_agent?: string | null
        }
        Update: {
          connection_attempt_at?: string | null
          connection_success?: boolean
          connection_time_ms?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          provider_name?: string
          source_ip?: unknown | null
          user_agent?: string | null
        }
        Relationships: []
      }
      smtp_delivery_confirmations: {
        Row: {
          created_at: string | null
          delivery_status: string
          delivery_time_ms: number | null
          email_id: string
          id: string
          message_id: string | null
          provider_response: Json | null
          provider_used: string
          recipient_email: string
        }
        Insert: {
          created_at?: string | null
          delivery_status: string
          delivery_time_ms?: number | null
          email_id: string
          id?: string
          message_id?: string | null
          provider_response?: Json | null
          provider_used: string
          recipient_email: string
        }
        Update: {
          created_at?: string | null
          delivery_status?: string
          delivery_time_ms?: number | null
          email_id?: string
          id?: string
          message_id?: string | null
          provider_response?: Json | null
          provider_used?: string
          recipient_email?: string
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
      smtp_health_logs: {
        Row: {
          connection_status: string
          created_at: string | null
          error_message: string | null
          host: string
          id: string
          port: number
          provider_name: string
          response_time_ms: number | null
          test_type: string | null
        }
        Insert: {
          connection_status: string
          created_at?: string | null
          error_message?: string | null
          host: string
          id?: string
          port: number
          provider_name: string
          response_time_ms?: number | null
          test_type?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string | null
          error_message?: string | null
          host?: string
          id?: string
          port?: number
          provider_name?: string
          response_time_ms?: number | null
          test_type?: string | null
        }
        Relationships: []
      }
      smtp_health_metrics: {
        Row: {
          alert_sent: boolean | null
          id: string
          metric_type: string
          metric_value: number
          provider_name: string
          recorded_at: string | null
          threshold_breached: boolean | null
          threshold_value: number | null
        }
        Insert: {
          alert_sent?: boolean | null
          id?: string
          metric_type: string
          metric_value: number
          provider_name: string
          recorded_at?: string | null
          threshold_breached?: boolean | null
          threshold_value?: number | null
        }
        Update: {
          alert_sent?: boolean | null
          id?: string
          metric_type?: string
          metric_value?: number
          provider_name?: string
          recorded_at?: string | null
          threshold_breached?: boolean | null
          threshold_value?: number | null
        }
        Relationships: []
      }
      smtp_health_monitoring: {
        Row: {
          authentication_success: boolean | null
          connection_success: boolean
          created_at: string | null
          error_message: string | null
          health_score: number | null
          id: string
          response_time_ms: number | null
          smtp_host: string
          smtp_port: number
          ssl_status: boolean | null
          test_email_sent: boolean | null
          timestamp: string | null
        }
        Insert: {
          authentication_success?: boolean | null
          connection_success: boolean
          created_at?: string | null
          error_message?: string | null
          health_score?: number | null
          id?: string
          response_time_ms?: number | null
          smtp_host: string
          smtp_port: number
          ssl_status?: boolean | null
          test_email_sent?: boolean | null
          timestamp?: string | null
        }
        Update: {
          authentication_success?: boolean | null
          connection_success?: boolean
          created_at?: string | null
          error_message?: string | null
          health_score?: number | null
          id?: string
          response_time_ms?: number | null
          smtp_host?: string
          smtp_port?: number
          ssl_status?: boolean | null
          test_email_sent?: boolean | null
          timestamp?: string | null
        }
        Relationships: []
      }
      smtp_provider_configs: {
        Row: {
          consecutive_failures: number | null
          created_at: string | null
          daily_limit: number | null
          failure_count: number | null
          health_score: number | null
          host: string
          hourly_limit: number | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          last_failure_at: string | null
          last_health_check: string | null
          name: string
          password_encrypted: string | null
          port: number
          priority: number | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string | null
          daily_limit?: number | null
          failure_count?: number | null
          health_score?: number | null
          host: string
          hourly_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_failure_at?: string | null
          last_health_check?: string | null
          name: string
          password_encrypted?: string | null
          port: number
          priority?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string | null
          daily_limit?: number | null
          failure_count?: number | null
          health_score?: number | null
          host?: string
          hourly_limit?: number | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_failure_at?: string | null
          last_health_check?: string | null
          name?: string
          password_encrypted?: string | null
          port?: number
          priority?: number | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      smtp_rate_limits: {
        Row: {
          created_at: string | null
          current_day_count: number | null
          current_hour_count: number | null
          daily_limit: number
          day_reset_at: string | null
          hourly_limit: number
          id: string
          identifier: string
          identifier_type: string | null
          last_send_at: string | null
          last_violation_at: string | null
          reputation_tier: string | null
          updated_at: string | null
          violation_count: number | null
          window_reset_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_day_count?: number | null
          current_hour_count?: number | null
          daily_limit: number
          day_reset_at?: string | null
          hourly_limit: number
          id?: string
          identifier: string
          identifier_type?: string | null
          last_send_at?: string | null
          last_violation_at?: string | null
          reputation_tier?: string | null
          updated_at?: string | null
          violation_count?: number | null
          window_reset_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_day_count?: number | null
          current_hour_count?: number | null
          daily_limit?: number
          day_reset_at?: string | null
          hourly_limit?: number
          id?: string
          identifier?: string
          identifier_type?: string | null
          last_send_at?: string | null
          last_violation_at?: string | null
          reputation_tier?: string | null
          updated_at?: string | null
          violation_count?: number | null
          window_reset_at?: string | null
        }
        Relationships: []
      }
      smtp_reputation_scores: {
        Row: {
          bounce_rate: number | null
          complaint_rate: number | null
          created_at: string | null
          domain: string
          id: string
          last_updated: string | null
          reputation_score: number | null
          status: string | null
          total_bounced: number | null
          total_complaints: number | null
          total_sent: number | null
        }
        Insert: {
          bounce_rate?: number | null
          complaint_rate?: number | null
          created_at?: string | null
          domain: string
          id?: string
          last_updated?: string | null
          reputation_score?: number | null
          status?: string | null
          total_bounced?: number | null
          total_complaints?: number | null
          total_sent?: number | null
        }
        Update: {
          bounce_rate?: number | null
          complaint_rate?: number | null
          created_at?: string | null
          domain?: string
          id?: string
          last_updated?: string | null
          reputation_score?: number | null
          status?: string | null
          total_bounced?: number | null
          total_complaints?: number | null
          total_sent?: number | null
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at: string
          severity: string | null
          tags: Json | null
        }
        Insert: {
          id?: string
          metric_name: string
          metric_type: string
          metric_value: number
          recorded_at?: string
          severity?: string | null
          tags?: Json | null
        }
        Update: {
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          recorded_at?: string
          severity?: string | null
          tags?: Json | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          bio: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          linkedin_url: string | null
          name: string
          phone: string | null
          position: string
          sort_order: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          linkedin_url?: string | null
          name: string
          phone?: string | null
          position: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          linkedin_url?: string | null
          name?: string
          phone?: string | null
          position?: string
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
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
      bulk_safe_delete_products: {
        Args: { product_ids: string[] }
        Returns: Json
      }
      calculate_bogo_discount: {
        Args: { p_promotion_id: string; p_cart_items: Json }
        Returns: Json
      }
      calculate_brand_consistency_score: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_daily_email_metrics: {
        Args: Record<PropertyKey, never> | { target_date?: string }
        Returns: Json
      }
      calculate_profile_completion: {
        Args: { customer_uuid: string }
        Returns: number
      }
      calculate_sender_reputation: {
        Args: { p_domain: string }
        Returns: Json
      }
      calculate_vat_breakdown: {
        Args: { cart_items: Json; delivery_fee?: number }
        Returns: Json
      }
      can_send_email_to: {
        Args: { email_address: string; email_type?: string }
        Returns: boolean
      }
      check_admin_invitation_rate_limit: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      check_customer_operation_rate_limit: {
        Args: { p_admin_id: string; p_operation: string; p_limit?: number }
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
      check_email_rate_limit: {
        Args: { p_identifier: string; p_email_type?: string }
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
      check_otp_rate_limit: {
        Args: { p_email: string } | { p_email: string; p_ip_address?: unknown }
        Returns: Json
      }
      check_paystack_production_readiness: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_rate_limit_with_reputation: {
        Args: { p_identifier: string; p_identifier_type?: string }
        Returns: Json
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
      cleanup_email_processing_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_admin_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_customer_otps: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_expired_otp_codes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_monitoring_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_communication_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_email_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_guest_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      convert_guest_cart_to_customer: {
        Args: { p_guest_session_id: string; p_customer_id: string }
        Returns: Json
      }
      create_admin_session: {
        Args: {
          p_user_id: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      create_customer_with_validation: {
        Args: {
          p_name: string
          p_email: string
          p_phone?: string
          p_admin_id?: string
          p_send_welcome_email?: boolean
          p_ip_address?: unknown
          p_user_agent?: string
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
      create_missing_customer_account: {
        Args: { p_user_id: string }
        Returns: Json
      }
      create_order_with_items: {
        Args:
          | {
              p_customer_email: string
              p_customer_name: string
              p_customer_phone: string
              p_order_items: Json
              p_total_amount: number
              p_fulfillment_type?: string
              p_delivery_address?: Json
              p_pickup_point_id?: string
              p_delivery_fee?: number
              p_delivery_zone_id?: string
              p_guest_session_id?: string
            }
          | {
              p_customer_name: string
              p_customer_email: string
              p_customer_phone: string
              p_delivery_address: string
              p_delivery_zone_id: string
              p_payment_method: string
              p_order_items: Json
              p_total_amount: number
              p_guest_session_id?: string
              p_order_type?: string
            }
        Returns: Json
      }
      customer_purchased_product: {
        Args: { customer_uuid: string; product_uuid: string }
        Returns: boolean
      }
      debug_payment_transaction_insert: {
        Args: {
          p_order_id: string
          p_customer_email: string
          p_amount: number
          p_currency?: string
          p_payment_method?: string
          p_transaction_type?: string
          p_status?: string
        }
        Returns: Json
      }
      delete_customer_cascade: {
        Args: { p_customer_id: string }
        Returns: Json
      }
      detect_abandoned_carts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      detect_orphaned_customer_records: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          has_customer_record: boolean
          has_auth_user: boolean
          has_customer_account: boolean
          communication_events_count: number
          issue_type: string
        }[]
      }
      diagnose_registration_issues: {
        Args: { p_email: string }
        Returns: Json
      }
      enhanced_security_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      fix_user_linking: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_guest_session_id: {
        Args: Record<PropertyKey, never>
        Returns: string
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
      get_admin_invitation_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_invitations: number
          pending_invitations: number
          accepted_invitations: number
          expired_invitations: number
          success_rate: number
        }[]
      }
      get_all_customers_display: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
      get_best_smtp_provider: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_customer_analytics_safe: {
        Args: { p_start_date?: string; p_end_date?: string }
        Returns: Json
      }
      get_dashboard_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_products: number
          total_orders: number
          total_customers: number
          total_revenue: number
        }[]
      }
      get_email_health_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
      get_public_delivery_zones: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          description: string
          base_fee: number
          fee_per_km: number
          min_order_for_free_delivery: number
        }[]
      }
      get_queued_communication_events: {
        Args: { batch_size?: number }
        Returns: {
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
          priority: string | null
          processed_at: string | null
          recipient_email: string | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          template_id: string | null
          template_key: string | null
          template_variables: Json | null
          updated_at: string
          variables: Json | null
        }[]
      }
      get_smtp_config_with_fallback: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_time_ago: {
        Args: { target_time: string }
        Returns: string
      }
      get_user_role: {
        Args: { user_uuid: string }
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
      increment_promotion_usage: {
        Args: {
          p_promotion_id: string
          p_order_id: string
          p_customer_email: string
          p_discount_amount: number
          p_original_amount: number
          p_final_amount: number
          p_metadata?: Json
        }
        Returns: undefined
      }
      increment_rate_limit_counter: {
        Args: { p_identifier: string; p_identifier_type?: string }
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
      log_customer_operation: {
        Args: {
          p_action: string
          p_customer_id?: string
          p_customer_data?: Json
          p_admin_id?: string
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
      log_payment_security_event: {
        Args: {
          event_type: string
          severity?: string
          details?: Json
          ip_address?: unknown
          user_agent?: string
        }
        Returns: string
      }
      log_profile_activity: {
        Args: {
          p_customer_id: string
          p_action_type: string
          p_field_changed?: string
          p_old_value?: string
          p_new_value?: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      log_registration_debug: {
        Args: {
          p_message: string
          p_level?: string
          p_category?: string
          p_details?: Json
          p_user_id?: string
          p_session_id?: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_event_type: string
          p_description: string
          p_severity?: string
          p_metadata?: Json
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
      minimal_payment_test_insert: {
        Args: { p_order_id: string; p_amount: number }
        Returns: Json
      }
      process_email_queue_manual: {
        Args: { batch_size?: number }
        Returns: Json
      }
      process_email_queue_real_time: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      record_health_metric: {
        Args: {
          p_metric_name: string
          p_metric_value: number
          p_metric_type?: string
          p_tags?: Json
          p_severity?: string
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
      record_performance_metric: {
        Args: {
          p_endpoint: string
          p_method: string
          p_response_time_ms: number
          p_status_code: number
          p_user_id?: string
          p_ip_address?: unknown
          p_user_agent?: string
          p_request_size_bytes?: number
          p_response_size_bytes?: number
          p_database_query_time_ms?: number
          p_cache_hit?: boolean
          p_error_details?: Json
        }
        Returns: string
      }
      record_smtp_health_metric: {
        Args: {
          p_provider_name: string
          p_metric_type: string
          p_metric_value: number
          p_threshold_value?: number
        }
        Returns: undefined
      }
      recover_customer_email: {
        Args: { p_email: string }
        Returns: Json
      }
      recover_failed_registration: {
        Args: { p_email: string }
        Returns: Json
      }
      requeue_failed_welcome_emails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      safe_delete_product: {
        Args: { product_id: string }
        Returns: Json
      }
      sync_payment_to_order_status: {
        Args: {
          p_transaction_id: string
          p_payment_status: string
          p_order_status?: string
        }
        Returns: undefined
      }
      test_registration_system: {
        Args: Record<PropertyKey, never>
        Returns: {
          component: string
          status: string
          message: string
        }[]
      }
      update_customer_with_validation: {
        Args: {
          p_customer_id: string
          p_name?: string
          p_email?: string
          p_phone?: string
          p_admin_id?: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: Json
      }
      validate_admin_invitation_token: {
        Args: { token: string }
        Returns: {
          invitation_id: string
          email: string
          role: string
          is_valid: boolean
          expires_at: string
        }[]
      }
      validate_admin_permission: {
        Args: { required_permission?: string }
        Returns: boolean
      }
      validate_admin_session: {
        Args: { p_session_token: string; p_ip_address?: unknown }
        Returns: Json
      }
      validate_order_data: {
        Args: {
          p_customer_email: string
          p_order_items: Json
          p_total_amount: number
        }
        Returns: Json
      }
      validate_otp_code: {
        Args: { p_email: string; p_otp_code: string; p_otp_type: string }
        Returns: Json
      }
      validate_paystack_webhook_ip: {
        Args: { request_ip: unknown }
        Returns: boolean
      }
      validate_promotion_usage: {
        Args: {
          p_promotion_id: string
          p_order_amount: number
          p_customer_email?: string
          p_promotion_code?: string
        }
        Returns: Json
      }
      verify_customer_otp: {
        Args: {
          p_email: string
          p_otp_code: string
          p_otp_type: string
          p_ip_address?: unknown
        }
        Returns: Json
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
        | "completed"
      order_type: "delivery" | "pickup" | "dine_in"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
      permission_level: "none" | "view" | "edit"
      product_status: "active" | "archived" | "draft" | "discontinued"
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
        "completed",
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
      product_status: ["active", "archived", "draft", "discontinued"],
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
