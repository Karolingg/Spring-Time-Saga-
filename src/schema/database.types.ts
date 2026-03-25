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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      "aggregated run": {
        Row: {
          created_at: string
          id: number
          simrun_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          simrun_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          simrun_id?: string | null
        }
        Relationships: []
      }
      density_cells: {
        Row: {
          cell_x: number
          cell_y: number
          id: string
          peak_density: number
          run_id: string
          step: number
        }
        Insert: {
          cell_x: number
          cell_y: number
          id?: string
          peak_density: number
          run_id: string
          step: number
        }
        Update: {
          cell_x?: number
          cell_y?: number
          id?: string
          peak_density?: number
          run_id?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "density_cells_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      simulation_bottlenecks: {
        Row: {
          cell_x: number | null
          cell_y: number | null
          description: string | null
          id: string
          run_id: string
          severity: string
          zone_name: string
        }
        Insert: {
          cell_x?: number | null
          cell_y?: number | null
          description?: string | null
          id?: string
          run_id: string
          severity: string
          zone_name: string
        }
        Update: {
          cell_x?: number | null
          cell_y?: number | null
          description?: string | null
          id?: string
          run_id?: string
          severity?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_bottlenecks_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_configs: {
        Row: {
          agent_count: number
          exit_count: number
          grid_height: number
          grid_width: number
          id: string
          run_id: string
          speed_ms: number
          wall_density: number
        }
        Insert: {
          agent_count: number
          exit_count: number
          grid_height: number
          grid_width: number
          id?: string
          run_id: string
          speed_ms: number
          wall_density: number
        }
        Update: {
          agent_count?: number
          exit_count?: number
          grid_height?: number
          grid_width?: number
          id?: string
          run_id?: string
          speed_ms?: number
          wall_density?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_configs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_results: {
        Row: {
          congestion_exposure: number
          evacuated_count: number
          evacuation_time: number
          global_peak_density: number
          id: string
          max_congestion: number
          run_id: string
          total_steps: number
        }
        Insert: {
          congestion_exposure: number
          evacuated_count: number
          evacuation_time: number
          global_peak_density: number
          id?: string
          max_congestion: number
          run_id: string
          total_steps: number
        }
        Update: {
          congestion_exposure?: number
          evacuated_count?: number
          evacuation_time?: number
          global_peak_density?: number
          id?: string
          max_congestion?: number
          run_id?: string
          total_steps?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_results_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          created_at: string
          disaster_type: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disaster_type: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disaster_type?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_zones: {
        Row: {
          agent_count: number
          bottleneck_count: number
          id: string
          intensity: number
          lat: number | null
          lng: number | null
          risk_level: string
          run_id: string
          zone_name: string
        }
        Insert: {
          agent_count: number
          bottleneck_count: number
          id?: string
          intensity: number
          lat?: number | null
          lng?: number | null
          risk_level: string
          run_id: string
          zone_name: string
        }
        Update: {
          agent_count?: number
          bottleneck_count?: number
          id?: string
          intensity?: number
          lat?: number | null
          lng?: number | null
          risk_level?: string
          run_id?: string
          zone_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_zones_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "simulation_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const