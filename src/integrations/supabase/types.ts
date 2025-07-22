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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      packages: {
        Row: {
          billing_period: string | null
          created_at: string | null
          description: string | null
          features: Json | null
          id: number
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: number
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: number
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: number
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          paystack_reference: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          subscription_id: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          subscription_id?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          paystack_reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          subscription_id?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          id: string
          name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      roles: {
        Row: {
          id: number
          role: string
        }
        Insert: {
          id?: never
          role: string
        }
        Update: {
          id?: never
          role?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          end_date: string | null
          id: number
          package_id: number
          start_date: string | null
          status: Database["public"]["Enums"]["subscription_status"] | null
          updated_at: string | null
          user_id: string
          vehicle_id: number
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: number
          package_id: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id: string
          vehicle_id: number
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          end_date?: string | null
          id?: number
          package_id?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["subscription_status"] | null
          updated_at?: string | null
          user_id?: string
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      telemetry_data: {
        Row: {
          altitude: number | null
          battery_voltage: number | null
          created_at: string | null
          engine_status: boolean | null
          engine_temperature: number | null
          fuel_level: number | null
          heading: number | null
          id: number
          ignition_status: boolean | null
          latitude: number | null
          longitude: number | null
          odometer: number | null
          raw_data: Json | null
          speed: number | null
          timestamp: string | null
          tracker_id: number | null
          vehicle_id: number
        }
        Insert: {
          altitude?: number | null
          battery_voltage?: number | null
          created_at?: string | null
          engine_status?: boolean | null
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: number
          ignition_status?: boolean | null
          latitude?: number | null
          longitude?: number | null
          odometer?: number | null
          raw_data?: Json | null
          speed?: number | null
          timestamp?: string | null
          tracker_id?: number | null
          vehicle_id: number
        }
        Update: {
          altitude?: number | null
          battery_voltage?: number | null
          created_at?: string | null
          engine_status?: boolean | null
          engine_temperature?: number | null
          fuel_level?: number | null
          heading?: number | null
          id?: number
          ignition_status?: boolean | null
          latitude?: number | null
          longitude?: number | null
          odometer?: number | null
          raw_data?: Json | null
          speed?: number | null
          timestamp?: string | null
          tracker_id?: number | null
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "telemetry_data_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telemetry_data_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_logs: {
        Row: {
          data: Json | null
          id: number
          log_type: string
          message: string
          timestamp: string | null
          tracker_id: number | null
          vehicle_id: number | null
        }
        Insert: {
          data?: Json | null
          id?: number
          log_type: string
          message: string
          timestamp?: string | null
          tracker_id?: number | null
          vehicle_id?: number | null
        }
        Update: {
          data?: Json | null
          id?: number
          log_type?: string
          message?: string
          timestamp?: string | null
          tracker_id?: number | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tracker_logs_tracker_id_fkey"
            columns: ["tracker_id"]
            isOneToOne: false
            referencedRelation: "trackers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracker_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_models: {
        Row: {
          communication_method: string | null
          config_template: Json | null
          created_at: string | null
          features: Json | null
          id: number
          image_url: string | null
          is_active: boolean | null
          manufacturer: string | null
          model_number: string | null
          name: string
          protocol_type: string | null
          specifications: Json | null
          updated_at: string | null
        }
        Insert: {
          communication_method?: string | null
          config_template?: Json | null
          created_at?: string | null
          features?: Json | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          manufacturer?: string | null
          model_number?: string | null
          name: string
          protocol_type?: string | null
          specifications?: Json | null
          updated_at?: string | null
        }
        Update: {
          communication_method?: string | null
          config_template?: Json | null
          created_at?: string | null
          features?: Json | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          protocol_type?: string | null
          specifications?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trackers: {
        Row: {
          configuration: Json | null
          created_at: string | null
          id: number
          imei: string | null
          last_seen: string | null
          phone_number: string | null
          serial_number: string | null
          status: Database["public"]["Enums"]["tracker_status"] | null
          tracker_model_id: number | null
          updated_at: string | null
          vehicle_id: number | null
        }
        Insert: {
          configuration?: Json | null
          created_at?: string | null
          id?: number
          imei?: string | null
          last_seen?: string | null
          phone_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tracker_status"] | null
          tracker_model_id?: number | null
          updated_at?: string | null
          vehicle_id?: number | null
        }
        Update: {
          configuration?: Json | null
          created_at?: string | null
          id?: number
          imei?: string | null
          last_seen?: string | null
          phone_number?: string | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["tracker_status"] | null
          tracker_model_id?: number | null
          updated_at?: string | null
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trackers_tracker_model_id_fkey"
            columns: ["tracker_model_id"]
            isOneToOne: false
            referencedRelation: "tracker_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trackers_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_history: {
        Row: {
          avg_speed: number | null
          created_at: string | null
          distance: number | null
          duration_minutes: number | null
          end_location: Json | null
          end_time: string | null
          fuel_consumed: number | null
          id: number
          max_speed: number | null
          start_location: Json
          start_time: string
          vehicle_id: number
        }
        Insert: {
          avg_speed?: number | null
          created_at?: string | null
          distance?: number | null
          duration_minutes?: number | null
          end_location?: Json | null
          end_time?: string | null
          fuel_consumed?: number | null
          id?: number
          max_speed?: number | null
          start_location: Json
          start_time: string
          vehicle_id: number
        }
        Update: {
          avg_speed?: number | null
          created_at?: string | null
          distance?: number | null
          duration_minutes?: number | null
          end_location?: Json | null
          end_time?: string | null
          fuel_consumed?: number | null
          id?: number
          max_speed?: number | null
          start_location?: Json
          start_time?: string
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_alarms: {
        Row: {
          created_at: string | null
          id: number
          location: Json | null
          message: string
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["alarm_severity"] | null
          type: Database["public"]["Enums"]["alarm_type"]
          updated_at: string | null
          vehicle_id: number
        }
        Insert: {
          created_at?: string | null
          id?: number
          location?: Json | null
          message: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alarm_severity"] | null
          type: Database["public"]["Enums"]["alarm_type"]
          updated_at?: string | null
          vehicle_id: number
        }
        Update: {
          created_at?: string | null
          id?: number
          location?: Json | null
          message?: string
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["alarm_severity"] | null
          type?: Database["public"]["Enums"]["alarm_type"]
          updated_at?: string | null
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_alarms_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_alarms_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string | null
          current_location: Json | null
          id: number
          make: string | null
          model: string | null
          nickname: string | null
          package_plan: string | null
          plate_number: string
          registration_date: string | null
          tracker_installed: boolean | null
          type: string | null
          updated_at: string | null
          user_id: string
          vin: string
          year: number | null
        }
        Insert: {
          created_at?: string | null
          current_location?: Json | null
          id?: number
          make?: string | null
          model?: string | null
          nickname?: string | null
          package_plan?: string | null
          plate_number: string
          registration_date?: string | null
          tracker_installed?: boolean | null
          type?: string | null
          updated_at?: string | null
          user_id: string
          vin: string
          year?: number | null
        }
        Update: {
          created_at?: string | null
          current_location?: Json | null
          id?: number
          make?: string | null
          model?: string | null
          nickname?: string | null
          package_plan?: string | null
          plate_number?: string
          registration_date?: string | null
          tracker_installed?: boolean | null
          type?: string | null
          updated_at?: string | null
          user_id?: string
          vin?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: Record<PropertyKey, never> | { user_uuid: string }
        Returns: string
      }
    }
    Enums: {
      alarm_severity: "low" | "medium" | "high" | "critical"
      alarm_type:
        | "speeding"
        | "geofence"
        | "engine_off"
        | "low_battery"
        | "panic"
      payment_status: "pending" | "completed" | "failed" | "cancelled"
      subscription_status: "active" | "expired" | "cancelled" | "pending"
      tracker_status: "active" | "inactive" | "maintenance"
      user_role: "admin" | "user"
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
      alarm_severity: ["low", "medium", "high", "critical"],
      alarm_type: [
        "speeding",
        "geofence",
        "engine_off",
        "low_battery",
        "panic",
      ],
      payment_status: ["pending", "completed", "failed", "cancelled"],
      subscription_status: ["active", "expired", "cancelled", "pending"],
      tracker_status: ["active", "inactive", "maintenance"],
      user_role: ["admin", "user"],
    },
  },
} as const
