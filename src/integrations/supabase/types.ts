export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
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
      alert_notifications: {
        Row: {
          alert_rule_id: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          id: string
          message: string
          response_body: string | null
          response_code: number | null
          retry_count: number | null
          severity: string
          webhook_url: string | null
        }
        Insert: {
          alert_rule_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          message: string
          response_body?: string | null
          response_code?: number | null
          retry_count?: number | null
          severity: string
          webhook_url?: string | null
        }
        Update: {
          alert_rule_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          message?: string
          response_body?: string | null
          response_code?: number | null
          retry_count?: number | null
          severity?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          check_interval_seconds: number | null
          condition_sql: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          rule_name: string
          severity: string | null
          threshold_value: number | null
          trigger_count: number | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          check_interval_seconds?: number | null
          condition_sql: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name: string
          severity?: string | null
          threshold_value?: number | null
          trigger_count?: number | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          check_interval_seconds?: number | null
          condition_sql?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          rule_name?: string
          severity?: string | null
          threshold_value?: number | null
          trigger_count?: number | null
          updated_at?: string | null
          webhook_url?: string | null
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
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_time: string
          id: string
          ip_address: string | null
          message: string | null
          new_values: Json | null
          old_values: Json | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          action: string
          category?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          action?: string
          category?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_time?: string
          id?: string
          ip_address?: string | null
          message?: string | null
          new_values?: Json | null
          old_values?: Json | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      automation_activity_logs: {
        Row: {
          action: string
          created_at: string | null
          data: Json | null
          id: string
          processed_at: string | null
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed_at?: string | null
          status: string
        }
        Update: {
          action?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          processed_at?: string | null
          status?: string
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
      budget_baller_content: {
        Row: {
          background_color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          items: Json
          text_color: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          text_color?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          items?: Json
          text_color?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
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
      business_sensitive_data: {
        Row: {
          admin_address: string | null
          admin_email: string | null
          admin_phone: string | null
          api_keys: Json | null
          business_settings_id: string
          created_at: string
          financial_info: Json | null
          id: string
          internal_notes: string | null
          updated_at: string
        }
        Insert: {
          admin_address?: string | null
          admin_email?: string | null
          admin_phone?: string | null
          api_keys?: Json | null
          business_settings_id: string
          created_at?: string
          financial_info?: Json | null
          id?: string
          internal_notes?: string | null
          updated_at?: string
        }
        Update: {
          admin_address?: string | null
          admin_email?: string | null
          admin_phone?: string | null
          api_keys?: Json | null
          business_settings_id?: string
          created_at?: string
          financial_info?: Json | null
          id?: string
          internal_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sensitive_data_business_settings_id_fkey"
            columns: ["business_settings_id"]
            isOneToOne: false
            referencedRelation: "business_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          accent_color: string | null
          admin_notification_email: string | null
          admin_order_notifications: boolean | null
          admin_payment_notifications: boolean | null
          allow_guest_checkout: boolean
          brand_guidelines: string | null
          business_hours: Json | null
          created_at: string
          default_vat_rate: number | null
          delivery_scheduling_config: Json | null
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
          whatsapp_support_number: string | null
          working_hours: string | null
          youtube_url: string | null
        }
        Insert: {
          accent_color?: string | null
          admin_notification_email?: string | null
          admin_order_notifications?: boolean | null
          admin_payment_notifications?: boolean | null
          allow_guest_checkout?: boolean
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          default_vat_rate?: number | null
          delivery_scheduling_config?: Json | null
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
          whatsapp_support_number?: string | null
          working_hours?: string | null
          youtube_url?: string | null
        }
        Update: {
          accent_color?: string | null
          admin_notification_email?: string | null
          admin_order_notifications?: boolean | null
          admin_payment_notifications?: boolean | null
          allow_guest_checkout?: boolean
          brand_guidelines?: string | null
          business_hours?: Json | null
          created_at?: string
          default_vat_rate?: number | null
          delivery_scheduling_config?: Json | null
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
          whatsapp_support_number?: string | null
          working_hours?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      cart_abandonment_tracking: {
        Row: {
          abandoned_at: string | null
          cart_data: Json
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          id: string
          is_abandoned: boolean | null
          recovered_at: string | null
          recovery_email_sent_at: string | null
          session_id: string
          total_value: number | null
        }
        Insert: {
          abandoned_at?: string | null
          cart_data?: Json
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          is_abandoned?: boolean | null
          recovered_at?: string | null
          recovery_email_sent_at?: string | null
          session_id: string
          total_value?: number | null
        }
        Update: {
          abandoned_at?: string | null
          cart_data?: Json
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          id?: string
          is_abandoned?: boolean | null
          recovered_at?: string | null
          recovery_email_sent_at?: string | null
          session_id?: string
          total_value?: number | null
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
          company_name: string | null
          created_at: string
          email: string
          event_date: string
          event_type: string | null
          full_name: string
          id: string
          is_company_order: boolean | null
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
          company_name?: string | null
          created_at?: string
          email: string
          event_date: string
          event_type?: string | null
          full_name: string
          id?: string
          is_company_order?: boolean | null
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
          company_name?: string | null
          created_at?: string
          email?: string
          event_date?: string
          event_type?: string | null
          full_name?: string
          id?: string
          is_company_order?: boolean | null
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
      circuit_breaker_state: {
        Row: {
          created_at: string | null
          failure_count: number | null
          failure_threshold: number | null
          id: string
          last_failure_time: string | null
          last_success_time: string | null
          next_retry_time: string | null
          service_name: string
          state: string
          timeout_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          failure_count?: number | null
          failure_threshold?: number | null
          id?: string
          last_failure_time?: string | null
          last_success_time?: string | null
          next_retry_time?: string | null
          service_name: string
          state?: string
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          failure_count?: number | null
          failure_threshold?: number | null
          id?: string
          last_failure_time?: string | null
          last_success_time?: string | null
          next_retry_time?: string | null
          service_name?: string
          state?: string
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      communication_event_warnings: {
        Row: {
          attempted_recipient_email: string | null
          created_at: string | null
          error_reason: string
          event_type: string | null
          id: string
          order_id: string | null
          original_payload: Json | null
          resolution_notes: string | null
          resolved_at: string | null
        }
        Insert: {
          attempted_recipient_email?: string | null
          created_at?: string | null
          error_reason: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          original_payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Update: {
          attempted_recipient_email?: string | null
          created_at?: string | null
          error_reason?: string
          event_type?: string | null
          id?: string
          order_id?: string | null
          original_payload?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          admin_session_id: string | null
          channel: string | null
          collision_detected_at: string | null
          created_at: string
          dedupe_key: string | null
          delivery_status: string | null
          email_provider: string | null
          email_type: string | null
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          last_error: string | null
          last_retry_at: string | null
          order_id: string | null
          payload: Json | null
          priority: string | null
          processed_at: string | null
          processing_started_at: string | null
          processing_time_ms: number | null
          provider_response: Json | null
          recipient_email: string | null
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          sms_cost: number | null
          sms_phone: string | null
          sms_sender: string | null
          source: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          template_id: string | null
          template_key: string | null
          template_variables: Json | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          admin_session_id?: string | null
          channel?: string | null
          collision_detected_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          delivery_status?: string | null
          email_provider?: string | null
          email_type?: string | null
          error_message?: string | null
          event_type: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_retry_at?: string | null
          order_id?: string | null
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          processing_time_ms?: number | null
          provider_response?: Json | null
          recipient_email?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sms_cost?: number | null
          sms_phone?: string | null
          sms_sender?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          template_key?: string | null
          template_variables?: Json | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          admin_session_id?: string | null
          channel?: string | null
          collision_detected_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          delivery_status?: string | null
          email_provider?: string | null
          email_type?: string | null
          error_message?: string | null
          event_type?: string
          external_id?: string | null
          id?: string
          last_error?: string | null
          last_retry_at?: string | null
          order_id?: string | null
          payload?: Json | null
          priority?: string | null
          processed_at?: string | null
          processing_started_at?: string | null
          processing_time_ms?: number | null
          provider_response?: Json | null
          recipient_email?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sms_cost?: number | null
          sms_phone?: string | null
          sms_sender?: string | null
          source?: string | null
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
      communication_events_archive: {
        Row: {
          created_at: string
          delivery_status: string | null
          email_provider: string | null
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
          processing_started_at: string | null
          processing_time_ms: number | null
          recipient_email: string | null
          retry_count: number
          scheduled_at: string | null
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
          email_provider?: string | null
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
          processing_started_at?: string | null
          processing_time_ms?: number | null
          recipient_email?: string | null
          retry_count?: number
          scheduled_at?: string | null
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
          email_provider?: string | null
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
          processing_started_at?: string | null
          processing_time_ms?: number | null
          recipient_email?: string | null
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["communication_event_status"]
          template_id?: string | null
          template_key?: string | null
          template_variables?: Json | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
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
          credential_source: string | null
          email_provider: string | null
          email_templates: Json | null
          id: string
          last_security_audit: string | null
          production_mode: boolean | null
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
          credential_source?: string | null
          email_provider?: string | null
          email_templates?: Json | null
          id?: string
          last_security_audit?: string | null
          production_mode?: boolean | null
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
          credential_source?: string | null
          email_provider?: string | null
          email_templates?: Json | null
          id?: string
          last_security_audit?: string | null
          production_mode?: boolean | null
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
      communication_settings_archive: {
        Row: {
          archived_at: string
          data: Json
          id: string
          original_id: string | null
        }
        Insert: {
          archived_at?: string
          data: Json
          id?: string
          original_id?: string | null
        }
        Update: {
          archived_at?: string
          data?: Json
          id?: string
          original_id?: string | null
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
      cron_execution_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          result_data: Json | null
          started_at: string | null
          status: string
          task_name: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          task_name: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string
          task_name?: string
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
          last_order_date: string | null
          marketing_consent: boolean | null
          name: string
          phone: string | null
          phone_verified: boolean | null
          profile_completion_percentage: number | null
          reactivation_email_sent: string | null
          sms_marketing_consent: boolean | null
          sms_notifications_enabled: boolean | null
          updated_at: string
          user_id: string | null
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
          last_order_date?: string | null
          marketing_consent?: boolean | null
          name: string
          phone?: string | null
          phone_verified?: boolean | null
          profile_completion_percentage?: number | null
          reactivation_email_sent?: string | null
          sms_marketing_consent?: boolean | null
          sms_notifications_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
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
          last_order_date?: string | null
          marketing_consent?: boolean | null
          name?: string
          phone?: string | null
          phone_verified?: boolean | null
          profile_completion_percentage?: number | null
          reactivation_email_sent?: string | null
          sms_marketing_consent?: boolean | null
          sms_notifications_enabled?: boolean | null
          updated_at?: string
          user_id?: string | null
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
          correlation_id: string | null
          created_at: string | null
          created_by_ip: unknown | null
          customer_id: string | null
          email: string
          expires_at: string
          failed_attempts: number | null
          id: string
          ip_address: unknown | null
          locked_until: string | null
          max_attempts: number | null
          otp_code: string
          otp_type: string
          used_at: string | null
          verification_metadata: Json | null
        }
        Insert: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string | null
          created_by_ip?: unknown | null
          customer_id?: string | null
          email: string
          expires_at: string
          failed_attempts?: number | null
          id?: string
          ip_address?: unknown | null
          locked_until?: string | null
          max_attempts?: number | null
          otp_code: string
          otp_type: string
          used_at?: string | null
          verification_metadata?: Json | null
        }
        Update: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string | null
          created_by_ip?: unknown | null
          customer_id?: string | null
          email?: string
          expires_at?: string
          failed_attempts?: number | null
          id?: string
          ip_address?: unknown | null
          locked_until?: string | null
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
      customer_profile_audit: {
        Row: {
          changed_at: string
          changed_fields: Json
          customer_id: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          user_agent: string | null
        }
        Insert: {
          changed_at?: string
          changed_fields: Json
          customer_id: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Update: {
          changed_at?: string
          changed_fields?: Json
          customer_id?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_profile_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      customer_registration_rate_limits: {
        Row: {
          attempts: number
          blocked_until: string | null
          created_at: string
          email_lower: string
          first_attempt_at: string
          id: string
          ip_address: unknown | null
          last_attempt_at: string
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          email_lower: string
          first_attempt_at?: string
          id?: string
          ip_address?: unknown | null
          last_attempt_at?: string
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          created_at?: string
          email_lower?: string
          first_attempt_at?: string
          id?: string
          ip_address?: unknown | null
          last_attempt_at?: string
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
      customer_satisfaction_ratings_archive: {
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
      deliveries: {
        Row: {
          actual_delivery: string | null
          created_at: string | null
          delivery_address: string
          delivery_fee: number | null
          delivery_notes: string | null
          estimated_delivery: string | null
          id: string
          order_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          actual_delivery?: string | null
          created_at?: string | null
          delivery_address: string
          delivery_fee?: number | null
          delivery_notes?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_delivery?: string | null
          created_at?: string | null
          delivery_address?: string
          delivery_fee?: number | null
          delivery_notes?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_analytics: {
        Row: {
          average_delivery_time: number | null
          average_delivery_time_minutes: number | null
          completed_deliveries: number | null
          created_at: string
          customer_rating: number | null
          date: string
          driver_id: string | null
          failed_deliveries: number | null
          fuel_cost: number | null
          id: string
          pending_deliveries: number | null
          successful_deliveries: number | null
          total_deliveries: number | null
          total_delivery_fees: number | null
          total_distance: number | null
          total_duration: number | null
          updated_at: string | null
        }
        Insert: {
          average_delivery_time?: number | null
          average_delivery_time_minutes?: number | null
          completed_deliveries?: number | null
          created_at?: string
          customer_rating?: number | null
          date: string
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          pending_deliveries?: number | null
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_delivery_fees?: number | null
          total_distance?: number | null
          total_duration?: number | null
          updated_at?: string | null
        }
        Update: {
          average_delivery_time?: number | null
          average_delivery_time_minutes?: number | null
          completed_deliveries?: number | null
          created_at?: string
          customer_rating?: number | null
          date?: string
          driver_id?: string | null
          failed_deliveries?: number | null
          fuel_cost?: number | null
          id?: string
          pending_deliveries?: number | null
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_delivery_fees?: number | null
          total_distance?: number | null
          total_duration?: number | null
          updated_at?: string | null
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
      delivery_assignments: {
        Row: {
          accepted_at: string | null
          actual_delivery_time: string | null
          assigned_at: string
          assigned_by: string | null
          completed_at: string | null
          created_at: string
          customer_rating: number | null
          delivery_notes: string | null
          driver_id: string
          estimated_delivery_time: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          order_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_rating?: number | null
          delivery_notes?: string | null
          driver_id: string
          estimated_delivery_time?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          order_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          completed_at?: string | null
          created_at?: string
          customer_rating?: number | null
          delivery_notes?: string | null
          driver_id?: string
          estimated_delivery_time?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_booking_analytics: {
        Row: {
          advance_booking_days: number
          booking_date: string
          booking_id: string
          booking_time_slot: string
          created_at: string | null
          customer_id: string
          id: string
        }
        Insert: {
          advance_booking_days: number
          booking_date: string
          booking_id: string
          booking_time_slot: string
          created_at?: string | null
          customer_id: string
          id?: string
        }
        Update: {
          advance_booking_days?: number
          booking_date?: string
          booking_id?: string
          booking_time_slot?: string
          created_at?: string | null
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_booking_analytics_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "delivery_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_bookings: {
        Row: {
          actual_arrival: string | null
          contact_phone: string | null
          created_at: string | null
          customer_id: string
          delivery_address: Json
          delivery_date: string
          delivery_notes: string | null
          delivery_time_end: string
          delivery_time_start: string
          driver_id: string | null
          estimated_arrival: string | null
          id: string
          order_id: string | null
          special_instructions: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          actual_arrival?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id: string
          delivery_address: Json
          delivery_date: string
          delivery_notes?: string | null
          delivery_time_end: string
          delivery_time_start: string
          driver_id?: string | null
          estimated_arrival?: string | null
          id?: string
          order_id?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          actual_arrival?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_id?: string
          delivery_address?: Json
          delivery_date?: string
          delivery_notes?: string | null
          delivery_time_end?: string
          delivery_time_start?: string
          driver_id?: string | null
          estimated_arrival?: string | null
          id?: string
          order_id?: string | null
          special_instructions?: string | null
          status?: string
          updated_at?: string | null
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
        Relationships: []
      }
      delivery_fees_backup: {
        Row: {
          base_fee: number | null
          created_at: string | null
          fee_per_km: number | null
          id: string | null
          min_order_for_free_delivery: number | null
          updated_at: string | null
          zone_id: string | null
        }
        Insert: {
          base_fee?: number | null
          created_at?: string | null
          fee_per_km?: number | null
          id?: string | null
          min_order_for_free_delivery?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Update: {
          base_fee?: number | null
          created_at?: string | null
          fee_per_km?: number | null
          id?: string | null
          min_order_for_free_delivery?: number | null
          updated_at?: string | null
          zone_id?: string | null
        }
        Relationships: []
      }
      delivery_holidays: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          is_recurring: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
          created_at: string | null
          current_bookings: number
          date: string
          end_time: string
          id: string
          is_available: boolean | null
          max_capacity: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_bookings?: number
          date: string
          end_time: string
          id?: string
          is_available?: boolean | null
          max_capacity?: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_bookings?: number
          date?: string
          end_time?: string
          id?: string
          is_available?: boolean | null
          max_capacity?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
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
          base_fee: number
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          base_fee?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          base_fee?: number
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_zones_backup: {
        Row: {
          area: Json | null
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          area?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          area?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      discount_code_usage: {
        Row: {
          customer_email: string
          discount_amount: number
          discount_code_id: string
          final_amount: number
          id: string
          ip_address: unknown | null
          order_id: string | null
          original_amount: number
          used_at: string
          user_agent: string | null
        }
        Insert: {
          customer_email: string
          discount_amount: number
          discount_code_id: string
          final_amount: number
          id?: string
          ip_address?: unknown | null
          order_id?: string | null
          original_amount: number
          used_at?: string
          user_agent?: string | null
        }
        Update: {
          customer_email?: string
          discount_amount?: number
          discount_code_id?: string
          final_amount?: number
          id?: string
          ip_address?: unknown | null
          order_id?: string | null
          original_amount?: number
          used_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_code_usage_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applicable_days: string[] | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          max_discount_amount: number | null
          min_order_amount: number | null
          name: string
          new_customers_only: boolean | null
          type: string
          updated_at: string
          usage_count: number | null
          usage_limit: number | null
          valid_from: string
          valid_until: string | null
          value: number
        }
        Insert: {
          applicable_days?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name: string
          new_customers_only?: boolean | null
          type: string
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value: number
        }
        Update: {
          applicable_days?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_discount_amount?: number | null
          min_order_amount?: number | null
          name?: string
          new_customers_only?: boolean | null
          type?: string
          updated_at?: string
          usage_count?: number | null
          usage_limit?: number | null
          valid_from?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      dispatch_analytics: {
        Row: {
          average_completion_time_minutes: number | null
          cancelled_assignments: number
          completed_assignments: number
          created_at: string
          customer_rating: number | null
          date: string
          earnings: number | null
          fuel_cost: number | null
          id: string
          rider_id: string
          total_assignments: number
          total_distance_km: number | null
          updated_at: string
        }
        Insert: {
          average_completion_time_minutes?: number | null
          cancelled_assignments?: number
          completed_assignments?: number
          created_at?: string
          customer_rating?: number | null
          date?: string
          earnings?: number | null
          fuel_cost?: number | null
          id?: string
          rider_id: string
          total_assignments?: number
          total_distance_km?: number | null
          updated_at?: string
        }
        Update: {
          average_completion_time_minutes?: number | null
          cancelled_assignments?: number
          completed_assignments?: number
          created_at?: string
          customer_rating?: number | null
          date?: string
          earnings?: number | null
          fuel_cost?: number | null
          id?: string
          rider_id?: string
          total_assignments?: number
          total_distance_km?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_analytics_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_delivery_analytics: {
        Row: {
          average_customer_rating: number | null
          created_at: string | null
          date: string
          deliveries_completed: number | null
          deliveries_failed: number | null
          delivery_fees_collected: number | null
          driver_id: string
          fuel_cost: number | null
          id: string
          total_delivery_time_minutes: number | null
          total_distance_km: number | null
          updated_at: string | null
        }
        Insert: {
          average_customer_rating?: number | null
          created_at?: string | null
          date: string
          deliveries_completed?: number | null
          deliveries_failed?: number | null
          delivery_fees_collected?: number | null
          driver_id: string
          fuel_cost?: number | null
          id?: string
          total_delivery_time_minutes?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Update: {
          average_customer_rating?: number | null
          created_at?: string | null
          date?: string
          deliveries_completed?: number | null
          deliveries_failed?: number | null
          delivery_fees_collected?: number | null
          driver_id?: string
          fuel_cost?: number | null
          id?: string
          total_delivery_time_minutes?: number | null
          total_distance_km?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_delivery_analytics_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          driver_data: Json
          email: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          driver_data?: Json
          email: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          driver_data?: Json
          email?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string | null
          status?: string
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
      driver_performance_analytics: {
        Row: {
          average_delivery_time_minutes: number
          created_at: string
          customer_ratings_average: number | null
          driver_id: string
          id: string
          orders_completed: number
          orders_failed: number
          total_customer_ratings: number
          total_delivery_fees: number
          total_distance_km: number
          updated_at: string
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          average_delivery_time_minutes?: number
          created_at?: string
          customer_ratings_average?: number | null
          driver_id: string
          id?: string
          orders_completed?: number
          orders_failed?: number
          total_customer_ratings?: number
          total_delivery_fees?: number
          total_distance_km?: number
          updated_at?: string
          week_end_date: string
          week_start_date: string
        }
        Update: {
          average_delivery_time_minutes?: number
          created_at?: string
          customer_ratings_average?: number | null
          driver_id?: string
          id?: string
          orders_completed?: number
          orders_failed?: number
          total_customer_ratings?: number
          total_delivery_fees?: number
          total_distance_km?: number
          updated_at?: string
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_performance_analytics_driver_id_fkey"
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
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_config: {
        Row: {
          automation_type: string
          conditions: Json | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          template_key: string
          trigger_delay_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          automation_type: string
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          template_key: string
          trigger_delay_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          automation_type?: string
          conditions?: Json | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          template_key?: string
          trigger_delay_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_automation_errors: {
        Row: {
          action_index: number
          created_at: string | null
          error_message: string
          flow_id: string
          id: string
          resolved_at: string | null
          retry_count: number | null
          trigger_data: Json
        }
        Insert: {
          action_index: number
          created_at?: string | null
          error_message: string
          flow_id: string
          id?: string
          resolved_at?: string | null
          retry_count?: number | null
          trigger_data?: Json
        }
        Update: {
          action_index?: number
          created_at?: string | null
          error_message?: string
          flow_id?: string
          id?: string
          resolved_at?: string | null
          retry_count?: number | null
          trigger_data?: Json
        }
        Relationships: []
      }
      email_automation_logs: {
        Row: {
          created_at: string | null
          flow_type: string
          id: string
          recipient_email: string
          sent_at: string | null
          status: string
          template_key: string
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          flow_type: string
          id?: string
          recipient_email: string
          sent_at?: string | null
          status?: string
          template_key: string
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          flow_type?: string
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          variables?: Json | null
        }
        Relationships: []
      }
      email_automation_queue: {
        Row: {
          action_index: number
          created_at: string | null
          error_message: string | null
          execute_at: string
          flow_id: string
          id: string
          processed_at: string | null
          retry_count: number | null
          status: string
          trigger_data: Json
          updated_at: string | null
        }
        Insert: {
          action_index?: number
          created_at?: string | null
          error_message?: string | null
          execute_at: string
          flow_id: string
          id?: string
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          trigger_data?: Json
          updated_at?: string | null
        }
        Update: {
          action_index?: number
          created_at?: string | null
          error_message?: string | null
          execute_at?: string
          flow_id?: string
          id?: string
          processed_at?: string | null
          retry_count?: number | null
          status?: string
          trigger_data?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      email_batch_logs: {
        Row: {
          failed: number
          id: string
          priority: string
          processed_at: string | null
          successful: number
          total_processed: number
        }
        Insert: {
          failed?: number
          id?: string
          priority: string
          processed_at?: string | null
          successful?: number
          total_processed?: number
        }
        Update: {
          failed?: number
          id?: string
          priority?: string
          processed_at?: string | null
          successful?: number
          total_processed?: number
        }
        Relationships: []
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
      email_dead_letter_queue: {
        Row: {
          final_error: string
          id: string
          moved_to_dlq_at: string | null
          original_communication_event_id: string
          recipient_email: string
          resolution_notes: string | null
          resolved_at: string | null
          template_key: string
          total_attempts: number
          variables: Json | null
        }
        Insert: {
          final_error: string
          id?: string
          moved_to_dlq_at?: string | null
          original_communication_event_id: string
          recipient_email: string
          resolution_notes?: string | null
          resolved_at?: string | null
          template_key: string
          total_attempts: number
          variables?: Json | null
        }
        Update: {
          final_error?: string
          id?: string
          moved_to_dlq_at?: string | null
          original_communication_event_id?: string
          recipient_email?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          template_key?: string
          total_attempts?: number
          variables?: Json | null
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
          is_active: boolean | null
          reason: string
          suppression_type: string | null
        }
        Insert: {
          created_at?: string | null
          email_address: string
          event_data?: Json | null
          id?: string
          is_active?: boolean | null
          reason: string
          suppression_type?: string | null
        }
        Update: {
          created_at?: string | null
          email_address?: string
          event_data?: Json | null
          id?: string
          is_active?: boolean | null
          reason?: string
          suppression_type?: string | null
        }
        Relationships: []
      }
      email_system_health_logs: {
        Row: {
          checked_at: string | null
          id: string
          queue_stats: Json
          stuck_emails_found: number | null
        }
        Insert: {
          checked_at?: string | null
          id?: string
          queue_stats?: Json
          stuck_emails_found?: number | null
        }
        Update: {
          checked_at?: string | null
          id?: string
          queue_stats?: Json
          stuck_emails_found?: number | null
        }
        Relationships: []
      }
      email_template_mapping: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          new_key: string
          old_key: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          new_key: string
          old_key: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          new_key?: string
          old_key?: string
        }
        Relationships: []
      }
      email_trigger_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          processed_at: string | null
          status: string
          trigger_data: Json
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          status?: string
          trigger_data?: Json
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          status?: string
          trigger_data?: Json
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
      enhanced_email_template_versions: {
        Row: {
          category: string | null
          change_note: string | null
          changed_at: string | null
          changed_by: string | null
          created_at: string | null
          full_html: boolean | null
          html_template: string | null
          id: string
          is_active: boolean | null
          style: string | null
          subject_template: string | null
          template_id: string
          template_key: string
          template_name: string
          template_type: string | null
          text_template: string | null
          variables: string[] | null
          version_number: number
        }
        Insert: {
          category?: string | null
          change_note?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          full_html?: boolean | null
          html_template?: string | null
          id?: string
          is_active?: boolean | null
          style?: string | null
          subject_template?: string | null
          template_id: string
          template_key: string
          template_name: string
          template_type?: string | null
          text_template?: string | null
          variables?: string[] | null
          version_number?: number
        }
        Update: {
          category?: string | null
          change_note?: string | null
          changed_at?: string | null
          changed_by?: string | null
          created_at?: string | null
          full_html?: boolean | null
          html_template?: string | null
          id?: string
          is_active?: boolean | null
          style?: string | null
          subject_template?: string | null
          template_id?: string
          template_key?: string
          template_name?: string
          template_type?: string | null
          text_template?: string | null
          variables?: string[] | null
          version_number?: number
        }
        Relationships: []
      }
      enhanced_email_templates: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          full_html: boolean | null
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
          full_html?: boolean | null
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
          full_html?: boolean | null
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
      header_banners: {
        Row: {
          background_color: string | null
          button_text: string | null
          button_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          display_priority: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          start_date: string | null
          text_color: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_color?: string | null
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_priority?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          text_color?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_color?: string | null
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_priority?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          text_color?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hero_carousel_images: {
        Row: {
          alt_text: string | null
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          updated_at?: string
          updated_by?: string | null
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
      moq_audit_log: {
        Row: {
          action_taken: string | null
          created_at: string | null
          customer_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          resolved_at: string | null
          violation_details: Json
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          resolved_at?: string | null
          violation_details: Json
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          resolved_at?: string | null
          violation_details?: Json
        }
        Relationships: [
          {
            foreignKeyName: "moq_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_log: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          delivery_report_status: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          order_id: string | null
          phone_number: string | null
          provider_response: Json | null
          recipient: string
          sent_at: string | null
          sms_cost: number | null
          sms_provider_message_id: string | null
          status: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_report_status?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          order_id?: string | null
          phone_number?: string | null
          provider_response?: Json | null
          recipient: string
          sent_at?: string | null
          sms_cost?: number | null
          sms_provider_message_id?: string | null
          status?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          delivery_report_status?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          order_id?: string | null
          phone_number?: string | null
          provider_response?: Json | null
          recipient?: string
          sent_at?: string | null
          sms_cost?: number | null
          sms_provider_message_id?: string | null
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
      order_access_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          order_id: string
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          order_id: string
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          order_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_access_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_assignments: {
        Row: {
          accepted_at: string | null
          actual_delivery_time: string | null
          assigned_at: string
          assigned_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          estimated_delivery_time: string | null
          id: string
          notes: string | null
          order_id: string
          rider_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id: string
          rider_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          rider_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_assignments_rider_id_fkey"
            columns: ["rider_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_assignments_archive: {
        Row: {
          accepted_at: string | null
          actual_delivery_time: string | null
          assigned_at: string
          assigned_by: string | null
          cancelled_at: string | null
          completed_at: string | null
          estimated_delivery_time: string | null
          id: string
          notes: string | null
          order_id: string
          rider_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id: string
          rider_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          actual_delivery_time?: string | null
          assigned_at?: string
          assigned_by?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          estimated_delivery_time?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          rider_id?: string
          status?: string
        }
        Relationships: []
      }
      order_audit: {
        Row: {
          action_type: string | null
          admin_id: string | null
          admin_name: string | null
          created_at: string | null
          id: string
          new_status: Database["public"]["Enums"]["order_status"] | null
          notes: string | null
          old_status: Database["public"]["Enums"]["order_status"] | null
          order_id: string
          system_source: string | null
        }
        Insert: {
          action_type?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id: string
          system_source?: string | null
        }
        Update: {
          action_type?: string | null
          admin_id?: string | null
          admin_name?: string | null
          created_at?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["order_status"] | null
          notes?: string | null
          old_status?: Database["public"]["Enums"]["order_status"] | null
          order_id?: string
          system_source?: string | null
        }
        Relationships: []
      }
      order_audit_log: {
        Row: {
          action: string
          changed_at: string | null
          changed_by: string | null
          id: string
          new_values: Json | null
          old_values: Json | null
          order_id: string | null
        }
        Insert: {
          action: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id?: string | null
        }
        Update: {
          action?: string
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delivery_schedule: {
        Row: {
          business_context: Json | null
          created_at: string
          delivery_date: string
          delivery_time_end: string
          delivery_time_start: string
          id: string
          is_flexible: boolean
          last_validated_at: string | null
          order_id: string
          requested_at: string
          special_instructions: string | null
          updated_at: string
          validation_status: string | null
        }
        Insert: {
          business_context?: Json | null
          created_at?: string
          delivery_date: string
          delivery_time_end: string
          delivery_time_start: string
          id?: string
          is_flexible?: boolean
          last_validated_at?: string | null
          order_id: string
          requested_at?: string
          special_instructions?: string | null
          updated_at?: string
          validation_status?: string | null
        }
        Update: {
          business_context?: Json | null
          created_at?: string
          delivery_date?: string
          delivery_time_end?: string
          delivery_time_start?: string
          id?: string
          is_flexible?: boolean
          last_validated_at?: string | null
          order_id?: string
          requested_at?: string
          special_instructions?: string | null
          updated_at?: string
          validation_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_delivery_schedule_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_price: number | null
          created_at: string | null
          customizations: Json | null
          discount_amount: number | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          special_instructions: string | null
          total_price: number
          unit_price: number
          updated_at: string | null
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          cost_price?: number | null
          created_at?: string | null
          customizations?: Json | null
          discount_amount?: number | null
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity?: number
          special_instructions?: string | null
          total_price: number
          unit_price: number
          updated_at?: string | null
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          cost_price?: number | null
          created_at?: string | null
          customizations?: Json | null
          discount_amount?: number | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          special_instructions?: string | null
          total_price?: number
          unit_price?: number
          updated_at?: string | null
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
      order_items_archive: {
        Row: {
          cost_price: number | null
          customizations: Json | null
          discount_amount: number | null
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
          discount_amount?: number | null
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
          discount_amount?: number | null
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
        Relationships: []
      }
      order_items_new: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_new_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_new"
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
      order_status_changes: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          old_status: string | null
          order_id: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_changes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_changes_archive: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          new_status: string
          old_status: string | null
          order_id: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status: string
          old_status?: string | null
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          new_status?: string
          old_status?: string | null
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      order_update_metrics: {
        Row: {
          admin_user_id: string | null
          cache_cleared: boolean | null
          cache_hit: boolean | null
          concurrent_admin_sessions: Json | null
          conflict_resolution_method: string | null
          correlation_id: string | null
          database_query_time_ms: number | null
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          id: number
          lock_acquired: boolean | null
          lock_wait_time_ms: number | null
          operation: string
          order_id: string | null
          retry_attempts: number | null
          status: string
          timestamp: string | null
          total_processing_time_ms: number | null
        }
        Insert: {
          admin_user_id?: string | null
          cache_cleared?: boolean | null
          cache_hit?: boolean | null
          concurrent_admin_sessions?: Json | null
          conflict_resolution_method?: string | null
          correlation_id?: string | null
          database_query_time_ms?: number | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          lock_acquired?: boolean | null
          lock_wait_time_ms?: number | null
          operation: string
          order_id?: string | null
          retry_attempts?: number | null
          status: string
          timestamp?: string | null
          total_processing_time_ms?: number | null
        }
        Update: {
          admin_user_id?: string | null
          cache_cleared?: boolean | null
          cache_hit?: boolean | null
          concurrent_admin_sessions?: Json | null
          conflict_resolution_method?: string | null
          correlation_id?: string | null
          database_query_time_ms?: number | null
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          id?: number
          lock_acquired?: boolean | null
          lock_wait_time_ms?: number | null
          operation?: string
          order_id?: string | null
          retry_attempts?: number | null
          status?: string
          timestamp?: string | null
          total_processing_time_ms?: number | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_notes: string | null
          amount_kobo: number | null
          assigned_rider_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_address: Json | null
          delivery_date: string | null
          delivery_fee: number | null
          delivery_status: string | null
          delivery_time: string | null
          delivery_time_slot_id: string | null
          delivery_zone_id: string | null
          discount_amount: number | null
          email: string | null
          estimated_delivery_date: string | null
          guest_session_id: string | null
          id: string
          idempotency_key: string | null
          items: Json
          last_modified_by: string | null
          order_number: string
          order_time: string
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_verified_at: string | null
          paystack_reference: string | null
          pickup_point_id: string | null
          pickup_ready: boolean | null
          pickup_time: string | null
          preferred_delivery_time: string | null
          processing_lock: boolean | null
          processing_officer_id: string | null
          processing_officer_name: string | null
          processing_started_at: string | null
          reference_updated_at: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          subtotal_cost: number | null
          tax_amount: number
          total_amount: number
          total_vat: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount_kobo?: number | null
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: Json | null
          delivery_date?: string | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          email?: string | null
          estimated_delivery_date?: string | null
          guest_session_id?: string | null
          id?: string
          idempotency_key?: string | null
          items?: Json
          last_modified_by?: string | null
          order_number: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          paystack_reference?: string | null
          pickup_point_id?: string | null
          pickup_ready?: boolean | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          processing_lock?: boolean | null
          processing_officer_id?: string | null
          processing_officer_name?: string | null
          processing_started_at?: string | null
          reference_updated_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount_kobo?: number | null
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: Json | null
          delivery_date?: string | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          email?: string | null
          estimated_delivery_date?: string | null
          guest_session_id?: string | null
          id?: string
          idempotency_key?: string | null
          items?: Json
          last_modified_by?: string | null
          order_number?: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          paystack_reference?: string | null
          pickup_point_id?: string | null
          pickup_ready?: boolean | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          processing_lock?: boolean | null
          processing_officer_id?: string | null
          processing_officer_name?: string | null
          processing_started_at?: string | null
          reference_updated_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_assigned_rider_id_fkey"
            columns: ["assigned_rider_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
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
      orders_archive: {
        Row: {
          assigned_rider_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_address: Json | null
          delivery_fee: number | null
          delivery_status: string | null
          delivery_time: string | null
          delivery_time_slot_id: string | null
          delivery_zone_id: string | null
          discount_amount: number | null
          estimated_delivery_date: string | null
          guest_session_id: string | null
          id: string
          order_number: string
          order_time: string
          order_type: Database["public"]["Enums"]["order_type"]
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          payment_verified_at: string | null
          paystack_reference: string | null
          pickup_point_id: string | null
          pickup_ready: boolean | null
          pickup_time: string | null
          preferred_delivery_time: string | null
          reference_updated_at: string | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          subtotal_cost: number | null
          tax_amount: number
          total_amount: number
          total_vat: number | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: Json | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          guest_session_id?: string | null
          id?: string
          order_number: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          paystack_reference?: string | null
          pickup_point_id?: string | null
          pickup_ready?: boolean | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          reference_updated_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_rider_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: Json | null
          delivery_fee?: number | null
          delivery_status?: string | null
          delivery_time?: string | null
          delivery_time_slot_id?: string | null
          delivery_zone_id?: string | null
          discount_amount?: number | null
          estimated_delivery_date?: string | null
          guest_session_id?: string | null
          id?: string
          order_number?: string
          order_time?: string
          order_type?: Database["public"]["Enums"]["order_type"]
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          payment_verified_at?: string | null
          paystack_reference?: string | null
          pickup_point_id?: string | null
          pickup_ready?: boolean | null
          pickup_time?: string | null
          preferred_delivery_time?: string | null
          reference_updated_at?: string | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          subtotal_cost?: number | null
          tax_amount?: number
          total_amount?: number
          total_vat?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      orders_new: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_address: Json | null
          id: string
          order_number: string
          order_type: Database["public"]["Enums"]["order_type"] | null
          payment_reference: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          special_instructions: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at: string | null
          updated_by: string | null
          updated_by_name: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_address?: Json | null
          id?: string
          order_number: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: Json | null
          id?: string
          order_number?: string
          order_type?: Database["public"]["Enums"]["order_type"] | null
          payment_reference?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          special_instructions?: string | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          updated_at?: string | null
          updated_by?: string | null
          updated_by_name?: string | null
          version?: number | null
        }
        Relationships: []
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
      payment_intents: {
        Row: {
          amount: number
          client_secret: string | null
          created_at: string | null
          currency: string
          expires_at: string | null
          id: string
          metadata: Json | null
          order_id: string
          provider: string
          reference: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          client_secret?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          order_id: string
          provider?: string
          reference: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          client_secret?: string | null
          created_at?: string | null
          currency?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string
          provider?: string
          reference?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_email: string | null
          id: number
          log_data: Json | null
          order_id: string | null
          processed_at: string | null
          reference: string
          status: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          id?: number
          log_data?: Json | null
          order_id?: string | null
          processed_at?: string | null
          reference: string
          status?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_email?: string | null
          id?: number
          log_data?: Json | null
          order_id?: string | null
          processed_at?: string | null
          reference?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_polling_state: {
        Row: {
          created_at: string
          id: string
          last_polled: string | null
          reference: string
          retry_count: number
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_polled?: string | null
          reference: string
          retry_count?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_polled?: string | null
          reference?: string
          retry_count?: number
          start_time?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_processing_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          fulfillment_type: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          payment_reference: string | null
          processing_stage: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          fulfillment_type?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_processing_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_processing_status: {
        Row: {
          created_at: string | null
          current_order_status:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message: string | null
          id: string
          order_id: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          overall_status: string | null
          payment_reference: string | null
          processing_stage: string | null
          reference_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          overall_status?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          overall_status?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_processing_status_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_processing_status_archive: {
        Row: {
          created_at: string | null
          current_order_status:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message: string | null
          id: string
          order_id: string | null
          order_number: string | null
          order_type: Database["public"]["Enums"]["order_type"] | null
          overall_status: string | null
          payment_reference: string | null
          processing_stage: string | null
          reference_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          overall_status?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_order_status?:
            | Database["public"]["Enums"]["order_status"]
            | null
          error_message?: string | null
          id?: string
          order_id?: string | null
          order_number?: string | null
          order_type?: Database["public"]["Enums"]["order_type"] | null
          overall_status?: string | null
          payment_reference?: string | null
          processing_stage?: string | null
          reference_type?: string | null
          updated_at?: string | null
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
          access_code: string | null
          account_name: string | null
          amount: number
          amount_kobo: number | null
          authorization_code: string | null
          authorization_url: string | null
          bank: string | null
          card_type: string | null
          channel: string | null
          created_at: string | null
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          exp_month: string | null
          exp_year: string | null
          fees: number | null
          gateway_response: string | null
          id: string
          idempotency_key: string | null
          last_webhook_at: string | null
          last4: string | null
          metadata: Json | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          processed_at: string | null
          processing_lock: boolean | null
          provider: string
          provider_reference: string | null
          provider_response: Json | null
          provider_transaction_id: string | null
          raw_provider_payload: Json | null
          reference: string | null
          status: string
          transaction_type: string
          updated_at: string | null
          verified_at: string | null
          webhook_event_id: string | null
        }
        Insert: {
          access_code?: string | null
          account_name?: string | null
          amount: number
          amount_kobo?: number | null
          authorization_code?: string | null
          authorization_url?: string | null
          bank?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          idempotency_key?: string | null
          last_webhook_at?: string | null
          last4?: string | null
          metadata?: Json | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          processed_at?: string | null
          processing_lock?: boolean | null
          provider?: string
          provider_reference?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          raw_provider_payload?: Json | null
          reference?: string | null
          status: string
          transaction_type?: string
          updated_at?: string | null
          verified_at?: string | null
          webhook_event_id?: string | null
        }
        Update: {
          access_code?: string | null
          account_name?: string | null
          amount?: number
          amount_kobo?: number | null
          authorization_code?: string | null
          authorization_url?: string | null
          bank?: string | null
          card_type?: string | null
          channel?: string | null
          created_at?: string | null
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          idempotency_key?: string | null
          last_webhook_at?: string | null
          last4?: string | null
          metadata?: Json | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          processed_at?: string | null
          processing_lock?: boolean | null
          provider?: string
          provider_reference?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          raw_provider_payload?: Json | null
          reference?: string | null
          status?: string
          transaction_type?: string
          updated_at?: string | null
          verified_at?: string | null
          webhook_event_id?: string | null
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
      payment_transactions_archive: {
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
          customer_name: string | null
          customer_phone: string | null
          exp_month: string | null
          exp_year: string | null
          fees: number | null
          gateway_response: string | null
          id: string
          last4: string | null
          metadata: Json | null
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
          customer_name?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          last4?: string | null
          metadata?: Json | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          processed_at?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_transaction_id?: string | null
          status: string
          transaction_type?: string
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
          customer_name?: string | null
          customer_phone?: string | null
          exp_month?: string | null
          exp_year?: string | null
          fees?: number | null
          gateway_response?: string | null
          id?: string
          last4?: string | null
          metadata?: Json | null
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
        Relationships: []
      }
      payment_verification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown | null
          reference: string
          response_time_ms: number | null
          success: boolean | null
          user_agent: string | null
          user_id: string | null
          verification_attempt: number | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          reference: string
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
          verification_attempt?: number | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          reference?: string
          response_time_ms?: number | null
          success?: boolean | null
          user_agent?: string | null
          user_id?: string | null
          verification_attempt?: number | null
        }
        Relationships: []
      }
      paystack_secure_config: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          live_public_key: string | null
          live_secret_key: string | null
          test_mode: boolean
          test_public_key: string | null
          test_secret_key: string | null
          updated_at: string
          updated_by: string | null
          webhook_secret: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          live_public_key?: string | null
          live_secret_key?: string | null
          test_mode?: boolean
          test_public_key?: string | null
          test_secret_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          live_public_key?: string | null
          live_secret_key?: string | null
          test_mode?: boolean
          test_public_key?: string | null
          test_secret_key?: string | null
          updated_at?: string
          updated_by?: string | null
          webhook_secret?: string | null
        }
        Relationships: []
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
      permission_change_rate_limit: {
        Row: {
          changes_count: number | null
          created_at: string | null
          id: string
          target_user_id: string
          user_id: string
          window_start: string | null
        }
        Insert: {
          changes_count?: number | null
          created_at?: string | null
          id?: string
          target_user_id: string
          user_id: string
          window_start?: string | null
        }
        Update: {
          changes_count?: number | null
          created_at?: string | null
          id?: string
          target_user_id?: string
          user_id?: string
          window_start?: string | null
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
      production_config: {
        Row: {
          allowed_origins: string[] | null
          created_at: string
          environment: string
          id: string
          is_live_mode: boolean | null
          monitoring_enabled: boolean | null
          rate_limits: Json | null
          security_config: Json | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          allowed_origins?: string[] | null
          created_at?: string
          environment?: string
          id?: string
          is_live_mode?: boolean | null
          monitoring_enabled?: boolean | null
          rate_limits?: Json | null
          security_config?: Json | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          allowed_origins?: string[] | null
          created_at?: string
          environment?: string
          id?: string
          is_live_mode?: boolean | null
          monitoring_enabled?: boolean | null
          rate_limits?: Json | null
          security_config?: Json | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      production_health_metrics: {
        Row: {
          created_at: string | null
          dimensions: Json | null
          environment: string
          id: string
          metric_name: string
          metric_type: string
          metric_value: number
          timestamp: string | null
        }
        Insert: {
          created_at?: string | null
          dimensions?: Json | null
          environment?: string
          id?: string
          metric_name: string
          metric_type?: string
          metric_value: number
          timestamp?: string | null
        }
        Update: {
          created_at?: string | null
          dimensions?: Json | null
          environment?: string
          id?: string
          metric_name?: string
          metric_type?: string
          metric_value?: number
          timestamp?: string | null
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
      production_readiness_status: {
        Row: {
          created_at: string
          environment: string
          id: string
          is_production_ready: boolean
          issues: string[] | null
          last_updated: string
          overall_status: string
          readiness_score: number
          warnings: string[] | null
        }
        Insert: {
          created_at?: string
          environment?: string
          id?: string
          is_production_ready?: boolean
          issues?: string[] | null
          last_updated?: string
          overall_status?: string
          readiness_score?: number
          warnings?: string[] | null
        }
        Update: {
          created_at?: string
          environment?: string
          id?: string
          is_production_ready?: boolean
          issues?: string[] | null
          last_updated?: string
          overall_status?: string
          readiness_score?: number
          warnings?: string[] | null
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
          minimum_order_quantity: number
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
          minimum_order_quantity?: number
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
          minimum_order_quantity?: number
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
          created_with_temp_password: boolean | null
          email: string | null
          first_login_at: string | null
          id: string
          is_active: boolean
          must_change_password: boolean | null
          name: string | null
          password_changed_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_with_temp_password?: boolean | null
          email?: string | null
          first_login_at?: string | null
          id: string
          is_active?: boolean
          must_change_password?: boolean | null
          name?: string | null
          password_changed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_with_temp_password?: boolean | null
          email?: string | null
          first_login_at?: string | null
          id?: string
          is_active?: boolean
          must_change_password?: boolean | null
          name?: string | null
          password_changed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
          username?: string | null
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
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          min_order_amount: number | null
          name: string
          status: Database["public"]["Enums"]["promotion_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at: string
          valid_from: string
          valid_until: string | null
          value: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_order_amount?: number | null
          name: string
          status?: Database["public"]["Enums"]["promotion_status"]
          type: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          min_order_amount?: number | null
          name?: string
          status?: Database["public"]["Enums"]["promotion_status"]
          type?: Database["public"]["Enums"]["promotion_type"]
          updated_at?: string
          valid_from?: string
          valid_until?: string | null
          value?: number | null
        }
        Relationships: []
      }
      public_holidays: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
          provider?: string
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
      security_rate_limits: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          id: string
          operation_type: string
          user_id: string | null
          window_start: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          operation_type: string
          user_id?: string | null
          window_start?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          id?: string
          operation_type?: string
          user_id?: string | null
          window_start?: string | null
        }
        Relationships: []
      }
      security_violations: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          resolved_at: string | null
          user_id: string | null
          violation_type: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          user_id?: string | null
          violation_type: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          user_id?: string | null
          violation_type?: string
        }
        Relationships: []
      }
      sms_configuration: {
        Row: {
          balance_threshold: number | null
          cost_per_sms: number | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          provider: string | null
          rate_limit_per_minute: number | null
          sender_id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          balance_threshold?: number | null
          cost_per_sms?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string | null
          rate_limit_per_minute?: number | null
          sender_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          balance_threshold?: number | null
          cost_per_sms?: number | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          provider?: string | null
          rate_limit_per_minute?: number | null
          sender_id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sms_delivery_logs: {
        Row: {
          communication_event_id: string | null
          cost: number | null
          created_at: string
          delivery_time: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message_content: string
          provider_response: Json | null
          recipient_phone: string
          retry_count: number | null
          sender: string
          status: Database["public"]["Enums"]["sms_delivery_status"]
          updated_at: string
        }
        Insert: {
          communication_event_id?: string | null
          cost?: number | null
          created_at?: string
          delivery_time?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_content: string
          provider_response?: Json | null
          recipient_phone: string
          retry_count?: number | null
          sender: string
          status?: Database["public"]["Enums"]["sms_delivery_status"]
          updated_at?: string
        }
        Update: {
          communication_event_id?: string | null
          cost?: number | null
          created_at?: string
          delivery_time?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_content?: string
          provider_response?: Json | null
          recipient_phone?: string
          retry_count?: number | null
          sender?: string
          status?: Database["public"]["Enums"]["sms_delivery_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_delivery_logs_communication_event_id_fkey"
            columns: ["communication_event_id"]
            isOneToOne: false
            referencedRelation: "communication_events"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_provider_settings: {
        Row: {
          api_password: string | null
          api_url: string | null
          api_username: string | null
          created_at: string | null
          default_sender: string | null
          id: string
          is_active: boolean | null
          provider_name: string
          updated_at: string | null
        }
        Insert: {
          api_password?: string | null
          api_url?: string | null
          api_username?: string | null
          created_at?: string | null
          default_sender?: string | null
          id?: string
          is_active?: boolean | null
          provider_name: string
          updated_at?: string | null
        }
        Update: {
          api_password?: string | null
          api_url?: string | null
          api_username?: string | null
          created_at?: string | null
          default_sender?: string | null
          id?: string
          is_active?: boolean | null
          provider_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_suppression_list: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          notes: string | null
          phone_number: string
          reason: string | null
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          notes?: string | null
          phone_number: string
          reason?: string | null
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          notes?: string | null
          phone_number?: string
          reason?: string | null
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          max_length: number | null
          template_key: string
          template_name: string
          updated_at: string | null
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_length?: number | null
          template_key: string
          template_name: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          max_length?: number | null
          template_key?: string
          template_name?: string
          updated_at?: string | null
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      sms_wallet_balance: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          last_checked: string
          low_balance_threshold: number | null
          provider_name: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_checked?: string
          low_balance_threshold?: number | null
          provider_name?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          last_checked?: string
          low_balance_threshold?: number | null
          provider_name?: string
          updated_at?: string
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
          email_id: string | null
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          provider: string
          recipient_email: string
          sender_email: string | null
          smtp_response: string | null
          subject: string | null
          template_key: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          delivery_timestamp?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string
          recipient_email: string
          sender_email?: string | null
          smtp_response?: string | null
          subject?: string | null
          template_key?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          delivery_timestamp?: string | null
          email_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          provider?: string
          recipient_email?: string
          sender_email?: string | null
          smtp_response?: string | null
          subject?: string | null
          template_key?: string | null
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
      system_health_checks: {
        Row: {
          created_at: string
          details: Json | null
          id: string
          service: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: string
          service: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: string
          service?: string
          status?: string
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
      user_favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          menu_section: Database["public"]["Enums"]["menu_section"] | null
          permission_level: Database["public"]["Enums"]["permission_level"]
          sub_menu_section: string | null
          user_id: string
        }
        Insert: {
          id?: string
          menu_key: string
          menu_section?: Database["public"]["Enums"]["menu_section"] | null
          permission_level?: Database["public"]["Enums"]["permission_level"]
          sub_menu_section?: string | null
          user_id: string
        }
        Update: {
          id?: string
          menu_key?: string
          menu_section?: Database["public"]["Enums"]["menu_section"] | null
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
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      webhook_deliveries: {
        Row: {
          alert_type: string
          created_at: string | null
          delivery_attempts: number | null
          id: string
          last_attempt_at: string | null
          payload: Json
          response_body: string | null
          response_code: number | null
          status: string | null
          throttled_until: string | null
          webhook_url: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          delivery_attempts?: number | null
          id?: string
          last_attempt_at?: string | null
          payload: Json
          response_body?: string | null
          response_code?: number | null
          status?: string | null
          throttled_until?: string | null
          webhook_url: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          delivery_attempts?: number | null
          id?: string
          last_attempt_at?: string | null
          payload?: Json
          response_body?: string | null
          response_code?: number | null
          status?: string | null
          throttled_until?: string | null
          webhook_url?: string
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
      website_menu: {
        Row: {
          created_at: string
          created_by: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          label: string
          menu_key: string
          parent_id: string | null
          sort_order: number | null
          target: string | null
          updated_at: string
          updated_by: string | null
          url: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label: string
          menu_key: string
          parent_id?: string | null
          sort_order?: number | null
          target?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          label?: string
          menu_key?: string
          parent_id?: string | null
          sort_order?: number | null
          target?: string | null
          updated_at?: string
          updated_by?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_menu_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "website_menu"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_consolidation_map: {
        Row: {
          consolidation_reason: string | null
          created_at: string | null
          new_zone_id: string | null
          old_zone_id: string | null
          zone_name: string | null
        }
        Insert: {
          consolidation_reason?: string | null
          created_at?: string | null
          new_zone_id?: string | null
          old_zone_id?: string | null
          zone_name?: string | null
        }
        Update: {
          consolidation_reason?: string | null
          created_at?: string | null
          new_zone_id?: string | null
          old_zone_id?: string | null
          zone_name?: string | null
        }
        Relationships: []
      }
      zone_delivery_analytics: {
        Row: {
          average_delivery_time_minutes: number | null
          created_at: string | null
          date: string
          id: string
          successful_deliveries: number | null
          total_deliveries: number | null
          total_delivery_fees: number | null
          updated_at: string | null
          zone_id: string
        }
        Insert: {
          average_delivery_time_minutes?: number | null
          created_at?: string | null
          date: string
          id?: string
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_delivery_fees?: number | null
          updated_at?: string | null
          zone_id: string
        }
        Update: {
          average_delivery_time_minutes?: number | null
          created_at?: string | null
          date?: string
          id?: string
          successful_deliveries?: number | null
          total_deliveries?: number | null
          total_delivery_fees?: number | null
          updated_at?: string | null
          zone_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      communication_events_health: {
        Row: {
          avg_retry_count: number | null
          collision_events: number | null
          failed_events: number | null
          hour: string | null
          total_events: number | null
          unique_sessions: number | null
        }
        Relationships: []
      }
      conflict_resolution_metrics: {
        Row: {
          avg_duration_ms: number | null
          avg_lock_wait_ms: number | null
          avg_retry_attempts: number | null
          conflict_count: number | null
          conflict_rate_percent: number | null
          error_count: number | null
          error_rate_percent: number | null
          minute: string | null
          success_count: number | null
          total_operations: number | null
        }
        Relationships: []
      }
      email_queue_health: {
        Row: {
          failed_count: number | null
          last_email_sent: string | null
          oldest_queued_email: string | null
          queued_count: number | null
          sent_count: number | null
          stuck_emails: number | null
        }
        Relationships: []
      }
      payment_success_metrics: {
        Row: {
          failed_payments: number | null
          hour: string | null
          success_rate_percent: number | null
          successful_payments: number | null
          total_payments: number | null
        }
        Relationships: []
      }
      security_monitor_view: {
        Row: {
          action: string | null
          category: string | null
          entity_id: string | null
          event_time: string | null
          id: string | null
          message: string | null
          new_values: Json | null
          risk_level: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          category?: string | null
          entity_id?: string | null
          event_time?: string | null
          id?: string | null
          message?: string | null
          new_values?: Json | null
          risk_level?: never
          user_id?: string | null
        }
        Update: {
          action?: string | null
          category?: string | null
          entity_id?: string | null
          event_time?: string | null
          id?: string | null
          message?: string | null
          new_values?: Json | null
          risk_level?: never
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_order_lock: {
        Args:
          | {
              p_admin_session_id: string
              p_order_id: string
              p_timeout_seconds?: number
            }
          | {
              p_admin_user_id: string
              p_order_id: string
              p_timeout_seconds?: number
            }
        Returns: boolean
      }
      acquire_order_lock_enhanced: {
        Args: {
          p_admin_user_id: string
          p_allow_renewal?: boolean
          p_order_id: string
          p_timeout_seconds?: number
        }
        Returns: boolean
      }
      activate_admin_user: {
        Args: { p_user_id: string }
        Returns: Json
      }
      adjust_quantities_for_moq: {
        Args: { order_items: Json }
        Returns: Json
      }
      admin_queue_order_email: {
        Args: { p_order_id: string; p_status: string }
        Returns: undefined
      }
      admin_queue_order_email_enhanced: {
        Args: { p_order_id: string; p_status: string }
        Returns: Json
      }
      admin_safe_update_order_status: {
        Args: { p_admin_id?: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      admin_safe_update_order_status_enhanced: {
        Args: { p_admin_id?: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      admin_safe_update_order_status_with_officer_tracking: {
        Args: { p_admin_id?: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      admin_update_order_status_bulletproof: {
        Args: { p_admin_id: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      admin_update_order_status_lock_first: {
        Args: {
          p_admin_user_id?: string
          p_new_status: string
          p_notes?: string
          p_order_id: string
        }
        Returns: {
          conflict_info: Json
          message: string
          order_data: Json
          success: boolean
        }[]
      }
      admin_update_order_status_production: {
        Args: { p_admin_id: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      admin_update_order_status_secure: {
        Args: { p_admin_id?: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      archive_old_communication_events: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      archive_stale_communication_events: {
        Args: { p_age_hours?: number }
        Returns: Json
      }
      assess_production_readiness: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      assign_driver_to_order: {
        Args: {
          p_driver_id: string
          p_estimated_delivery_time?: string
          p_order_id: string
        }
        Returns: Json
      }
      assign_rider_to_order: {
        Args: { p_assigned_by?: string; p_order_id: string; p_rider_id: string }
        Returns: string
      }
      audit_function_security: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      bulk_safe_delete_products: {
        Args: { product_ids: string[] }
        Returns: Json
      }
      bulk_update_payment_status_to_success: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cache_idempotent_request: {
        Args: {
          p_idempotency_key: string
          p_request_data: Json
          p_response_data?: Json
          p_status?: string
        }
        Returns: Json
      }
      cache_idempotent_request_enhanced: {
        Args:
          | {
              p_admin_id?: string
              p_bypass_cache?: boolean
              p_idempotency_key: string
              p_order_id?: string
              p_request_data: Json
              p_response_data?: Json
              p_status?: string
            }
          | {
              p_admin_user_id?: string
              p_idempotency_key: string
              p_order_id?: string
              p_request_data: Json
              p_response_data?: Json
              p_status?: string
            }
          | {
              p_admin_user_id?: string
              p_idempotency_key: string
              p_order_id?: string
              p_request_data: Json
              p_response_data?: Json
              p_status?: string
              p_timeout_seconds?: number
            }
        Returns: Json
      }
      cache_idempotent_request_lock_first: {
        Args: {
          p_admin_user_id?: string
          p_idempotency_key: string
          p_order_id?: string
          p_request_data: Json
          p_response_data?: Json
          p_status?: string
        }
        Returns: Json
      }
      calculate_bogo_discount: {
        Args: { p_cart_items: Json; p_promotion_id: string }
        Returns: Json
      }
      calculate_brand_consistency_score: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      calculate_daily_delivery_analytics: {
        Args: { target_date?: string }
        Returns: undefined
      }
      calculate_daily_email_metrics: {
        Args: Record<PropertyKey, never> | { target_date?: string }
        Returns: undefined
      }
      calculate_delivery_metrics: {
        Args: { p_date: string }
        Returns: undefined
      }
      calculate_driver_weekly_performance: {
        Args: { p_driver_id: string; p_week_start: string }
        Returns: {
          avg_delivery_time: number
          avg_rating: number
          orders_completed: number
          orders_failed: number
          total_fees: number
        }[]
      }
      calculate_moq_pricing_impact: {
        Args: { order_items: Json }
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
      can_create_admin_users: {
        Args: { _user_id: string }
        Returns: boolean
      }
      can_send_email_to: {
        Args: { email_address: string; email_type?: string }
        Returns: boolean
      }
      check_admin_creation_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_admin_invitation_rate_limit: {
        Args: { user_id_param: string }
        Returns: boolean
      }
      check_admin_rate_limit: {
        Args: {
          p_admin_id: string
          p_limit?: number
          p_operation: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_alert_rules: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_api_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_auth_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_customer_operation_rate_limit: {
        Args: { p_admin_id: string; p_limit?: number; p_operation: string }
        Returns: boolean
      }
      check_customer_rate_limit: {
        Args: {
          p_customer_id?: string
          p_endpoint?: string
          p_ip_address?: unknown
          p_tier?: string
        }
        Returns: boolean
      }
      check_customer_rate_limit_secure: {
        Args: {
          p_customer_id: string
          p_endpoint: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_email_rate_limit: {
        Args:
          | { email_address: string; time_window_minutes?: number }
          | { p_email_type?: string; p_identifier: string }
          | {
              p_max_emails?: number
              p_recipient_email: string
              p_window_minutes?: number
            }
        Returns: Json
      }
      check_enhanced_rate_limit: {
        Args: {
          p_ip_address?: string
          p_limit_per_hour?: number
          p_limit_per_minute?: number
          p_operation_type?: string
          p_user_id?: string
        }
        Returns: boolean
      }
      check_otp_rate_limit: {
        Args: { p_email: string } | { p_email: string; p_ip_address?: unknown }
        Returns: Json
      }
      check_otp_rate_limit_secure: {
        Args: { p_email: string }
        Returns: Json
      }
      check_payment_flow_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_payment_rate_limit: {
        Args: { p_operation: string; p_user_id: string }
        Returns: Json
      }
      check_payment_security_health: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_payment_system_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          description: string
          metric: string
          value: number
        }[]
      }
      check_paystack_production_readiness: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_permission_change_rate_limit: {
        Args:
          | { max_changes_per_hour?: number; target_user_id: string }
          | {
              p_max_changes?: number
              p_target_user_id: string
              p_window_minutes?: number
            }
        Returns: Json
      }
      check_production_payment_safety: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_production_readiness: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_production_security: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      check_production_security_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_promotion_code_rate_limit: {
        Args: {
          p_block_minutes?: number
          p_identifier: string
          p_max_attempts?: number
          p_window_hours?: number
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_identifier: string
          p_limit_type?: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_rate_limit_secure: {
        Args: {
          p_identifier: string
          p_limit_type: string
          p_max_requests: number
          p_window_minutes: number
        }
        Returns: Json
      }
      check_rate_limit_with_reputation: {
        Args: { p_identifier: string; p_identifier_type?: string }
        Returns: Json
      }
      check_registration_rate_limit_secure: {
        Args: { p_email: string; p_ip_address?: unknown }
        Returns: Json
      }
      check_rls_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_secure_api_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      check_upload_rate_limit: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_user_permission: {
        Args: {
          menu_key_param: string
          required_level_param?: string
          user_id_param: string
        }
        Returns: boolean
      }
      clean_expired_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_cache_batch_optimized: {
        Args: {
          p_batch_size?: number
          p_cleanup_type?: string
          p_minutes_threshold?: number
          p_order_ids?: string[]
        }
        Returns: Json
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
      cleanup_expired_locks: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_otp_codes: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_otps: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_expired_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_locks_optimized: {
        Args: { p_force_cleanup_older_than_minutes?: number }
        Returns: Json
      }
      cleanup_monitoring_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_communication_events: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_email_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_email_logs: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_guest_sessions: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_health_checks: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_order_locks: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_promotion_rate_limits: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_stuck_emails: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_stuck_request_cache: {
        Args: Record<PropertyKey, never> | { p_minutes_threshold?: number }
        Returns: Json
      }
      clear_production_data: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      confirm_payment_atomic: {
        Args: {
          p_amount: number
          p_confirmed_at: string
          p_paystack_data: Json
          p_reference: string
        }
        Returns: Json
      }
      convert_guest_cart_to_customer: {
        Args: { p_customer_id: string; p_guest_session_id: string }
        Returns: Json
      }
      create_admin_session: {
        Args: {
          p_ip_address?: unknown
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      create_admin_user_with_profile: {
        Args: {
          p_assigned_by: string
          p_email: string
          p_expires_at?: string
          p_name: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: Json
      }
      create_communication_event: {
        Args: {
          p_channel: string
          p_dedupe_key: string
          p_event_type: string
          p_order_id: string
          p_payload?: Json
          p_recipient_email: string
          p_sms_phone: string
          p_status?: string
          p_template_key: string
        }
        Returns: undefined
      }
      create_customer_account_secure: {
        Args: {
          p_email: string
          p_name: string
          p_password_hash?: string
          p_phone?: string
        }
        Returns: Json
      }
      create_customer_record: {
        Args: {
          p_email: string
          p_name: string
          p_phone?: string
          p_user_id?: string
        }
        Returns: string
      }
      create_customer_with_validation: {
        Args: {
          p_admin_id?: string
          p_email: string
          p_ip_address?: unknown
          p_name: string
          p_phone?: string
          p_send_welcome_email?: boolean
          p_user_agent?: string
        }
        Returns: Json
      }
      create_driver_with_profile: {
        Args: {
          p_create_profile?: boolean
          p_driver_data: Json
          p_send_invitation?: boolean
        }
        Returns: Json
      }
      create_logo_version: {
        Args: {
          p_dimensions: Json
          p_file_size: number
          p_file_type: string
          p_logo_url: string
          p_uploaded_by: string
        }
        Returns: string
      }
      create_missing_customer_account: {
        Args: { p_user_id: string }
        Returns: Json
      }
      create_order_with_items: {
        Args: {
          p_customer_id: string
          p_delivery_address?: Json
          p_delivery_zone_id?: string
          p_fulfillment_type: string
          p_guest_session_id?: string
          p_items?: Json
          p_pickup_point_id?: string
        }
        Returns: string
      }
      create_payment_intent: {
        Args: { p_amount: number; p_currency?: string; p_order_id: string }
        Returns: Json
      }
      current_user_email: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      customer_can_view_order: {
        Args: { order_row: Database["public"]["Tables"]["orders"]["Row"] }
        Returns: boolean
      }
      customer_purchased_product: {
        Args: { customer_uuid: string; product_uuid: string }
        Returns: boolean
      }
      deactivate_admin_user: {
        Args: { p_user_id: string }
        Returns: Json
      }
      debug_payment_transaction_insert: {
        Args: {
          p_amount: number
          p_currency?: string
          p_customer_email: string
          p_order_id: string
          p_payment_method?: string
          p_status?: string
          p_transaction_type?: string
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
          communication_events_count: number
          email: string
          has_auth_user: boolean
          has_customer_account: boolean
          has_customer_record: boolean
          issue_type: string
        }[]
      }
      diagnose_registration_issues: {
        Args: { p_email: string }
        Returns: Json
      }
      emergency_backfill_broken_orders: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      emergency_safe_order_update: {
        Args: { p_admin_id?: string; p_order_id: string; p_status: string }
        Returns: Json
      }
      enhanced_security_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      execute_go_live: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      execute_go_live_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      execute_production_go_live: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      find_or_create_customer: {
        Args: {
          p_email: string
          p_is_guest?: boolean
          p_name: string
          p_phone?: string
        }
        Returns: {
          customer_id: string
          is_new: boolean
        }[]
      }
      fix_user_linking: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      force_clear_order_cache: {
        Args: { p_order_id: string }
        Returns: Json
      }
      generate_atomic_dedupe_key: {
        Args: {
          p_event_type: string
          p_order_id: string
          p_recipient_email: string
          p_template_key: string
        }
        Returns: string
      }
      generate_dedupe_key: {
        Args: {
          p_event_type: string
          p_order_id: string
          p_recipient_email: string
          p_template_key: string
        }
        Returns: string
      }
      generate_dedupe_key_safe: {
        Args: {
          p_event_type: string
          p_order_id: string
          p_recipient_identifier: string
          p_template_key: string
        }
        Returns: string
      }
      generate_guest_session_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_access_token: {
        Args: { p_order_id: string }
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_payment_idempotency_key: {
        Args: { p_prefix?: string }
        Returns: string
      }
      generate_payment_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_safe_dedupe_key: {
        Args: {
          p_event_type: string
          p_order_id?: string
          p_recipient_email: string
          p_template_key?: string
        }
        Returns: string
      }
      generate_secure_payment_reference: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_active_email_provider: {
        Args: Record<PropertyKey, never>
        Returns: {
          health_score: number
          is_active: boolean
          provider_name: string
        }[]
      }
      get_active_paystack_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          environment: string
          public_key: string
          secret_key: string
          test_mode: boolean
          webhook_secret: string
        }[]
      }
      get_admin_business_info: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_invitation_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          accepted_invitations: number
          expired_invitations: number
          pending_invitations: number
          success_rate: number
          total_invitations: number
        }[]
      }
      get_admin_payment_status: {
        Args: {
          p_limit?: number
          p_order_id?: string
          p_payment_reference?: string
        }
        Returns: {
          created_at: string
          error_message: string
          order_id: string
          order_number: string
          order_type: string
          overall_status: string
          payment_reference: string
          processing_stage: string
          reference_type: string
        }[]
      }
      get_admin_payment_status_secure: {
        Args: {
          p_limit?: number
          p_order_id?: string
          p_overall_status?: string
          p_payment_reference?: string
        }
        Returns: {
          created_at: string
          current_order_status: string
          error_message: string
          order_id: string
          order_number: string
          order_type: string
          overall_status: string
          payment_reference: string
          processing_stage: string
          reference_type: string
          updated_at: string
        }[]
      }
      get_admin_users_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      get_all_customers_display: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          email: string
          id: string
          isGuest: boolean
          lastOrderDate: string
          name: string
          phone: string
          status: string
          totalOrders: number
          totalSpent: number
        }[]
      }
      get_all_customers_for_analytics: {
        Args: Record<PropertyKey, never>
        Returns: {
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          is_registered: boolean
          registration_date: string
        }[]
      }
      get_analytics_dashboard: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_available_delivery_slots: {
        Args: Record<PropertyKey, never>
        Returns: {
          available_spots: number
          current_bookings: number
          date: string
          end_time: string
          is_available: boolean
          max_capacity: number
          slot_id: string
          start_time: string
        }[]
      }
      get_best_smtp_provider: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_business_branding: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_comprehensive_order_details: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_comprehensive_order_fulfillment: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_comprehensive_order_fulfillment_simple: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_current_logo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_customer_analytics_safe: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: Json
      }
      get_customer_payment_status: {
        Args: { p_order_id: string }
        Returns: {
          error_message: string
          order_id: string
          order_number: string
          overall_status: string
          payment_reference: string
          processing_stage: string
        }[]
      }
      get_customer_payment_status_secure: {
        Args: { p_order_id: string }
        Returns: {
          error_message: string
          last_updated: string
          order_id: string
          order_number: string
          overall_status: string
          payment_reference: string
          processing_stage: string
        }[]
      }
      get_daily_revenue_report: {
        Args: { p_end_date: string; p_start_date: string }
        Returns: {
          avg_order_value: number
          date: string
          total_orders: number
          total_revenue: number
        }[]
      }
      get_dashboard_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_customers: number
          total_orders: number
          total_products: number
          total_revenue: number
        }[]
      }
      get_delivery_reports: {
        Args: { end_date?: string; start_date?: string }
        Returns: Json
      }
      get_detailed_order_with_products: {
        Args: { p_order_id: string }
        Returns: Json
      }
      get_driver_orders_detail: {
        Args: { p_driver_id: string; p_end_date: string; p_start_date: string }
        Returns: {
          customer_name: string
          delivery_address: Json
          delivery_fee: number
          order_date: string
          order_id: string
          order_number: string
          status: string
          total_amount: number
        }[]
      }
      get_driver_revenue_report: {
        Args: { p_end_date: string; p_interval?: string; p_start_date: string }
        Returns: {
          avg_delivery_fee: number
          driver_id: string
          driver_name: string
          interval_start: string
          total_deliveries: number
          total_delivery_fees: number
          total_revenue: number
        }[]
      }
      get_email_health_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_email_system_config_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          connection_security: string
          created_at: string
          credential_source: string
          id: string
          last_security_audit: string
          production_mode: boolean
          security_status: string
          sender_email: string
          sender_name: string
          smtp_host: string
          smtp_port: number
          smtp_secure: boolean
          updated_at: string
          use_smtp: boolean
        }[]
      }
      get_email_system_production_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_enhanced_system_health_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_environment_config: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_live_payment_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_menu_structure_secure: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          is_active: boolean
          key: string
          label: string
          parent_key: string
          permission_levels: Json
          sort_order: number
        }[]
      }
      get_order_linking_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_order_lock_info: {
        Args: { p_order_id: string }
        Returns: {
          acquired_at: string
          is_locked: boolean
          lock_expires_at: string
          locking_admin_avatar: string
          locking_admin_email: string
          locking_admin_id: string
          locking_admin_name: string
          seconds_remaining: number
        }[]
      }
      get_order_payment_status: {
        Args: { p_order_id: string }
        Returns: {
          error_message: string
          order_id: string
          order_number: string
          overall_status: string
          payment_reference: string
          processing_stage: string
        }[]
      }
      get_order_tracking_secure: {
        Args: { p_order_number: string; p_tracking_token?: string }
        Returns: Json
      }
      get_orders_with_payment: {
        Args: { p_customer_id?: string; p_limit?: number; p_order_id?: string }
        Returns: {
          created_at: string
          customer_name: string
          order_id: string
          order_number: string
          order_status: string
          payment_status: string
          total_amount: number
        }[]
      }
      get_payment_config_secure: {
        Args: { p_provider: string }
        Returns: Json
      }
      get_payment_flow_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          completed_orders: number
          completion_rate_percent: number
          paid_orders: number
          payment_pending: number
          pending_orders: number
          period: string
          total_orders: number
        }[]
      }
      get_payment_health_summary: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_product_sales_trends: {
        Args: {
          p_end_date: string
          p_interval?: string
          p_product_id: string
          p_start_date: string
        }
        Returns: {
          interval_start: string
          orders_count: number
          revenue: number
          units_sold: number
        }[]
      }
      get_production_health_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_products_sold_report: {
        Args: { p_end_date: string; p_interval?: string; p_start_date: string }
        Returns: {
          avg_price: number
          interval_start: string
          product_id: string
          product_name: string
          total_revenue: number
          units_sold: number
        }[]
      }
      get_public_business_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          accent_color: string
          logo_url: string
          name: string
          primary_color: string
          secondary_color: string
          tagline: string
        }[]
      }
      get_public_delivery_zones: {
        Args: Record<PropertyKey, never>
        Returns: {
          base_fee: number
          description: string
          id: string
          is_active: boolean
          name: string
        }[]
      }
      get_public_paystack_config: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_valid: boolean
          public_key: string
          test_mode: boolean
        }[]
      }
      get_queued_communication_events: {
        Args: { batch_size?: number }
        Returns: {
          admin_session_id: string | null
          channel: string | null
          collision_detected_at: string | null
          created_at: string
          dedupe_key: string | null
          delivery_status: string | null
          email_provider: string | null
          email_type: string | null
          error_message: string | null
          event_type: string
          external_id: string | null
          id: string
          last_error: string | null
          last_retry_at: string | null
          order_id: string | null
          payload: Json | null
          priority: string | null
          processed_at: string | null
          processing_started_at: string | null
          processing_time_ms: number | null
          provider_response: Json | null
          recipient_email: string | null
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          sms_cost: number | null
          sms_phone: string | null
          sms_sender: string | null
          source: string | null
          status: Database["public"]["Enums"]["communication_event_status"]
          template_id: string | null
          template_key: string | null
          template_variables: Json | null
          updated_at: string
          variables: Json | null
        }[]
      }
      get_security_events: {
        Args: { p_limit?: number; p_risk_level?: string }
        Returns: {
          action: string
          category: string
          entity_id: string
          event_time: string
          id: string
          message: string
          new_values: Json
          risk_level: string
          user_id: string
        }[]
      }
      get_smtp_config_with_fallback: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_system_health_metrics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_time_ago: {
        Args: { target_time: string }
        Returns: string
      }
      get_top_selling_products: {
        Args: { p_end_date: string; p_limit?: number; p_start_date: string }
        Returns: {
          avg_order_quantity: number
          number_of_orders: number
          product_id: string
          product_name: string
          total_revenue: number
          total_units_sold: number
        }[]
      }
      get_user_favorites_with_products: {
        Args: { p_user_id?: string }
        Returns: {
          created_at: string
          favorite_id: string
          product_id: string
          product_image_url: string
          product_name: string
          product_price: number
          product_status: Database["public"]["Enums"]["product_status"]
        }[]
      }
      get_user_permissions_secure: {
        Args: { target_user_id: string }
        Returns: {
          menu_key: string
          permission_level: Database["public"]["Enums"]["permission_level"]
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      handle_email_webhook: {
        Args: { webhook_data: Json; webhook_type?: string }
        Returns: boolean
      }
      handle_successful_payment: {
        Args: {
          p_amount?: number
          p_currency?: string
          p_order_reference?: string
          p_paystack_data?: Json
          p_paystack_reference: string
        }
        Returns: Json
      }
      handle_successful_payment_enhanced: {
        Args: {
          p_authorization_code?: string
          p_bank?: string
          p_card_type?: string
          p_channel?: string
          p_exp_month?: number
          p_exp_year?: number
          p_fees?: number
          p_gateway_response: string
          p_last4?: string
          p_paid_at: string
          p_reference: string
          p_webhook_event_id?: string
        }
        Returns: Json
      }
      has_email_consent: {
        Args: { consent_type?: string; email_address: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_password: {
        Args: { password_text: string }
        Returns: string
      }
      health_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      increment_api_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: Json
      }
      increment_discount_usage_count: {
        Args: { p_discount_code_id: string }
        Returns: undefined
      }
      increment_email_rate_limit: {
        Args: { email_address: string }
        Returns: undefined
      }
      increment_promotion_usage: {
        Args: {
          p_customer_email: string
          p_discount_amount: number
          p_final_amount: number
          p_metadata?: Json
          p_order_id: string
          p_original_amount: number
          p_promotion_id: string
        }
        Returns: undefined
      }
      increment_rate_limit_counter: {
        Args: { p_identifier: string; p_identifier_type?: string }
        Returns: Json
      }
      insert_comm_event_on_conflict_do_nothing: {
        Args: { event_data: Json }
        Returns: string
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_admin_secure: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_email_suppressed: {
        Args: { email_address: string }
        Returns: boolean
      }
      is_jsonb_valid: {
        Args: { input: string }
        Returns: boolean
      }
      is_lock_holder_for_order: {
        Args: { p_admin_user_id: string; p_order_id: string }
        Returns: boolean
      }
      is_phone_suppressed: {
        Args: { phone_text: string }
        Returns: boolean
      }
      link_guest_to_authenticated_customer: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      link_order_to_customer_account: {
        Args: { p_customer_email: string; p_order_id: string }
        Returns: undefined
      }
      log_admin_action: {
        Args:
          | {
              action_type: string
              entity_id: string
              entity_type: string
              message?: string
              new_values?: Json
              old_values?: Json
            }
          | {
              p_action: string
              p_details?: Json
              p_entity_id?: string
              p_entity_type?: string
            }
          | { p_action_type: string; p_details?: Json; p_order_id: string }
        Returns: string
      }
      log_admin_management_action: {
        Args: {
          action_data?: Json
          action_result?: string
          action_type: string
          target_email?: string
          target_user_id?: string
        }
        Returns: undefined
      }
      log_api_request: {
        Args: {
          p_customer_id?: string
          p_endpoint: string
          p_error_details?: Json
          p_ip_address?: unknown
          p_method: string
          p_request_payload?: Json
          p_response_status?: number
          p_response_time_ms?: number
          p_session_id?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_branding_change: {
        Args: {
          p_action: string
          p_field_name: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_new_value: string
          p_old_value: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_critical_payment_access: {
        Args: {
          operation_type: string
          record_id: string
          table_name: string
          user_context?: Json
        }
        Returns: undefined
      }
      log_customer_operation: {
        Args: {
          p_admin_id?: string
          p_customer_id: string
          p_details: Json
          p_ip_address?: unknown
          p_operation: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_email_delivery: {
        Args: {
          p_message_id: string
          p_provider: string
          p_recipient_email: string
          p_smtp_response?: string
          p_status: string
          p_subject: string
          p_template_key?: string
          p_variables?: Json
        }
        Returns: undefined
      }
      log_email_security_event: {
        Args: {
          p_details?: Json
          p_email_address: string
          p_event_type: string
          p_function_name: string
        }
        Returns: undefined
      }
      log_moq_violation: {
        Args: {
          p_action_taken?: string
          p_customer_id: string
          p_order_id: string
          p_violations: Json
        }
        Returns: string
      }
      log_order_status_change_with_email: {
        Args: {
          p_changed_by: string
          p_new_status: string
          p_old_status: string
          p_order_id: string
        }
        Returns: undefined
      }
      log_order_update_metric: {
        Args: {
          p_admin_user_id: string
          p_cache_cleared?: boolean
          p_cache_hit?: boolean
          p_concurrent_admin_sessions?: Json
          p_conflict_resolution_method?: string
          p_correlation_id?: string
          p_database_query_time_ms?: number
          p_duration_ms: number
          p_error_code?: string
          p_error_message?: string
          p_lock_acquired?: boolean
          p_lock_wait_time_ms?: number
          p_operation: string
          p_order_id: string
          p_retry_attempts?: number
          p_status: string
          p_total_processing_time_ms?: number
        }
        Returns: string
      }
      log_payment_access: {
        Args: {
          p_access_reason?: string
          p_accessed_by?: string
          p_action: string
          p_payment_id: string
        }
        Returns: undefined
      }
      log_payment_error: {
        Args: {
          p_error_code: string
          p_error_context?: Json
          p_error_message: string
          p_order_id?: string
          p_severity?: string
          p_transaction_reference?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_payment_security_event: {
        Args:
          | {
              details?: Json
              event_type: string
              ip_address?: unknown
              severity?: string
              user_agent?: string
            }
          | { p_details?: Json; p_event_type: string; p_severity?: string }
        Returns: string
      }
      log_payment_verification_attempt: {
        Args: {
          p_error_message?: string
          p_ip_address?: unknown
          p_reference: string
          p_success?: boolean
          p_user_id?: string
        }
        Returns: undefined
      }
      log_privilege_escalation_attempt: {
        Args: {
          p_details: Json
          p_email: string
          p_user_id: string
          p_violation_type: string
        }
        Returns: undefined
      }
      log_production_metric: {
        Args: {
          p_dimensions?: Json
          p_metric_name: string
          p_metric_type?: string
          p_metric_value: number
        }
        Returns: undefined
      }
      log_profile_activity: {
        Args: {
          p_action_type: string
          p_customer_id: string
          p_field_changed?: string
          p_ip_address?: unknown
          p_new_value?: string
          p_old_value?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_registration_debug: {
        Args: {
          p_category?: string
          p_details?: Json
          p_ip_address?: unknown
          p_level?: string
          p_message: string
          p_session_id?: string
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      log_registration_security_event: {
        Args: {
          p_email: string
          p_event_type: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_success?: boolean
          p_user_agent?: string
        }
        Returns: string
      }
      log_security_event: {
        Args:
          | {
              p_description: string
              p_event_type: string
              p_metadata?: Json
              p_severity?: string
            }
          | {
              p_description?: string
              p_event_type: string
              p_ip_address?: unknown
              p_metadata?: Json
              p_severity?: string
              p_user_agent?: string
              p_user_id?: string
            }
        Returns: string
      }
      log_security_incident: {
        Args: {
          p_details?: Json
          p_endpoint?: string
          p_incident_type: string
          p_ip_address?: unknown
          p_severity?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_security_violation: {
        Args: {
          description: string
          metadata?: Json
          severity?: string
          violation_type: string
        }
        Returns: string
      }
      log_sensitive_data_access: {
        Args: {
          operation: string
          record_id?: string
          table_name: string
          user_context?: Json
        }
        Returns: undefined
      }
      log_sms_balance_check: {
        Args: {
          p_balance_amount?: number
          p_error_message?: string
          p_provider_response?: Json
          p_status?: string
        }
        Returns: undefined
      }
      log_sms_delivery: {
        Args: {
          p_communication_event_id: string
          p_cost?: number
          p_error_code?: string
          p_error_message?: string
          p_message_content: string
          p_provider_response?: Json
          p_recipient_phone: string
          p_sender: string
          p_status: Database["public"]["Enums"]["sms_delivery_status"]
        }
        Returns: string
      }
      manual_cache_bypass_and_update: {
        Args: {
          p_admin_user_id: string
          p_bypass_reason?: string
          p_new_status: string
          p_order_id: string
        }
        Returns: Json
      }
      manual_payment_verification: {
        Args: { p_payment_reference: string }
        Returns: Json
      }
      manual_setup_store_admin: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      migrate_orders_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      migrate_pay_to_txn_reference: {
        Args: { pay_ref: string }
        Returns: string
      }
      migrate_payment_references: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      minimal_payment_test_insert: {
        Args: { p_amount: number; p_order_id: string }
        Returns: Json
      }
      monitor_payment_security: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      order_needs_reconciliation: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      pg_notify_safe: {
        Args: { channel: string; payload: string }
        Returns: undefined
      }
      populate_delivery_slots: {
        Args: { end_date: string; start_date: string }
        Returns: undefined
      }
      preview_order_email: {
        Args: { p_order_id: string; p_template_key: string }
        Returns: Json
      }
      process_email_queue_batch: {
        Args: { p_batch_size?: number }
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
      process_email_queue_secure: {
        Args: { batch_size?: number; priority_filter?: string }
        Returns: Json
      }
      process_payment_atomically: {
        Args: {
          p_amount_kobo: number
          p_gateway_response?: Json
          p_paid_at?: string
          p_reference: string
          p_status: string
        }
        Returns: Json
      }
      process_queued_communication_events: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_stuck_emails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      production_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      production_go_live_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      queue_communication_event_nonblocking: {
        Args: {
          p_event_type: string
          p_order_id: string
          p_recipient_email: string
          p_template_key: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      reassign_order_rider: {
        Args: { p_new_rider_id: string; p_order_id: string; p_reason?: string }
        Returns: Json
      }
      record_health_metric: {
        Args: {
          p_metric_name: string
          p_metric_type?: string
          p_metric_value: number
          p_severity?: string
          p_tags?: Json
        }
        Returns: string
      }
      record_payment_metric: {
        Args: {
          p_metadata?: Json
          p_metric_name: string
          p_metric_unit?: string
          p_metric_value: number
        }
        Returns: undefined
      }
      record_performance_metric: {
        Args: {
          p_cache_hit?: boolean
          p_database_query_time_ms?: number
          p_endpoint: string
          p_error_details?: Json
          p_ip_address?: unknown
          p_method: string
          p_request_size_bytes?: number
          p_response_size_bytes?: number
          p_response_time_ms: number
          p_status_code: number
          p_user_agent?: string
          p_user_id?: string
        }
        Returns: string
      }
      record_permission_change_rate_limit: {
        Args:
          | { changes_count?: number; target_user_id: string }
          | { p_target_user_id: string }
        Returns: undefined
      }
      record_smtp_health_metric: {
        Args: {
          p_metric_type: string
          p_metric_value: number
          p_provider_name: string
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
      recover_stuck_payment: {
        Args: { p_order_number: string; p_paystack_reference: string }
        Returns: Json
      }
      refresh_payment_processing_status: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      release_delivery_slot: {
        Args: { p_order_id?: string; p_slot_id: string }
        Returns: Json
      }
      release_order_lock: {
        Args:
          | { p_admin_session_id: string; p_order_id: string }
          | { p_admin_user_id: string; p_order_id: string }
        Returns: boolean
      }
      release_order_lock_enhanced: {
        Args: {
          p_admin_user_id: string
          p_force_release?: boolean
          p_order_id: string
        }
        Returns: boolean
      }
      requeue_failed_welcome_emails: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      reserve_delivery_slot: {
        Args: { p_order_id?: string; p_slot_id: string }
        Returns: Json
      }
      reset_email_system_health: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_for_go_live: {
        Args: {
          p_dry_run?: boolean
          p_include_audit_logs?: boolean
          p_reset_sequences?: boolean
        }
        Returns: Json
      }
      run_security_audit: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      safe_delete_product: {
        Args: { product_id: string }
        Returns: Json
      }
      safe_get_order_details: {
        Args: { p_order_id: string }
        Returns: Json
      }
      safe_update_order_status: {
        Args:
          | { p_admin_id?: string; p_new_status: string; p_order_id: string }
          | { p_admin_notes?: string; p_new_status: string; p_order_id: string }
        Returns: Json
      }
      secure_payment_verification: {
        Args: {
          p_expected_amount: number
          p_order_id: string
          p_payment_reference: string
        }
        Returns: Json
      }
      secure_verify_payment: {
        Args: {
          p_expected_amount: number
          p_order_id: string
          p_payment_reference: string
        }
        Returns: Json
      }
      send_order_email_manual: {
        Args: {
          p_admin_id?: string
          p_order_id: string
          p_template_key: string
        }
        Returns: Json
      }
      setup_admin_permissions: {
        Args: { admin_user_id: string }
        Returns: undefined
      }
      setup_admin_role_permissions: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      start_delivery: {
        Args: { p_order_id: string; p_rider_id: string }
        Returns: Json
      }
      sync_payment_to_order_status: {
        Args: {
          p_order_status?: string
          p_payment_status: string
          p_transaction_id: string
        }
        Returns: undefined
      }
      sync_pending_payments: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      test_admin_access: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      test_registration_system: {
        Args: Record<PropertyKey, never>
        Returns: {
          component: string
          message: string
          status: string
        }[]
      }
      toggle_user_favorite: {
        Args: { p_product_id: string }
        Returns: Json
      }
      trigger_order_emails: {
        Args: { order_uuid: string }
        Returns: undefined
      }
      trigger_review_request_processing: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      update_admin_role: {
        Args: { p_new_role: string; p_user_id: string }
        Returns: Json
      }
      update_customer_with_validation: {
        Args: {
          p_admin_id?: string
          p_customer_id: string
          p_email?: string
          p_ip_address?: unknown
          p_name?: string
          p_phone?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      update_delivery_status: {
        Args: { p_assignment_id: string; p_notes?: string; p_status: string }
        Returns: Json
      }
      update_order_status: {
        Args: {
          new_order_status: string
          new_payment_status: string
          order_id: string
          payment_data?: Json
        }
        Returns: undefined
      }
      update_order_status_safe: {
        Args: {
          p_amount?: number
          p_customer_email?: string
          p_reference: string
          p_status: string
        }
        Returns: Json
      }
      update_order_with_payment_reference: {
        Args: {
          new_payment_reference: string
          order_fulfillment_type?: string
          order_uuid: string
        }
        Returns: Json
      }
      update_sms_wallet_balance: {
        Args: { new_balance: number; provider?: string }
        Returns: undefined
      }
      update_user_permissions_secure: {
        Args:
          | { p_change_reason?: string; p_permissions: Json; p_user_id: string }
          | { permissions_data: Json; target_user_id: string }
        Returns: Json
      }
      upsert_communication_event: {
        Args:
          | {
              p_dedupe_key?: string
              p_event_type: string
              p_order_id?: string
              p_recipient_email: string
              p_template_key: string
              p_template_variables?: Json
            }
          | {
              p_dedupe_key?: string
              p_event_type: string
              p_recipient_email: string
              p_recipient_name: string
              p_related_order_id: string
              p_template_key: string
              p_template_variables: Json
            }
        Returns: Json
      }
      upsert_communication_event_enhanced: {
        Args: {
          p_dedupe_key?: string
          p_event_type: string
          p_order_id?: string
          p_recipient_email: string
          p_template_key: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      upsert_communication_event_production: {
        Args: {
          p_event_type: string
          p_order_id?: string
          p_recipient_email: string
          p_source?: string
          p_template_key: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      upsert_communication_event_with_business_logic: {
        Args: {
          p_admin_session_id: string
          p_event_type: string
          p_order_id: string
          p_template_key?: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      upsert_payment_confirmation_event: {
        Args: {
          p_order_id: string
          p_recipient_email: string
          p_reference: string
          p_template_variables?: Json
        }
        Returns: Json
      }
      validate_admin_access: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      validate_admin_invitation_token: {
        Args: { token: string }
        Returns: {
          email: string
          expires_at: string
          invitation_id: string
          is_valid: boolean
          role: string
        }[]
      }
      validate_admin_permission: {
        Args: { required_permission?: string }
        Returns: boolean
      }
      validate_admin_permissions: {
        Args: { p_required_permission: string; p_user_id: string }
        Returns: boolean
      }
      validate_admin_session: {
        Args: { p_ip_address?: unknown; p_session_token: string }
        Returns: Json
      }
      validate_email_template: {
        Args: { p_template_key: string } | { template_data: Json }
        Returns: Json
      }
      validate_order_access_token: {
        Args: { p_order_id: string; p_token: string }
        Returns: boolean
      }
      validate_order_data: {
        Args: {
          p_customer_email: string
          p_order_items: Json
          p_total_amount: number
        }
        Returns: Json
      }
      validate_order_moq: {
        Args: { order_items: Json }
        Returns: Json
      }
      validate_otp_code: {
        Args: { p_email: string; p_otp_code: string; p_otp_type: string }
        Returns: Json
      }
      validate_password_strength: {
        Args: { password_text: string }
        Returns: boolean
      }
      validate_paystack_webhook_ip: {
        Args: { request_ip: unknown }
        Returns: boolean
      }
      validate_phone_number: {
        Args: { phone_text: string }
        Returns: boolean
      }
      validate_promotion_code_secure: {
        Args: {
          p_code: string
          p_customer_email?: string
          p_customer_id?: string
          p_ip_address?: unknown
          p_order_amount: number
          p_user_agent?: string
        }
        Returns: Json
      }
      validate_promotion_usage: {
        Args: {
          p_customer_email?: string
          p_order_amount: number
          p_promotion_code?: string
          p_promotion_id: string
        }
        Returns: Json
      }
      verify_and_update_payment_status: {
        Args: {
          new_status: string
          payment_amount: number
          payment_gateway_response?: Json
          payment_ref: string
        }
        Returns: Json
      }
      verify_and_update_payment_status_enhanced: {
        Args: {
          new_status: string
          payment_amount: number
          payment_gateway_response: Json
          payment_ref: string
          processing_context?: Json
        }
        Returns: Json
      }
      verify_customer_otp: {
        Args:
          | {
              p_email: string
              p_ip_address?: string
              p_otp_code: string
              p_otp_type: string
            }
          | {
              p_email: string
              p_ip_address?: unknown
              p_otp_code: string
              p_otp_type: string
            }
        Returns: Json
      }
      verify_customer_otp_secure: {
        Args: {
          p_correlation_id?: string
          p_email: string
          p_ip_address?: unknown
          p_otp_code: string
          p_otp_type: string
        }
        Returns: Json
      }
      verify_final_security_compliance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      verify_payment_atomic: {
        Args: {
          p_paystack_data: Json
          p_reference: string
          p_verified_at: string
        }
        Returns: Json
      }
      verify_paystack_signature: {
        Args: { payload: string; secret: string; signature: string }
        Returns: boolean
      }
      verify_webhook_signature: {
        Args: { p_payload: string; p_secret: string; p_signature: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "manager"
        | "support_officer"
        | "staff"
        | "support_staff"
        | "admin_manager"
        | "account_manager"
        | "store_owner"
        | "fulfilment_support"
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
        | "returned"
      order_type: "delivery" | "pickup" | "dine_in"
      payment_status:
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "partially_refunded"
        | "completed"
      permission_level: "none" | "view" | "edit"
      product_status: "active" | "archived" | "draft" | "discontinued"
      promotion_status: "active" | "inactive" | "expired" | "scheduled"
      promotion_type: "percentage" | "fixed_amount" | "free_delivery"
      sms_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      sms_template_type:
        | "order_confirmation"
        | "order_shipped"
        | "order_delivered"
        | "order_cancelled"
        | "payment_confirmation"
        | "welcome"
        | "custom"
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
      app_role: [
        "super_admin",
        "admin",
        "manager",
        "support_officer",
        "staff",
        "support_staff",
        "admin_manager",
        "account_manager",
        "store_owner",
        "fulfilment_support",
      ],
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
        "returned",
      ],
      order_type: ["delivery", "pickup", "dine_in"],
      payment_status: [
        "pending",
        "paid",
        "failed",
        "refunded",
        "partially_refunded",
        "completed",
      ],
      permission_level: ["none", "view", "edit"],
      product_status: ["active", "archived", "draft", "discontinued"],
      promotion_status: ["active", "inactive", "expired", "scheduled"],
      promotion_type: ["percentage", "fixed_amount", "free_delivery"],
      sms_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      sms_template_type: [
        "order_confirmation",
        "order_shipped",
        "order_delivered",
        "order_cancelled",
        "payment_confirmation",
        "welcome",
        "custom",
      ],
      user_role: ["admin", "manager", "staff", "dispatch_rider"],
      user_status: ["active", "inactive", "pending"],
      vehicle_status: ["available", "assigned", "maintenance", "inactive"],
      vehicle_type: ["bike", "van", "truck"],
    },
  },
} as const
