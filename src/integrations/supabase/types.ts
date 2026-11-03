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
      difficulty_presets: {
        Row: {
          params: Json
          regime: Database["public"]["Enums"]["preset_regime"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          params: Json
          regime: Database["public"]["Enums"]["preset_regime"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          params?: Json
          regime?: Database["public"]["Enums"]["preset_regime"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          nickname: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          nickname?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          nickname?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      game_sessions: {
        Row: {
          ended_at: string | null
          ended_reason: string | null
          id: string
          locale: string | null
          nickname: string
          params: Json
          pointer_coarse: boolean | null
          regime: string
          started_at: string
          totals: Json | null
          user_agent: string | null
          user_id: string
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          locale?: string | null
          nickname: string
          params: Json
          pointer_coarse?: boolean | null
          regime: string
          started_at?: string
          totals?: Json | null
          user_agent?: string | null
          user_id: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          ended_at?: string | null
          ended_reason?: string | null
          id?: string
          locale?: string | null
          nickname?: string
          params?: Json
          pointer_coarse?: boolean | null
          regime?: string
          started_at?: string
          totals?: Json | null
          user_agent?: string | null
          user_id?: string
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number
          created_at: string
          date_of_birth: string | null
          id: string
          nickname: string
        }
        Insert: {
          age: number
          created_at?: string
          date_of_birth?: string | null
          id: string
          nickname: string
        }
        Update: {
          age?: number
          created_at?: string
          date_of_birth?: string | null
          id?: string
          nickname?: string
        }
        Relationships: []
      }
      round_events: {
        Row: {
          created_at: string
          id: string
          money_balance: number
          money_earned: number
          money_lost: number
          outcome: string
          round_number: number
          scene: string | null
          session_id: string
          time_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          money_balance?: number
          money_earned?: number
          money_lost?: number
          outcome: string
          round_number: number
          scene?: string | null
          session_id: string
          time_ms: number
        }
        Update: {
          created_at?: string
          id?: string
          money_balance?: number
          money_earned?: number
          money_lost?: number
          outcome?: string
          round_number?: number
          scene?: string | null
          session_id?: string
          time_ms?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      t3_ranges: {
        Row: {
          id: number
          params_max: Json
          params_min: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          params_max: Json
          params_min: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          params_max?: Json
          params_min?: Json
          updated_at?: string
          updated_by?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      preset_regime: "T1_easy" | "T1_medium" | "T1_hard"
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
      preset_regime: ["T1_easy", "T1_medium", "T1_hard"],
    },
  },
} as const
