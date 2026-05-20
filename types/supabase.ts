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
          grade: string | null
          id: string
          name: string
          profileId: string
        }
        Insert: {
          grade?: string | null
          id: string
          name: string
          profileId: string
        }
        Update: {
          grade?: string | null
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
      company_cache: {
        Row: {
          businessOverview: string | null
          ceoName: string | null
          collectedAt: string
          companyName: string
          employeeSummary: string | null
          financialSummary: string | null
          foundedYear: string | null
          id: string
          industrySector: string | null
          isListed: boolean
          listingStatus: string | null
          mainProducts: string | null
          recentDisclosures: string | null
        }
        Insert: {
          businessOverview?: string | null
          ceoName?: string | null
          collectedAt?: string
          companyName: string
          employeeSummary?: string | null
          financialSummary?: string | null
          foundedYear?: string | null
          id?: string
          industrySector?: string | null
          isListed?: boolean
          listingStatus?: string | null
          mainProducts?: string | null
          recentDisclosures?: string | null
        }
        Update: {
          businessOverview?: string | null
          ceoName?: string | null
          collectedAt?: string
          companyName?: string
          employeeSummary?: string | null
          financialSummary?: string | null
          foundedYear?: string | null
          id?: string
          industrySector?: string | null
          isListed?: boolean
          listingStatus?: string | null
          mainProducts?: string | null
          recentDisclosures?: string | null
        }
        Relationships: []
      }
      company_info: {
        Row: {
          collectedAt: string
          companyCacheId: string | null
          companyName: string
          id: string
          isListed: boolean
          jobPostingId: string
        }
        Insert: {
          collectedAt?: string
          companyCacheId?: string | null
          companyName: string
          id?: string
          isListed?: boolean
          jobPostingId: string
        }
        Update: {
          collectedAt?: string
          companyCacheId?: string | null
          companyName?: string
          id?: string
          isListed?: boolean
          jobPostingId?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_info_companyCacheId_fkey"
            columns: ["companyCacheId"]
            isOneToOne: false
            referencedRelation: "company_cache"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_info_jobPostingId_fkey"
            columns: ["jobPostingId"]
            isOneToOne: true
            referencedRelation: "job_postings"
            referencedColumns: ["id"]
          },
        ]
      }
      dart_corps: {
        Row: {
          corp_code: string
          corp_name: string
          modify_date: string | null
          stock_code: string | null
        }
        Insert: {
          corp_code: string
          corp_name: string
          modify_date?: string | null
          stock_code?: string | null
        }
        Update: {
          corp_code?: string
          corp_name?: string
          modify_date?: string | null
          stock_code?: string | null
        }
        Relationships: []
      }
      educations: {
        Row: {
          degree: string | null
          endDate: string | null
          graduationStatus: string
          id: string
          major: string
          profileId: string
          schoolName: string
          startDate: string
        }
        Insert: {
          degree?: string | null
          endDate?: string | null
          graduationStatus: string
          id: string
          major: string
          profileId: string
          schoolName: string
          startDate: string
        }
        Update: {
          degree?: string | null
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
      interview_sessions: {
        Row: {
          agentEvaluations: Json | null
          agentFinalOpinions: Json | null
          agentRebuttals: Json | null
          createdAt: string | null
          debateReplies: Json | null
          debateSummary: string | null
          difficulty: string
          errorMessage: string | null
          finalFeedback: Json | null
          finalScore: number | null
          id: string
          improvementTips: Json | null
          jobPostingId: string | null
          messages: Json
          status: string
          updatedAt: string | null
          userId: string
        }
        Insert: {
          agentEvaluations?: Json | null
          agentFinalOpinions?: Json | null
          agentRebuttals?: Json | null
          createdAt?: string | null
          debateReplies?: Json | null
          debateSummary?: string | null
          difficulty: string
          errorMessage?: string | null
          finalFeedback?: Json | null
          finalScore?: number | null
          id: string
          improvementTips?: Json | null
          jobPostingId?: string | null
          messages: Json
          status?: string
          updatedAt?: string | null
          userId: string
        }
        Update: {
          agentEvaluations?: Json | null
          agentFinalOpinions?: Json | null
          agentRebuttals?: Json | null
          createdAt?: string | null
          debateReplies?: Json | null
          debateSummary?: string | null
          difficulty?: string
          errorMessage?: string | null
          finalFeedback?: Json | null
          finalScore?: number | null
          id?: string
          improvementTips?: Json | null
          jobPostingId?: string | null
          messages?: Json
          status?: string
          updatedAt?: string | null
          userId?: string
        }
        Relationships: []
      }
      job_postings: {
        Row: {
          companyCulture: string | null
          companyDescription: string | null
          companyName: string | null
          createdAt: string
          divisionName: string | null
          id: string
          isITCompany: boolean
          preferredQuals: string | null
          requirements: string | null
          responsibilities: string | null
          sourceType: string
          sourceUrl: string | null
          techStack: string | null
          updatedAt: string
          userId: string
        }
        Insert: {
          companyCulture?: string | null
          companyDescription?: string | null
          companyName?: string | null
          createdAt?: string
          divisionName?: string | null
          id: string
          isITCompany?: boolean
          preferredQuals?: string | null
          requirements?: string | null
          responsibilities?: string | null
          sourceType: string
          sourceUrl?: string | null
          techStack?: string | null
          updatedAt?: string
          userId: string
        }
        Update: {
          companyCulture?: string | null
          companyDescription?: string | null
          companyName?: string | null
          createdAt?: string
          divisionName?: string | null
          id?: string
          isITCompany?: boolean
          preferredQuals?: string | null
          requirements?: string | null
          responsibilities?: string | null
          sourceType?: string
          sourceUrl?: string | null
          techStack?: string | null
          updatedAt?: string
          userId?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          createdAt: string
          id: string
          name: string
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          id: string
          name: string
          updatedAt?: string
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          name?: string
          updatedAt?: string
          userId?: string
        }
        Relationships: []
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
