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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          description: string | null
          endDate: string | null
          id: string
          profileId: string
          role: string
          startDate: string
          title: string
        }
        Insert: {
          description?: string | null
          endDate?: string | null
          id: string
          profileId: string
          role: string
          startDate: string
          title: string
        }
        Update: {
          description?: string | null
          endDate?: string | null
          id?: string
          profileId?: string
          role?: string
          startDate?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_profileId_fkey"
            columns: ["profileId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      careers: {
        Row: {
          companyName: string
          description: string | null
          endDate: string | null
          id: string
          profileId: string
          role: string
          startDate: string
        }
        Insert: {
          companyName: string
          description?: string | null
          endDate?: string | null
          id: string
          profileId: string
          role: string
          startDate: string
        }
        Update: {
          companyName?: string
          description?: string | null
          endDate?: string | null
          id?: string
          profileId?: string
          role?: string
          startDate?: string
        }
        Relationships: [
          {
            foreignKeyName: "careers_profileId_fkey"
            columns: ["profileId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          acquiredDate: string
          id: string
          name: string
          profileId: string
        }
        Insert: {
          acquiredDate: string
          id: string
          name: string
          profileId: string
        }
        Update: {
          acquiredDate?: string
          id?: string
          name?: string
          profileId?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_profileId_fkey"
            columns: ["profileId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      educations: {
        Row: {
          endDate: string | null
          graduationStatus: string
          id: string
          major: string
          profileId: string
          schoolName: string
          startDate: string
        }
        Insert: {
          endDate?: string | null
          graduationStatus: string
          id: string
          major: string
          profileId: string
          schoolName: string
          startDate: string
        }
        Update: {
          endDate?: string | null
          graduationStatus?: string
          id?: string
          major?: string
          profileId?: string
          schoolName?: string
          startDate?: string
        }
        Relationships: [
          {
            foreignKeyName: "educations_profileId_fkey"
            columns: ["profileId"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_sessions: {
        Row: {
          createdAt: string
          expiresAt: string
          id: string
          sessionToken: string
        }
        Insert: {
          createdAt?: string
          expiresAt: string
          id: string
          sessionToken: string
        }
        Update: {
          createdAt?: string
          expiresAt?: string
          id?: string
          sessionToken?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          createdAt: string
          id: string
          preferredQuals: string | null
          requirements: string | null
          responsibilities: string | null
          sessionId: string
          sourceType: string
          sourceUrl: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          preferredQuals?: string | null
          requirements?: string | null
          responsibilities?: string | null
          sessionId: string
          sourceType: string
          sourceUrl?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          id?: string
          preferredQuals?: string | null
          requirements?: string | null
          responsibilities?: string | null
          sessionId?: string
          sourceType?: string
          sourceUrl?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_postings_sessionId_fkey"
            columns: ["sessionId"]
            isOneToOne: false
            referencedRelation: "guest_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          createdAt: string
          id: string
          name: string
          sessionId: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id: string
          name: string
          sessionId: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          sessionId?: string
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_sessionId_fkey"
            columns: ["sessionId"]
            isOneToOne: true
            referencedRelation: "guest_sessions"
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
