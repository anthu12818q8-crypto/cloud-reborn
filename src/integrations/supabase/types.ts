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
      auth_rate_limits: {
        Row: {
          attempt_count: number | null
          blocked_until: string | null
          created_at: string | null
          endpoint: string
          first_attempt_at: string | null
          id: string
          ip_address: unknown
          last_attempt_at: string | null
        }
        Insert: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          endpoint: string
          first_attempt_at?: string | null
          id?: string
          ip_address: unknown
          last_attempt_at?: string | null
        }
        Update: {
          attempt_count?: number | null
          blocked_until?: string | null
          created_at?: string | null
          endpoint?: string
          first_attempt_at?: string | null
          id?: string
          ip_address?: unknown
          last_attempt_at?: string | null
        }
        Relationships: []
      }
      blocked_devices: {
        Row: {
          blocked_by: string | null
          created_at: string
          fingerprint: string
          id: string
          ip_address: unknown
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          fingerprint: string
          id?: string
          ip_address?: unknown
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          fingerprint?: string
          id?: string
          ip_address?: unknown
          reason?: string | null
        }
        Relationships: []
      }
      blocked_ips: {
        Row: {
          blocked_by: string | null
          created_at: string
          id: string
          ip_address: unknown
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip_address: unknown
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          created_at?: string
          id?: string
          ip_address?: unknown
          reason?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          movie_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          movie_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          movie_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      device_registrations: {
        Row: {
          created_at: string | null
          device_hash: string
          id: string
          ip_address: unknown
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_hash: string
          id?: string
          ip_address?: unknown
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_hash?: string
          id?: string
          ip_address?: unknown
          user_id?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          created_at: string
          duration: number | null
          episode_number: number
          id: string
          movie_id: string
          title: string | null
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          episode_number: number
          id?: string
          movie_id: string
          title?: string | null
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          episode_number?: number
          id?: string
          movie_id?: string
          title?: string | null
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          movie_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movie_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          movie_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempt_count: number
          attempt_type: string
          blocked_until: string | null
          created_at: string
          fingerprint: string
          first_attempt_at: string
          id: string
          ip_address: unknown
          last_attempt_at: string
          last_violation_date: string | null
          lock_level: number | null
          total_violations: number | null
        }
        Insert: {
          attempt_count?: number
          attempt_type?: string
          blocked_until?: string | null
          created_at?: string
          fingerprint: string
          first_attempt_at?: string
          id?: string
          ip_address?: unknown
          last_attempt_at?: string
          last_violation_date?: string | null
          lock_level?: number | null
          total_violations?: number | null
        }
        Update: {
          attempt_count?: number
          attempt_type?: string
          blocked_until?: string | null
          created_at?: string
          fingerprint?: string
          first_attempt_at?: string
          id?: string
          ip_address?: unknown
          last_attempt_at?: string
          last_violation_date?: string | null
          lock_level?: number | null
          total_violations?: number | null
        }
        Relationships: []
      }
      movies: {
        Row: {
          actors: string[] | null
          ad_enabled: boolean | null
          ad_position: string | null
          ad_show_on_load: boolean | null
          ad_video_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          director: string | null
          display_order: number | null
          duration: number | null
          episode_count: number | null
          genre: string[] | null
          has_episodes: boolean | null
          id: string
          imdb_rating: number | null
          intro_end_seconds: number | null
          intro_start_seconds: number | null
          is_featured: boolean | null
          payment_amount: number | null
          payment_image_url: string | null
          poster_url: string | null
          release_year: number | null
          requires_payment: boolean | null
          title: string
          updated_at: string
          video_url: string | null
          view_count: number | null
        }
        Insert: {
          actors?: string[] | null
          ad_enabled?: boolean | null
          ad_position?: string | null
          ad_show_on_load?: boolean | null
          ad_video_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          director?: string | null
          display_order?: number | null
          duration?: number | null
          episode_count?: number | null
          genre?: string[] | null
          has_episodes?: boolean | null
          id?: string
          imdb_rating?: number | null
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          is_featured?: boolean | null
          payment_amount?: number | null
          payment_image_url?: string | null
          poster_url?: string | null
          release_year?: number | null
          requires_payment?: boolean | null
          title: string
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Update: {
          actors?: string[] | null
          ad_enabled?: boolean | null
          ad_position?: string | null
          ad_show_on_load?: boolean | null
          ad_video_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          director?: string | null
          display_order?: number | null
          duration?: number | null
          episode_count?: number | null
          genre?: string[] | null
          has_episodes?: boolean | null
          id?: string
          imdb_rating?: number | null
          intro_end_seconds?: number | null
          intro_start_seconds?: number | null
          is_featured?: boolean | null
          payment_amount?: number | null
          payment_image_url?: string | null
          poster_url?: string | null
          release_year?: number | null
          requires_payment?: boolean | null
          title?: string
          updated_at?: string
          video_url?: string | null
          view_count?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_complaints: {
        Row: {
          admin_response: string | null
          created_at: string
          id: string
          image_url: string | null
          payment_request_id: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          payment_request_id: string
          reason: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          payment_request_id?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_complaints_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          admin_id: string | null
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          movie_id: string
          proof_image_url: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          movie_id: string
          proof_image_url: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          movie_id?: string
          proof_image_url?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_device_info: {
        Row: {
          created_at: string
          fingerprint: string
          id: string
          ip_address: unknown
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          id?: string
          ip_address?: unknown
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      watch_history: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          last_watched_at: string
          movie_id: string
          progress_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string
          movie_id: string
          progress_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          last_watched_at?: string
          movie_id?: string
          progress_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watch_history_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "movies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_movie: { Args: { p_movie_id: string }; Returns: boolean }
      check_device_registration_limit: {
        Args: { p_device_hash: string; p_max_accounts?: number }
        Returns: Json
      }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      detect_suspicious_activity: {
        Args: { p_device_hash: string; p_ip_address?: unknown }
        Returns: Json
      }
      get_ad_playback_url: { Args: { p_movie_id: string }; Returns: string }
      get_playback_url: {
        Args: { p_episode_number?: number; p_movie_id: string }
        Returns: string
      }
      has_paid_for_movie: {
        Args: { p_movie_id: string; p_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_device_blocked: {
        Args: { p_fingerprint: string; p_ip_address?: unknown }
        Returns: boolean
      }
      is_first_user: { Args: never; Returns: boolean }
      is_rate_limited: {
        Args: {
          p_block_minutes?: number
          p_endpoint: string
          p_ip_address: unknown
          p_max_attempts?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      is_vip: { Args: never; Returns: boolean }
      log_security_event: {
        Args: {
          p_action: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: undefined
      }
      register_device_account: {
        Args: {
          p_device_hash: string
          p_ip_address?: unknown
          p_user_id: string
        }
        Returns: undefined
      }
      server_check_auth_attempt: {
        Args: {
          p_attempt_type?: string
          p_device_hash: string
          p_ip_address?: unknown
          p_is_success?: boolean
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
