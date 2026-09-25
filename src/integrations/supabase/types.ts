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
      answers: {
        Row: {
          answer_text: string
          attempt_number: number
          created_at: string
          id: string
          question_id: string
          speaking_seconds: number | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          answer_text?: string
          attempt_number?: number
          created_at?: string
          id?: string
          question_id: string
          speaking_seconds?: number | null
          user_id?: string
          word_count?: number | null
        }
        Update: {
          answer_text?: string
          attempt_number?: number
          created_at?: string
          id?: string
          question_id?: string
          speaking_seconds?: number | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          answer_id: string
          created_at: string
          gaps: Json
          id: string
          model_answer: string | null
          score: number | null
          strengths: Json
        }
        Insert: {
          answer_id: string
          created_at?: string
          gaps?: Json
          id?: string
          model_answer?: string | null
          score?: number | null
          strengths?: Json
        }
        Update: {
          answer_id?: string
          created_at?: string
          gaps?: Json
          id?: string
          model_answer?: string | null
          score?: number | null
          strengths?: Json
        }
        Relationships: [
          {
            foreignKeyName: "feedback_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "answers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          asked_at: string | null
          difficulty: string | null
          id: string
          order_index: number
          session_id: string
          text: string
          type: string | null
        }
        Insert: {
          asked_at?: string | null
          difficulty?: string | null
          id?: string
          order_index?: number
          session_id: string
          text: string
          type?: string | null
        }
        Update: {
          asked_at?: string | null
          difficulty?: string | null
          id?: string
          order_index?: number
          session_id?: string
          text?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          created_at: string
          extracted_text: string | null
          file_name: string | null
          file_url: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      session_reports: {
        Row: {
          communication: Json
          created_at: string
          id: string
          jd_fit_summary: string | null
          overall_score: number | null
          session_id: string
          strengths: Json
          top_3_actions: Json
          verdict_line: string | null
          weaknesses: Json
          what_didnt_work: Json
          what_worked: Json
        }
        Insert: {
          communication?: Json
          created_at?: string
          id?: string
          jd_fit_summary?: string | null
          overall_score?: number | null
          session_id: string
          strengths?: Json
          top_3_actions?: Json
          verdict_line?: string | null
          weaknesses?: Json
          what_didnt_work?: Json
          what_worked?: Json
        }
        Update: {
          communication?: Json
          created_at?: string
          id?: string
          jd_fit_summary?: string | null
          overall_score?: number | null
          session_id?: string
          strengths?: Json
          top_3_actions?: Json
          verdict_line?: string | null
          weaknesses?: Json
          what_didnt_work?: Json
          what_worked?: Json
        }
        Relationships: [
          {
            foreignKeyName: "session_reports_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          candidate_first_name: string | null
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          gap_map: Json
          id: string
          jd_text: string
          mode: string
          resume_id: string | null
          role_title: string
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          candidate_first_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          gap_map?: Json
          id?: string
          jd_text?: string
          mode?: string
          resume_id?: string | null
          role_title: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          candidate_first_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          gap_map?: Json
          id?: string
          jd_text?: string
          mode?: string
          resume_id?: string | null
          role_title?: string
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      turns: {
        Row: {
          ended_at: string | null
          id: string
          is_followup: boolean
          question_id: string | null
          session_id: string
          speaker: string
          started_at: string
          text: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          is_followup?: boolean
          question_id?: string | null
          session_id: string
          speaker: string
          started_at?: string
          text?: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          is_followup?: boolean
          question_id?: string | null
          session_id?: string
          speaker?: string
          started_at?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "turns_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turns_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
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
