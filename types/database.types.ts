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
      game_catalog: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          max_players: number
          min_players: number
          name: string
          slug: string
          supports_single_player: boolean
          supports_teams: boolean
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          max_players?: number
          min_players?: number
          name: string
          slug: string
          supports_single_player?: boolean
          supports_teams?: boolean
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          max_players?: number
          min_players?: number
          name?: string
          slug?: string
          supports_single_player?: boolean
          supports_teams?: boolean
        }
        Relationships: []
      }
      game_history: {
        Row: {
          final_score: number
          game_id: string
          id: string
          placement: number | null
          played_at: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          final_score?: number
          game_id: string
          id?: string
          placement?: number | null
          played_at?: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          final_score?: number
          game_id?: string
          id?: string
          placement?: number | null
          played_at?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_history_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_leaderboard: {
        Row: {
          best_score: number
          game_id: string
          games_played: number
          games_won: number
          id: string
          last_played: string
          total_score: number
          user_id: string
        }
        Insert: {
          best_score?: number
          game_id: string
          games_played?: number
          games_won?: number
          id?: string
          last_played?: string
          total_score?: number
          user_id: string
        }
        Update: {
          best_score?: number
          game_id?: string
          games_played?: number
          games_won?: number
          id?: string
          last_played?: string
          total_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_leaderboard_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      game_players: {
        Row: {
          avatar_url: string | null
          display_name: string
          game_role: string | null
          guest_token: string | null
          id: string
          is_connected: boolean
          joined_at: string
          left_at: string | null
          role: string
          room_id: string
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name: string
          game_role?: string | null
          guest_token?: string | null
          id?: string
          is_connected?: boolean
          joined_at?: string
          left_at?: string | null
          role?: string
          room_id: string
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string
          game_role?: string | null
          guest_token?: string | null
          id?: string
          is_connected?: boolean
          joined_at?: string
          left_at?: string | null
          role?: string
          room_id?: string
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          created_at: string
          expires_at: string
          finished_at: string | null
          game_id: string
          host_id: string | null
          id: string
          is_public: boolean
          max_players: number
          room_code: string
          settings: Json
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          finished_at?: string | null
          game_id: string
          host_id?: string | null
          id?: string
          is_public?: boolean
          max_players?: number
          room_code: string
          settings?: Json
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          finished_at?: string | null
          game_id?: string
          host_id?: string | null
          id?: string
          is_public?: boolean
          max_players?: number
          room_code?: string
          settings?: Json
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      game_scores: {
        Row: {
          id: string
          metadata: Json | null
          player_id: string
          points: number
          room_id: string
          round_number: number | null
          scored_at: string
        }
        Insert: {
          id?: string
          metadata?: Json | null
          player_id: string
          points?: number
          room_id: string
          round_number?: number | null
          scored_at?: string
        }
        Update: {
          id?: string
          metadata?: Json | null
          player_id?: string
          points?: number
          room_id?: string
          round_number?: number | null
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_scores_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_scores_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_state: {
        Row: {
          current_round: number
          id: string
          room_id: string
          state_data: Json
          total_rounds: number
          updated_at: string
        }
        Insert: {
          current_round?: number
          id?: string
          room_id: string
          state_data?: Json
          total_rounds?: number
          updated_at?: string
        }
        Update: {
          current_round?: number
          id?: string
          room_id?: string
          state_data?: Json
          total_rounds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_state_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_words: {
        Row: {
          category: string
          created_at: string
          difficulty: string
          game_slug: string
          id: string
          last_used_at: string | null
          point_value: number
          used_count: number
          word: string
        }
        Insert: {
          category?: string
          created_at?: string
          difficulty?: string
          game_slug: string
          id?: string
          last_used_at?: string | null
          point_value?: number
          used_count?: number
          word: string
        }
        Update: {
          category?: string
          created_at?: string
          difficulty?: string
          game_slug?: string
          id?: string
          last_used_at?: string | null
          point_value?: number
          used_count?: number
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_word_used_count: {
        Args: { new_last_used_at: string; word_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
