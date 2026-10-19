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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      athlete_group_members: {
        Row: {
          athlete_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "athlete_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_groups: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      coach_athlete_links: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      coach_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          athlete_id: string
          coach_email: string
          created_at: string
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["invite_status"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          athlete_id: string
          coach_email: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          athlete_id?: string
          coach_email?: string
          created_at?: string
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["invite_status"]
          token?: string
        }
        Relationships: []
      }
      day_comments: {
        Row: {
          athlete_id: string
          author_id: string
          body: string
          comment_date: string
          created_at: string
          id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          author_id: string
          body?: string
          comment_date: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          author_id?: string
          body?: string
          comment_date?: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          athlete_id: string
          created_at: string
          end_date: string
          event_type: string
          id: string
          notes: string | null
          start_date: string
          title: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          end_date: string
          event_type: string
          id?: string
          notes?: string | null
          start_date: string
          title: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          end_date?: string
          event_type?: string
          id?: string
          notes?: string | null
          start_date?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          kind: string
          link_date: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          link_date?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          link_date?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bike_hr_i1_max: number | null
          bike_hr_i2_max: number | null
          bike_hr_i3_max: number | null
          bike_hr_i4_max: number | null
          bike_hr_i5_max: number | null
          bike_max_hr_free: number | null
          club: string | null
          created_at: string
          hr_i1_max: number | null
          hr_i2_max: number | null
          hr_i3_max: number | null
          hr_i4_max: number | null
          hr_i5_max: number | null
          id: string
          is_biathlete: boolean
          last_strava_sync_at: string | null
          max_hr_free: number | null
          name: string | null
          onboarding_completed: boolean
          updated_at: string
          use_bike_hr_zones: boolean
        }
        Insert: {
          bike_hr_i1_max?: number | null
          bike_hr_i2_max?: number | null
          bike_hr_i3_max?: number | null
          bike_hr_i4_max?: number | null
          bike_hr_i5_max?: number | null
          bike_max_hr_free?: number | null
          club?: string | null
          created_at?: string
          hr_i1_max?: number | null
          hr_i2_max?: number | null
          hr_i3_max?: number | null
          hr_i4_max?: number | null
          hr_i5_max?: number | null
          id: string
          is_biathlete?: boolean
          last_strava_sync_at?: string | null
          max_hr_free?: number | null
          name?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          use_bike_hr_zones?: boolean
        }
        Update: {
          bike_hr_i1_max?: number | null
          bike_hr_i2_max?: number | null
          bike_hr_i3_max?: number | null
          bike_hr_i4_max?: number | null
          bike_hr_i5_max?: number | null
          bike_max_hr_free?: number | null
          club?: string | null
          created_at?: string
          hr_i1_max?: number | null
          hr_i2_max?: number | null
          hr_i3_max?: number | null
          hr_i4_max?: number | null
          hr_i5_max?: number | null
          id?: string
          is_biathlete?: boolean
          last_strava_sync_at?: string | null
          max_hr_free?: number | null
          name?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          use_bike_hr_zones?: boolean
        }
        Relationships: []
      }
      shooting_sessions: {
        Row: {
          athlete_id: string
          author_id: string
          center_x_mm: number
          center_y_mm: number
          click_mm: number
          clicks_horizontal: number
          clicks_vertical: number
          clock_hour: number | null
          created_at: string
          id: string
          item_type: string
          notes: string | null
          offset_mm: number
          session_date: string
          shots: Json
          stance: string
        }
        Insert: {
          athlete_id: string
          author_id: string
          center_x_mm?: number
          center_y_mm?: number
          click_mm?: number
          clicks_horizontal?: number
          clicks_vertical?: number
          clock_hour?: number | null
          created_at?: string
          id?: string
          item_type?: string
          notes?: string | null
          offset_mm?: number
          session_date?: string
          shots: Json
          stance: string
        }
        Update: {
          athlete_id?: string
          author_id?: string
          center_x_mm?: number
          center_y_mm?: number
          click_mm?: number
          clicks_horizontal?: number
          clicks_vertical?: number
          clock_hour?: number | null
          created_at?: string
          id?: string
          item_type?: string
          notes?: string | null
          offset_mm?: number
          session_date?: string
          shots?: Json
          stance?: string
        }
        Relationships: [
          {
            foreignKeyName: "shooting_sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shooting_sessions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_zeroings: {
        Row: {
          athlete_id: string
          author_id: string
          center_x_mm: number
          center_y_mm: number
          click_mm: number
          clicks_horizontal: number
          clicks_vertical: number
          clock_hour: number | null
          created_at: string
          id: string
          notes: string | null
          offset_mm: number
          shots: Json
          stance: string
          zeroing_date: string
        }
        Insert: {
          athlete_id: string
          author_id: string
          center_x_mm?: number
          center_y_mm?: number
          click_mm?: number
          clicks_horizontal?: number
          clicks_vertical?: number
          clock_hour?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offset_mm?: number
          shots?: Json
          stance: string
          zeroing_date?: string
        }
        Update: {
          athlete_id?: string
          author_id?: string
          center_x_mm?: number
          center_y_mm?: number
          click_mm?: number
          clicks_horizontal?: number
          clicks_vertical?: number
          clock_hour?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offset_mm?: number
          shots?: Json
          stance?: string
          zeroing_date?: string
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          last_synced_at: string | null
          refresh_token: string
          strava_athlete_id: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          last_synced_at?: string | null
          refresh_token: string
          strava_athlete_id?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          last_synced_at?: string | null
          refresh_token?: string
          strava_athlete_id?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_blocks: {
        Row: {
          athlete_id: string
          avg_heart_rate: number | null
          block_date: string
          created_at: string
          distance_km: number | null
          duration_minutes: number
          id: string
          notes: string | null
          plan_or_real: Database["public"]["Enums"]["plan_real"]
          rpe: number | null
          segments: Json
          shooting_hits: number | null
          shooting_intensity: string | null
          shooting_sets: Json
          shooting_shots: number | null
          slot: Database["public"]["Enums"]["day_slot"]
          sport: Database["public"]["Enums"]["sport_kind"]
          strava_activity_id: string | null
          updated_at: string
          zone: Database["public"]["Enums"]["intensity_zone"]
        }
        Insert: {
          athlete_id: string
          avg_heart_rate?: number | null
          block_date: string
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          plan_or_real?: Database["public"]["Enums"]["plan_real"]
          rpe?: number | null
          segments?: Json
          shooting_hits?: number | null
          shooting_intensity?: string | null
          shooting_sets?: Json
          shooting_shots?: number | null
          slot: Database["public"]["Enums"]["day_slot"]
          sport: Database["public"]["Enums"]["sport_kind"]
          strava_activity_id?: string | null
          updated_at?: string
          zone?: Database["public"]["Enums"]["intensity_zone"]
        }
        Update: {
          athlete_id?: string
          avg_heart_rate?: number | null
          block_date?: string
          created_at?: string
          distance_km?: number | null
          duration_minutes?: number
          id?: string
          notes?: string | null
          plan_or_real?: Database["public"]["Enums"]["plan_real"]
          rpe?: number | null
          segments?: Json
          shooting_hits?: number | null
          shooting_intensity?: string | null
          shooting_sets?: Json
          shooting_shots?: number | null
          slot?: Database["public"]["Enums"]["day_slot"]
          sport?: Database["public"]["Enums"]["sport_kind"]
          strava_activity_id?: string | null
          updated_at?: string
          zone?: Database["public"]["Enums"]["intensity_zone"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_meta: {
        Row: {
          athlete_id: string
          created_at: string
          data: Json
          id: string
          iso_week: number
          iso_year: number
          plan_or_real: Database["public"]["Enums"]["plan_real"]
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          data?: Json
          id?: string
          iso_week: number
          iso_year: number
          plan_or_real?: Database["public"]["Enums"]["plan_real"]
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          data?: Json
          id?: string
          iso_week?: number
          iso_year?: number
          plan_or_real?: Database["public"]["Enums"]["plan_real"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_linked_coach: {
        Args: { _athlete_id: string; _coach_id: string }
        Returns: boolean
      }
      lookup_coach_invite: {
        Args: { _token: string }
        Returns: {
          athlete_id: string
          coach_email: string
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["invite_status"]
        }[]
      }
      redeem_coach_invite: { Args: { _token: string }; Returns: Json }
      reload_public_schema_cache: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "athlete" | "coach"
      day_slot: "rano" | "dopoledne" | "odpoledne"
      event_type: "zavod" | "soustredeni" | "volno"
      intensity_zone: "VOLNA" | "I1" | "I2" | "I3" | "I4" | "I5" | "I6"
      invite_status: "pending" | "accepted" | "revoked" | "expired"
      plan_real: "plan" | "real"
      sport_kind:
        | "beh"
        | "kolo"
        | "kolobezka_lyze"
        | "lyze"
        | "ostatni"
        | "strelba"
        | "osi"
        | "plavani"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["athlete", "coach"],
      day_slot: ["rano", "dopoledne", "odpoledne"],
      event_type: ["zavod", "soustredeni", "volno"],
      intensity_zone: ["VOLNA", "I1", "I2", "I3", "I4", "I5", "I6"],
      invite_status: ["pending", "accepted", "revoked", "expired"],
      plan_real: ["plan", "real"],
      sport_kind: [
        "beh",
        "kolo",
        "kolobezka_lyze",
        "lyze",
        "ostatni",
        "strelba",
        "osi",
        "plavani",
      ],
    },
  },
} as const
