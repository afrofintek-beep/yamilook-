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
      academia_attendance: {
        Row: { session_id: string; user_id: string; confirmed_by: string; confirmed_at: string }
        Insert: { session_id: string; user_id: string; confirmed_by: string; confirmed_at?: string }
        Update: { session_id?: string; user_id?: string; confirmed_by?: string; confirmed_at?: string }
        Relationships: []
      }
      academia_mentor_audit: {
        Row: { id: string; mentor_id: string; actor_id: string | null; action: string; reason: string | null; created_at: string }
        Insert: { id?: string; mentor_id: string; actor_id?: string | null; action: string; reason?: string | null; created_at?: string }
        Update: { reason?: string | null }
        Relationships: []
      }

      academia_communities: {
        Row: { slug: string; title: string; description: string; position: number; starter_title: string; starter_instructions: string; starter_skill: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_cohorts: {
        Row: { id: string; community_slug: string; mentor_id: string; mentor_name: string; title: string; level: string; language: string; locality: string; requirements: string; plan: string; challenge_title: string; instructions: string; skill: string; capacity: number; seats_taken: number; status: string; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_public_works: {
        Row: { id: string; community_slug: string; cohort_id: string | null; title: string; skill: string; caption: string; learner_name: string; mentor_name: string; evidence_url: string | null; published: boolean; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_work_sources: {
        Row: { work_id: string; challenge_id: string; owner_id: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_cohort_members: {
        Row: { id: string; cohort_id: string; learner_id: string; goal_id: string; source_work_id: string | null; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_community_audit: {
        Row: { id: string; actor_id: string; action: string; cohort_id: string | null; work_id: string | null; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_goals: {
        Row: { id: string; learner_id: string; mentor_id: string; title: string; context: string; plan: string; closure_reason: string; status: string; created_at: string; updated_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_challenges: {
        Row: { id: string; goal_id: string; position: number; title: string; instructions: string; skill: string; status: string; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_submissions: {
        Row: { id: string; challenge_id: string; content: string; evidence_url: string | null; status: string; feedback: string; created_at: string; reviewed_at: string | null }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_learning_audit: {
        Row: { id: string; goal_id: string; actor_id: string; action: string; entity_id: string; created_at: string }
        Insert: never
        Update: never
        Relationships: []
      }
      academia_reservations: {
        Row: {
          created_at: string
          id: string
          price_paid: number
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_paid?: number
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price_paid?: number
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_reservations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academia_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          mentor_id: string
          rating: number
          reviewer_id: string
          session_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          mentor_id: string
          rating: number
          reviewer_id: string
          session_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          mentor_id?: string
          rating?: number
          reviewer_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_reviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academia_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      academia_sessions: {
        Row: {
          duration_minutes: number
          started_at: string | null
          ended_at: string | null
          archived_at: string | null
          deleted_at: string | null
          cancellation_reason: string | null
          banda_id: string | null
          created_at: string
          description: string | null
          format: string
          id: string
          mentor_id: string
          price_coins: number
          scheduled_at: string
          spots: number
          spots_left: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          duration_minutes?: number
          started_at?: string | null
          ended_at?: string | null
          archived_at?: string | null
          deleted_at?: string | null
          cancellation_reason?: string | null
          banda_id?: string | null
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          mentor_id: string
          price_coins?: number
          scheduled_at: string
          spots?: number
          spots_left?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          duration_minutes?: number
          started_at?: string | null
          ended_at?: string | null
          archived_at?: string | null
          deleted_at?: string | null
          cancellation_reason?: string | null
          banda_id?: string | null
          created_at?: string
          description?: string | null
          format?: string
          id?: string
          mentor_id?: string
          price_coins?: number
          scheduled_at?: string
          spots?: number
          spots_left?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academia_sessions_banda_id_fkey"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_clicks: {
        Row: {
          ad_id: string
          click_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          ad_id: string
          click_type?: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          ad_id?: string
          click_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_clicks_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_daily_stats: {
        Row: {
          ad_id: string
          city: string | null
          clicks: number | null
          created_at: string | null
          credits_spent: number | null
          id: string
          impressions: number | null
          market_id: string | null
          neighborhood: string | null
          stat_date: string
          unique_viewers: number | null
          updated_at: string | null
        }
        Insert: {
          ad_id: string
          city?: string | null
          clicks?: number | null
          created_at?: string | null
          credits_spent?: number | null
          id?: string
          impressions?: number | null
          market_id?: string | null
          neighborhood?: string | null
          stat_date?: string
          unique_viewers?: number | null
          updated_at?: string | null
        }
        Update: {
          ad_id?: string
          city?: string | null
          clicks?: number | null
          created_at?: string | null
          credits_spent?: number | null
          id?: string
          impressions?: number | null
          market_id?: string | null
          neighborhood?: string | null
          stat_date?: string
          unique_viewers?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_daily_stats_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_daily_stats_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "location_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_impressions: {
        Row: {
          ad_id: string
          city: string | null
          created_at: string
          id: string
          impression_type: string
          market_id: string | null
          neighborhood: string | null
          user_id: string
        }
        Insert: {
          ad_id: string
          city?: string | null
          created_at?: string
          id?: string
          impression_type?: string
          market_id?: string | null
          neighborhood?: string | null
          user_id: string
        }
        Update: {
          ad_id?: string
          city?: string | null
          created_at?: string
          id?: string
          impression_type?: string
          market_id?: string | null
          neighborhood?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_impressions_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "advertisements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_impressions_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "location_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      administrative_divisions: {
        Row: {
          code: string
          country_code: string
          created_at: string | null
          id: string
          level: number
          metadata: Json | null
          name: string
          name_norm: string | null
          parent_code: string | null
          parent_level: number | null
        }
        Insert: {
          code: string
          country_code: string
          created_at?: string | null
          id?: string
          level: number
          metadata?: Json | null
          name: string
          name_norm?: string | null
          parent_code?: string | null
          parent_level?: number | null
        }
        Update: {
          code?: string
          country_code?: string
          created_at?: string | null
          id?: string
          level?: number
          metadata?: Json | null
          name?: string
          name_norm?: string | null
          parent_code?: string | null
          parent_level?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "administrative_divisions_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "afroloc_countries"
            referencedColumns: ["iso"]
          },
        ]
      }
      advertisements: {
        Row: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          business_id: string
          call_to_action: string | null
          clicks: number | null
          cost_per_click: number | null
          cost_per_impression: number | null
          created_at: string
          cta_url: string | null
          daily_budget: number
          description: string | null
          ends_at: string | null
          engagement_count: number | null
          id: string
          impressions: number | null
          media_url: string | null
          post_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          spent_credits: number | null
          starts_at: string
          status: Database["public"]["Enums"]["ad_status"]
          target_age_max: number | null
          target_age_min: number | null
          target_city: string | null
          target_gender: string[] | null
          target_market_id: string | null
          target_neighborhood: string | null
          title: string | null
          total_budget: number
          updated_at: string
        }
        Insert: {
          ad_type: Database["public"]["Enums"]["ad_type"]
          business_id: string
          call_to_action?: string | null
          clicks?: number | null
          cost_per_click?: number | null
          cost_per_impression?: number | null
          created_at?: string
          cta_url?: string | null
          daily_budget?: number
          description?: string | null
          ends_at?: string | null
          engagement_count?: number | null
          id?: string
          impressions?: number | null
          media_url?: string | null
          post_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_credits?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["ad_status"]
          target_age_max?: number | null
          target_age_min?: number | null
          target_city?: string | null
          target_gender?: string[] | null
          target_market_id?: string | null
          target_neighborhood?: string | null
          title?: string | null
          total_budget?: number
          updated_at?: string
        }
        Update: {
          ad_type?: Database["public"]["Enums"]["ad_type"]
          business_id?: string
          call_to_action?: string | null
          clicks?: number | null
          cost_per_click?: number | null
          cost_per_impression?: number | null
          created_at?: string
          cta_url?: string | null
          daily_budget?: number
          description?: string | null
          ends_at?: string | null
          engagement_count?: number | null
          id?: string
          impressions?: number | null
          media_url?: string | null
          post_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          spent_credits?: number | null
          starts_at?: string
          status?: Database["public"]["Enums"]["ad_status"]
          target_age_max?: number | null
          target_age_min?: number | null
          target_city?: string | null
          target_gender?: string[] | null
          target_market_id?: string | null
          target_neighborhood?: string | null
          title?: string | null
          total_budget?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advertisements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisements_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advertisements_target_market_id_fkey"
            columns: ["target_market_id"]
            isOneToOne: false
            referencedRelation: "location_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      afroloc_banda_division: {
        Row: {
          banda_norm: string
          best_effort: boolean
          city: string
          com_slug: string
          country_code: string
          is_municipality: boolean
          mun_slug: string
          prov_seg: string
        }
        Insert: {
          banda_norm: string
          best_effort?: boolean
          city: string
          com_slug: string
          country_code: string
          is_municipality?: boolean
          mun_slug: string
          prov_seg: string
        }
        Update: {
          banda_norm?: string
          best_effort?: boolean
          city?: string
          com_slug?: string
          country_code?: string
          is_municipality?: boolean
          mun_slug?: string
          prov_seg?: string
        }
        Relationships: []
      }
      afroloc_countries: {
        Row: {
          iso: string
          name: string
          nivel1_type: string | null
          official_languages: string[] | null
          spoken_languages: string[] | null
        }
        Insert: {
          iso: string
          name: string
          nivel1_type?: string | null
          official_languages?: string[] | null
          spoken_languages?: string[] | null
        }
        Update: {
          iso?: string
          name?: string
          nivel1_type?: string | null
          official_languages?: string[] | null
          spoken_languages?: string[] | null
        }
        Relationships: []
      }
      bandas: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      billing_config: {
        Row: {
          academia_fee_percent: number
          currency: string
          id: number
          max_video_participants: number
          payout_daily_cap: number
          payout_hold_days: number
          payout_max_per_request: number
          payout_monthly_cap: number
          payout_require_kyc: boolean
          pro_annual: number
          pro_monthly: number
          updated_at: string
          updated_by: string | null
          video_enabled: boolean
          video_minutes_cap: number | null
        }
        Insert: {
          academia_fee_percent?: number
          currency?: string
          id?: number
          max_video_participants?: number
          payout_daily_cap?: number
          payout_hold_days?: number
          payout_max_per_request?: number
          payout_monthly_cap?: number
          payout_require_kyc?: boolean
          pro_annual?: number
          pro_monthly?: number
          updated_at?: string
          updated_by?: string | null
          video_enabled?: boolean
          video_minutes_cap?: number | null
        }
        Update: {
          academia_fee_percent?: number
          currency?: string
          id?: number
          max_video_participants?: number
          payout_daily_cap?: number
          payout_hold_days?: number
          payout_max_per_request?: number
          payout_monthly_cap?: number
          payout_require_kyc?: boolean
          pro_annual?: number
          pro_monthly?: number
          updated_at?: string
          updated_by?: string | null
          video_enabled?: boolean
          video_minutes_cap?: number | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_room_participants: {
        Row: {
          breakout_room_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          breakout_room_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          breakout_room_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakout_room_participants_breakout_room_id_fkey"
            columns: ["breakout_room_id"]
            isOneToOne: false
            referencedRelation: "breakout_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      breakout_rooms: {
        Row: {
          call_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "breakout_rooms_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          address: string | null
          business_category: string | null
          business_name: string
          city: string | null
          cover_image_url: string | null
          created_at: string
          credit_balance: number | null
          default_market_id: string | null
          description: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          neighborhood: string | null
          phone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          business_category?: string | null
          business_name: string
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          credit_balance?: number | null
          default_market_id?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          neighborhood?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          business_category?: string | null
          business_name?: string
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          credit_balance?: number | null
          default_market_id?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          neighborhood?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_default_market_id_fkey"
            columns: ["default_market_id"]
            isOneToOne: false
            referencedRelation: "location_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          created_at: string
          id: string
          is_hand_raised: boolean
          is_muted: boolean
          is_screen_sharing: boolean
          is_spotlight: boolean
          is_video_enabled: boolean
          joined_at: string | null
          left_at: string | null
          role: string
          status: string
          user_id: string
          virtual_background: string | null
        }
        Insert: {
          call_id: string
          created_at?: string
          id?: string
          is_hand_raised?: boolean
          is_muted?: boolean
          is_screen_sharing?: boolean
          is_spotlight?: boolean
          is_video_enabled?: boolean
          joined_at?: string | null
          left_at?: string | null
          role?: string
          status?: string
          user_id: string
          virtual_background?: string | null
        }
        Update: {
          call_id?: string
          created_at?: string
          id?: string
          is_hand_raised?: boolean
          is_muted?: boolean
          is_screen_sharing?: boolean
          is_spotlight?: boolean
          is_video_enabled?: boolean
          joined_at?: string | null
          left_at?: string | null
          role?: string
          status?: string
          user_id?: string
          virtual_background?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reactions: {
        Row: {
          call_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_reactions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          call_id: string
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          file_size_bytes: number | null
          has_transcription: boolean
          id: string
          initiated_by: string
          retention_days: number | null
          status: string
          storage_path: string | null
          transcription_text: string | null
        }
        Insert: {
          call_id: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          has_transcription?: boolean
          id?: string
          initiated_by: string
          retention_days?: number | null
          status?: string
          storage_path?: string | null
          transcription_text?: string | null
        }
        Update: {
          call_id?: string
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          has_transcription?: boolean
          id?: string
          initiated_by?: string
          retention_days?: number | null
          status?: string
          storage_path?: string | null
          transcription_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_signals: {
        Row: {
          call_id: string
          created_at: string
          from_user_id: string
          id: string
          payload: Json | null
          processed: boolean
          signal_type: string
          to_user_id: string
        }
        Insert: {
          call_id: string
          created_at?: string
          from_user_id: string
          id?: string
          payload?: Json | null
          processed?: boolean
          signal_type: string
          to_user_id: string
        }
        Update: {
          call_id?: string
          created_at?: string
          from_user_id?: string
          id?: string
          payload?: Json | null
          processed?: boolean
          signal_type?: string
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_signals_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      call_statistics: {
        Row: {
          audio_quality_score: number | null
          avg_latency_ms: number | null
          avg_resolution: string | null
          bandwidth_kbps: number | null
          call_id: string
          id: string
          packet_loss_percent: number | null
          recorded_at: string
          user_id: string
          video_quality_score: number | null
        }
        Insert: {
          audio_quality_score?: number | null
          avg_latency_ms?: number | null
          avg_resolution?: string | null
          bandwidth_kbps?: number | null
          call_id: string
          id?: string
          packet_loss_percent?: number | null
          recorded_at?: string
          user_id: string
          video_quality_score?: number | null
        }
        Update: {
          audio_quality_score?: number | null
          avg_latency_ms?: number | null
          avg_resolution?: string | null
          bandwidth_kbps?: number | null
          call_id?: string
          id?: string
          packet_loss_percent?: number | null
          recorded_at?: string
          user_id?: string
          video_quality_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_statistics_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string | null
          callee_id: string | null
          caller_id: string | null
          conversation_id: string | null
          created_at: string
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          id: string
          initiator_id: string
          is_group_call: boolean
          is_locked: boolean
          max_participants: number | null
          recording_enabled: boolean
          sdp_answer: Json | null
          sdp_offer: Json | null
          started_at: string | null
          status: string
          type: string
          updated_at: string
          waiting_room_enabled: boolean
        }
        Insert: {
          call_type?: string | null
          callee_id?: string | null
          caller_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          initiator_id: string
          is_group_call?: boolean
          is_locked?: boolean
          max_participants?: number | null
          recording_enabled?: boolean
          sdp_answer?: Json | null
          sdp_offer?: Json | null
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          waiting_room_enabled?: boolean
        }
        Update: {
          call_type?: string | null
          callee_id?: string | null
          caller_id?: string | null
          conversation_id?: string | null
          created_at?: string
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          initiator_id?: string
          is_group_call?: boolean
          is_locked?: boolean
          max_participants?: number | null
          recording_enabled?: boolean
          sdp_answer?: Json | null
          sdp_offer?: Json | null
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          waiting_room_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      close_circle: {
        Row: {
          created_at: string
          kind: string
          member_user_id: string
          owner_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          kind: string
          member_user_id: string
          owner_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          kind?: string
          member_user_id?: string
          owner_user_id?: string
          status?: string
        }
        Relationships: []
      }
      close_friends: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_group_members: {
        Row: {
          contact_id: string
          created_at: string
          group_id: string
          id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          group_id: string
          id?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_group_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contact_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_groups: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          id: string
          is_blocked: boolean | null
          is_favorite: boolean | null
          nickname: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          nickname?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          id?: string
          is_blocked?: boolean | null
          is_favorite?: boolean | null
          nickname?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_contact_user_id_fkey"
            columns: ["contact_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          category: Database["public"]["Enums"]["report_category"]
          created_at: string
          description: string | null
          id: string
          reporter_id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description?: string | null
          id?: string
          reporter_id: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["report_category"]
          created_at?: string
          description?: string | null
          id?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          target_id?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          history_cleared_at: string | null
          is_archived: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          joined_at: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          history_cleared_at?: string | null
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          history_cleared_at?: string | null
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          joined_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string | null
          disappearing_messages_duration: string | null
          id: string
          name: string | null
          type: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          disappearing_messages_duration?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string | null
          disappearing_messages_duration?: string | null
          id?: string
          name?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      creator_applications: {
        Row: {
          application_type: string
          created_at: string
          document_url: string | null
          full_name: string
          id: string
          reason: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          application_type?: string
          created_at?: string
          document_url?: string | null
          full_name: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          application_type?: string
          created_at?: string
          document_url?: string | null
          full_name?: string
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_verification_docs: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type?: string
          id?: string
          storage_path: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_verification_docs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "creator_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          amount_kwanza: number
          business_id: string
          created_at: string
          credits: number
          id: string
          merchant_ref: string | null
          method: string | null
          paid_at: string | null
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_kwanza: number
          business_id: string
          created_at?: string
          credits: number
          id?: string
          merchant_ref?: string | null
          method?: string | null
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_kwanza?: number
          business_id?: string
          created_at?: string
          credits?: number
          id?: string
          merchant_ref?: string | null
          method?: string | null
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          business_id: string
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          stripe_payment_id: string | null
          transaction_type: Database["public"]["Enums"]["credit_transaction_type"]
        }
        Insert: {
          amount: number
          balance_after: number
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          stripe_payment_id?: string | null
          transaction_type: Database["public"]["Enums"]["credit_transaction_type"]
        }
        Update: {
          amount?: number
          balance_after?: number
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          stripe_payment_id?: string | null
          transaction_type?: Database["public"]["Enums"]["credit_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      currency_rates: {
        Row: {
          country_code: string
          country_name: string
          created_at: string
          credits_per_usd: number
          currency_code: string
          currency_name: string
          display_order: number | null
          id: string
          is_active: boolean | null
          rate_to_eur: number
          rate_to_usd: number
          symbol: string
          updated_at: string
        }
        Insert: {
          country_code: string
          country_name: string
          created_at?: string
          credits_per_usd?: number
          currency_code: string
          currency_name: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rate_to_eur: number
          rate_to_usd: number
          symbol: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          country_name?: string
          created_at?: string
          credits_per_usd?: number
          currency_code?: string
          currency_name?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          rate_to_eur?: number
          rate_to_usd?: number
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_sessions: {
        Row: {
          browser: string | null
          created_at: string
          device_name: string | null
          device_type: string | null
          fingerprint: string | null
          id: string
          ip_address: unknown
          is_current: boolean | null
          last_active: string | null
          platform: string | null
          push_token: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active?: string | null
          platform?: string | null
          push_token?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          created_at?: string
          device_name?: string | null
          device_type?: string | null
          fingerprint?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active?: string | null
          platform?: string | null
          push_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      discover_topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_trending: boolean
          name: string
          post_count: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_trending?: boolean
          name: string
          post_count?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_trending?: boolean
          name?: string
          post_count?: number
          slug?: string
        }
        Relationships: []
      }
      followers: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          receiver_id: string
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id: string
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          receiver_id?: string
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          code: string
          conversation_id: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          conversation_id: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          conversation_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_messages: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          is_hidden: boolean
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_hidden?: boolean
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          is_hidden?: boolean
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      kambas: {
        Row: {
          created_at: string
          kamba_user_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kamba_user_id: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          kamba_user_id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kumbu_ledger: {
        Row: {
          action_type: string
          amount: number
          balance_after: number | null
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          source: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          amount: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      kumbu_purchases: {
        Row: {
          amount_kwanza: number
          created_at: string
          fulfilled_at: string | null
          id: string
          kumbu: number
          merchant_ref: string | null
          method: string | null
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_kwanza: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          kumbu: number
          merchant_ref?: string | null
          method?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_kwanza?: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          kumbu?: number
          merchant_ref?: string | null
          method?: string | null
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      live_access: {
        Row: {
          created_at: string
          id: string
          session_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_access_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          created_at: string
          id: string
          is_deleted: boolean
          message: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          message: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_deleted?: boolean
          message?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_participants: {
        Row: {
          id: string
          is_muted: boolean
          joined_at: string
          left_at: string | null
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          id?: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          role?: string
          session_id: string
          user_id: string
        }
        Update: {
          id?: string
          is_muted?: boolean
          joined_at?: string
          left_at?: string | null
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          ended_at: string | null
          host_id: string
          id: string
          livekit_room_name: string | null
          market_id: string | null
          neighborhood: string | null
          peak_viewers: number
          started_at: string | null
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          viewer_count: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id: string
          id?: string
          livekit_room_name?: string | null
          market_id?: string | null
          neighborhood?: string | null
          peak_viewers?: number
          started_at?: string | null
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          viewer_count?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          host_id?: string
          id?: string
          livekit_room_name?: string | null
          market_id?: string | null
          neighborhood?: string | null
          peak_viewers?: number
          started_at?: string | null
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      location_markets: {
        Row: {
          city: string
          country_code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          neighborhood: string | null
        }
        Insert: {
          city: string
          country_code?: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          neighborhood?: string | null
        }
        Update: {
          city?: string
          country_code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          neighborhood?: string | null
        }
        Relationships: []
      }
      mentor_profiles: {
        Row: {
          status: string
          experience: string
          created_at: string
          id: string
          is_verified_mentor: boolean
          mentor_bio: string | null
          specialty: string
          updated_at: string
          user_id: string
        }
        Insert: {
          status?: string
          experience?: string
          created_at?: string
          id?: string
          is_verified_mentor?: boolean
          mentor_bio?: string | null
          specialty?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          experience?: string
          created_at?: string
          id?: string
          is_verified_mentor?: boolean
          mentor_bio?: string | null
          specialty?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_edits: {
        Row: {
          edited_at: string
          id: string
          message_id: string
          original_content: string
        }
        Insert: {
          edited_at?: string
          id?: string
          message_id: string
          original_content: string
        }
        Update: {
          edited_at?: string
          id?: string
          message_id?: string
          original_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_edits_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_highlights: {
        Row: {
          color: string
          created_at: string
          id: string
          label: string | null
          message_id: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          label?: string | null
          message_id: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          label?: string | null
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_highlights_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          delivered_at: string | null
          duration_seconds: number | null
          edited_at: string | null
          expires_at: string | null
          forwarded_from_id: string | null
          forwarded_from_user_id: string | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_view_once: boolean | null
          media_url: string | null
          thumbnail_url: string | null
          message_type: string
          read_by: Json | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          duration_seconds?: number | null
          edited_at?: string | null
          expires_at?: string | null
          forwarded_from_id?: string | null
          forwarded_from_user_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_view_once?: boolean | null
          media_url?: string | null
          thumbnail_url?: string | null
          message_type?: string
          read_by?: Json | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          duration_seconds?: number | null
          edited_at?: string | null
          expires_at?: string | null
          forwarded_from_id?: string | null
          forwarded_from_user_id?: string | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_view_once?: boolean | null
          media_url?: string | null
          thumbnail_url?: string | null
          message_type?: string
          read_by?: Json | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_forwarded_from_id_fkey"
            columns: ["forwarded_from_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at: string
          details: Json | null
          id: string
          moderator_id: string
          reason: string | null
          report_id: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          moderator_id: string
          reason?: string | null
          report_id?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["moderation_action_type"]
          created_at?: string
          details?: Json | null
          id?: string
          moderator_id?: string
          reason?: string | null
          report_id?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_actions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_appeals: {
        Row: {
          appeal_type: string
          created_at: string
          evidence_text: string | null
          evidence_url: string | null
          id: string
          reason: string
          report_id: string | null
          resolution_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["appeal_status"]
          strike_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          appeal_type: string
          created_at?: string
          evidence_text?: string | null
          evidence_url?: string | null
          id?: string
          reason: string
          report_id?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          strike_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          appeal_type?: string
          created_at?: string
          evidence_text?: string | null
          evidence_url?: string | null
          id?: string
          reason?: string
          report_id?: string | null
          resolution_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["appeal_status"]
          strike_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_appeals_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_strike_id_fkey"
            columns: ["strike_id"]
            isOneToOne: false
            referencedRelation: "user_strikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          notification_type: string
          related_appeal_id: string | null
          related_strike_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          related_appeal_id?: string | null
          related_strike_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          related_appeal_id?: string | null
          related_strike_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moderation_notifications_related_appeal_id_fkey"
            columns: ["related_appeal_id"]
            isOneToOne: false
            referencedRelation: "moderation_appeals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_notifications_related_strike_id_fkey"
            columns: ["related_strike_id"]
            isOneToOne: false
            referencedRelation: "user_strikes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mokubico_conversa_guests: {
        Row: {
          conversa_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mokubico_conversa_guests_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "mokubico_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      mokubico_conversa_reads: {
        Row: {
          conversa_id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversa_id: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversa_id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mokubico_conversa_reads_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "mokubico_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      mokubico_conversas: {
        Row: {
          banda_id: string | null
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          livekit_room_name: string
          media_enabled: boolean
          space: string
          started_at: string
          status: string
          title: string | null
        }
        Insert: {
          banda_id?: string | null
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          livekit_room_name: string
          media_enabled?: boolean
          space: string
          started_at?: string
          status?: string
          title?: string | null
        }
        Update: {
          banda_id?: string | null
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          livekit_room_name?: string
          media_enabled?: boolean
          space?: string
          started_at?: string
          status?: string
          title?: string | null
        }
        Relationships: []
      }
      mokubico_messages: {
        Row: {
          conversa_id: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string | null
          text: string
        }
        Insert: {
          conversa_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name?: string | null
          text: string
        }
        Update: {
          conversa_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "mokubico_messages_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "mokubico_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      muted_status_contacts: {
        Row: {
          created_at: string
          id: string
          muted_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          muted_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          muted_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "muted_status_contacts_muted_user_id_fkey"
            columns: ["muted_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_status_contacts_muted_user_id_fkey"
            columns: ["muted_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_status_contacts_muted_user_id_fkey"
            columns: ["muted_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_status_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_status_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "muted_status_contacts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_candidates: {
        Row: {
          access_code: string | null
          city: string | null
          code_used: boolean | null
          code_used_at: string | null
          code_used_by: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          invite_sent_at: string | null
          motivation: string | null
          notes: string | null
          phone: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_handle: string | null
          status: string
          updated_at: string
        }
        Insert: {
          access_code?: string | null
          city?: string | null
          code_used?: boolean | null
          code_used_at?: string | null
          code_used_by?: string | null
          country?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          invite_sent_at?: string | null
          motivation?: string | null
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_handle?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          access_code?: string | null
          city?: string | null
          code_used?: boolean | null
          code_used_at?: string | null
          code_used_by?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          invite_sent_at?: string | null
          motivation?: string | null
          notes?: string | null
          phone?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_handle?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      palco_category_pricing: {
        Row: {
          category: Database["public"]["Enums"]["artistic_category"]
          created_at: string
          description: string | null
          id: string
          max_price: number
          min_price: number
          suggested_email_price: number
          suggested_highlight_price: number
          suggested_live_price: number
          tier_name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["artistic_category"]
          created_at?: string
          description?: string | null
          id?: string
          max_price?: number
          min_price?: number
          suggested_email_price?: number
          suggested_highlight_price?: number
          suggested_live_price?: number
          tier_name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["artistic_category"]
          created_at?: string
          description?: string | null
          id?: string
          max_price?: number
          min_price?: number
          suggested_email_price?: number
          suggested_highlight_price?: number
          suggested_live_price?: number
          tier_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      palco_invites: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          palco_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id: string
          palco_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          palco_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "palco_invites_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
        ]
      }
      palco_likes: {
        Row: {
          created_at: string
          id: string
          palco_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          palco_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          palco_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "palco_likes_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
        ]
      }
      palco_participants: {
        Row: {
          joined_at: string
          left_at: string | null
          palco_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          left_at?: string | null
          palco_id: string
          role?: string
          user_id: string
        }
        Update: {
          joined_at?: string
          left_at?: string | null
          palco_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "palco_participants_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
        ]
      }
      palco_rentals: {
        Row: {
          created_at: string
          currency: string | null
          fee_per_roda: number | null
          fixed_fee: number | null
          id: string
          invoice_id: string | null
          model: string
          paid_at: string | null
          palco_id: string
          payment_ref: string | null
          payment_status: string
          percent_of_sales: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          fee_per_roda?: number | null
          fixed_fee?: number | null
          id?: string
          invoice_id?: string | null
          model?: string
          paid_at?: string | null
          palco_id: string
          payment_ref?: string | null
          payment_status?: string
          percent_of_sales?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          fee_per_roda?: number | null
          fixed_fee?: number | null
          id?: string
          invoice_id?: string | null
          model?: string
          paid_at?: string | null
          palco_id?: string
          payment_ref?: string | null
          payment_status?: string
          percent_of_sales?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "palco_rentals_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palco_rentals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palco_rentals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palco_rentals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      palco_voice_types: {
        Row: {
          created_at: string
          currency: string | null
          delivery_description: string | null
          enabled: boolean | null
          id: string
          palco_id: string
          price: number
          voice_type: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          delivery_description?: string | null
          enabled?: boolean | null
          id?: string
          palco_id: string
          price: number
          voice_type: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          delivery_description?: string | null
          enabled?: boolean | null
          id?: string
          palco_id?: string
          price?: number
          voice_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "palco_voice_types_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
        ]
      }
      palcos: {
        Row: {
          access: string | null
          allow_ai_assist: boolean | null
          allow_custom_pricing: boolean | null
          allow_custom_voice_text: boolean | null
          artistic_category:
            | Database["public"]["Enums"]["artistic_category"]
            | null
          banda_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          featured: boolean | null
          guide_id: string
          host_role: string | null
          host_title: string | null
          host_user_id: string | null
          id: string
          is_live: boolean | null
          language: string
          livekit_room_name: string | null
          location: string | null
          max_voices_per_roda: number | null
          min_price: number | null
          palco_type: Database["public"]["Enums"]["palco_type"]
          participant_count: number | null
          presenter_title: string | null
          roda_id: string | null
          space: string | null
          status: string
          suggested_max_price: number | null
          suggested_min_price: number | null
          tags: string[] | null
          theme: string | null
          theme_id: string | null
          title: string
          total_rodas: number | null
          total_voices: number | null
          updated_at: string
          visibility: string
        }
        Insert: {
          access?: string | null
          allow_ai_assist?: boolean | null
          allow_custom_pricing?: boolean | null
          allow_custom_voice_text?: boolean | null
          artistic_category?:
            | Database["public"]["Enums"]["artistic_category"]
            | null
          banda_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          guide_id: string
          host_role?: string | null
          host_title?: string | null
          host_user_id?: string | null
          id?: string
          is_live?: boolean | null
          language?: string
          livekit_room_name?: string | null
          location?: string | null
          max_voices_per_roda?: number | null
          min_price?: number | null
          palco_type?: Database["public"]["Enums"]["palco_type"]
          participant_count?: number | null
          presenter_title?: string | null
          roda_id?: string | null
          space?: string | null
          status?: string
          suggested_max_price?: number | null
          suggested_min_price?: number | null
          tags?: string[] | null
          theme?: string | null
          theme_id?: string | null
          title: string
          total_rodas?: number | null
          total_voices?: number | null
          updated_at?: string
          visibility?: string
        }
        Update: {
          access?: string | null
          allow_ai_assist?: boolean | null
          allow_custom_pricing?: boolean | null
          allow_custom_voice_text?: boolean | null
          artistic_category?:
            | Database["public"]["Enums"]["artistic_category"]
            | null
          banda_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          featured?: boolean | null
          guide_id?: string
          host_role?: string | null
          host_title?: string | null
          host_user_id?: string | null
          id?: string
          is_live?: boolean | null
          language?: string
          livekit_room_name?: string | null
          location?: string | null
          max_voices_per_roda?: number | null
          min_price?: number | null
          palco_type?: Database["public"]["Enums"]["palco_type"]
          participant_count?: number | null
          presenter_title?: string | null
          roda_id?: string | null
          space?: string | null
          status?: string
          suggested_max_price?: number | null
          suggested_min_price?: number | null
          tags?: string[] | null
          theme?: string | null
          theme_id?: string | null
          title?: string
          total_rodas?: number | null
          total_voices?: number | null
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "palcos_banda_fk"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palcos_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palcos_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palcos_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palcos_roda_id_fkey"
            columns: ["roda_id"]
            isOneToOne: false
            referencedRelation: "rodas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "palcos_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "themes"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount_kumbu: number
          amount_local: number | null
          created_at: string
          currency: string | null
          id: string
          processed_at: string | null
          processed_by: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_kumbu: number
          amount_local?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_kumbu?: number
          amount_local?: number | null
          created_at?: string
          currency?: string | null
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pinned_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          pinned_by: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      podp_daily: {
        Row: {
          banda_id: string | null
          created_at: string
          day: string
          dist_m: number | null
          lat: number | null
          lng: number | null
          user_id: string
        }
        Insert: {
          banda_id?: string | null
          created_at?: string
          day: string
          dist_m?: number | null
          lat?: number | null
          lng?: number | null
          user_id: string
        }
        Update: {
          banda_id?: string | null
          created_at?: string
          day?: string
          dist_m?: number | null
          lat?: number | null
          lng?: number | null
          user_id?: string
        }
        Relationships: []
      }
      post_archives: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_archives_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_hidden: boolean
          likes_count: number
          parent_comment_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          likes_count?: number
          parent_comment_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_hidden?: boolean
          likes_count?: number
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          quote_content: string | null
          share_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          quote_content?: string | null
          share_type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          quote_content?: string | null
          share_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_topics: {
        Row: {
          id: string
          post_id: string
          topic_id: string
        }
        Insert: {
          id?: string
          post_id: string
          topic_id: string
        }
        Update: {
          id?: string
          post_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_topics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "discover_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          banda_id: string | null
          comments_count: number
          content: string | null
          created_at: string
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          is_pinned: boolean
          likes_count: number
          location: string | null
          media_urls: string[] | null
          privacy: string
          shares_count: number
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          banda_id?: string | null
          comments_count?: number
          content?: string | null
          created_at?: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          likes_count?: number
          location?: string | null
          media_urls?: string[] | null
          privacy?: string
          shares_count?: number
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          banda_id?: string | null
          comments_count?: number
          content?: string | null
          created_at?: string
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          likes_count?: number
          location?: string | null
          media_urls?: string[] | null
          privacy?: string
          shares_count?: number
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_banda_fk"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_highlight_items: {
        Row: {
          caption: string | null
          created_at: string
          display_order: number | null
          highlight_id: string
          id: string
          media_type: string | null
          media_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          highlight_id: string
          id?: string
          media_type?: string | null
          media_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          display_order?: number | null
          highlight_id?: string
          id?: string
          media_type?: string | null
          media_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_highlight_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "profile_highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_highlights: {
        Row: {
          cover_url: string | null
          created_at: string
          display_order: number | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_photos: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_primary: boolean | null
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          afroloc_certification_status: string
          afroloc_certified_at: string | null
          afroloc_certified_by: string | null
          afroloc_code: string | null
          app_tour_completed: boolean | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          city: string | null
          contacts_synced: boolean | null
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          founder_number: number | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_creator: boolean
          is_online: boolean | null
          is_verified: boolean | null
          kumbu_available: number
          kumbu_earned: number
          kumbu_lifetime: number
          kyc_verified: boolean
          last_seen: string | null
          latitude: number | null
          level: string
          longitude: number | null
          neighborhood: string | null
          onboarding_completed: boolean | null
          partner_user_id: string | null
          phone_number: string | null
          photos_visibility:
            | Database["public"]["Enums"]["photos_visibility"]
            | null
          plan: string
          plan_expires_at: string | null
          profile_theme_color: string | null
          show_last_seen: boolean | null
          show_online_status: boolean | null
          show_read_receipts: boolean | null
          show_typing_indicators: boolean | null
          status_message: string | null
          suspended_until: string | null
          suspension_reason: string | null
          two_factor_enabled: boolean | null
          updated_at: string
          username: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          afroloc_certification_status?: string
          afroloc_certified_at?: string | null
          afroloc_certified_by?: string | null
          afroloc_code?: string | null
          app_tour_completed?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          city?: string | null
          contacts_synced?: boolean | null
          country_code?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          founder_number?: number | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id: string
          is_creator?: boolean
          is_online?: boolean | null
          is_verified?: boolean | null
          kumbu_available?: number
          kumbu_earned?: number
          kumbu_lifetime?: number
          kyc_verified?: boolean
          last_seen?: string | null
          latitude?: number | null
          level?: string
          longitude?: number | null
          neighborhood?: string | null
          onboarding_completed?: boolean | null
          partner_user_id?: string | null
          phone_number?: string | null
          photos_visibility?:
            | Database["public"]["Enums"]["photos_visibility"]
            | null
          plan?: string
          plan_expires_at?: string | null
          profile_theme_color?: string | null
          show_last_seen?: boolean | null
          show_online_status?: boolean | null
          show_read_receipts?: boolean | null
          show_typing_indicators?: boolean | null
          status_message?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          username: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"] | null
          afroloc_certification_status?: string
          afroloc_certified_at?: string | null
          afroloc_certified_by?: string | null
          afroloc_code?: string | null
          app_tour_completed?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          birthday?: string | null
          city?: string | null
          contacts_synced?: boolean | null
          country_code?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          founder_number?: number | null
          gender?: Database["public"]["Enums"]["gender"] | null
          id?: string
          is_creator?: boolean
          is_online?: boolean | null
          is_verified?: boolean | null
          kumbu_available?: number
          kumbu_earned?: number
          kumbu_lifetime?: number
          kyc_verified?: boolean
          last_seen?: string | null
          latitude?: number | null
          level?: string
          longitude?: number | null
          neighborhood?: string | null
          onboarding_completed?: boolean | null
          partner_user_id?: string | null
          phone_number?: string | null
          photos_visibility?:
            | Database["public"]["Enums"]["photos_visibility"]
            | null
          plan?: string
          plan_expires_at?: string | null
          profile_theme_color?: string | null
          show_last_seen?: boolean | null
          show_online_status?: boolean | null
          show_read_receipts?: boolean | null
          show_typing_indicators?: boolean | null
          status_message?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          two_factor_enabled?: boolean | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      ranking_history: {
        Row: {
          banda_id: string
          created_at: string
          entries: Json
          id: string
          week_end: string
          week_start: string
        }
        Insert: {
          banda_id: string
          created_at?: string
          entries?: Json
          id?: string
          week_end: string
          week_start: string
        }
        Update: {
          banda_id?: string
          created_at?: string
          entries?: Json
          id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_history_banda_id_fkey"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
        ]
      }
      recording_consents: {
        Row: {
          consented: boolean
          consented_at: string
          id: string
          ip_address: string | null
          recording_id: string
          revoked_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consented: boolean
          consented_at?: string
          id?: string
          ip_address?: string | null
          recording_id: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consented?: boolean
          consented_at?: string
          id?: string
          ip_address?: string | null
          recording_id?: string
          revoked_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recording_consents_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      ritmos: {
        Row: {
          caption: string | null
          city: string | null
          created_at: string
          id: string
          is_promoted: boolean
          market: string | null
          neighborhood: string | null
          updated_at: string
          user_id: string
          video_url: string
          view_count: number
        }
        Insert: {
          caption?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_promoted?: boolean
          market?: string | null
          neighborhood?: string | null
          updated_at?: string
          user_id: string
          video_url: string
          view_count?: number
        }
        Update: {
          caption?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_promoted?: boolean
          market?: string | null
          neighborhood?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ritmos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritmos_comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: Database["public"]["Enums"]["ritmo_reaction_type"]
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["ritmo_reaction_type"]
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["ritmo_reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritmos_comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "ritmos_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritmos_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          ritmo_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          ritmo_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          ritmo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritmos_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "ritmos_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comments_ritmo_id_fkey"
            columns: ["ritmo_id"]
            isOneToOne: false
            referencedRelation: "ritmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritmos_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: Database["public"]["Enums"]["ritmo_reaction_type"]
          ritmo_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["ritmo_reaction_type"]
          ritmo_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["ritmo_reaction_type"]
          ritmo_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritmos_reactions_ritmo_id_fkey"
            columns: ["ritmo_id"]
            isOneToOne: false
            referencedRelation: "ritmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritmos_views: {
        Row: {
          id: string
          ritmo_id: string
          user_id: string | null
          viewed_at: string
        }
        Insert: {
          id?: string
          ritmo_id: string
          user_id?: string | null
          viewed_at?: string
        }
        Update: {
          id?: string
          ritmo_id?: string
          user_id?: string | null
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritmos_views_ritmo_id_fkey"
            columns: ["ritmo_id"]
            isOneToOne: false
            referencedRelation: "ritmos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritmos_views_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roda_participants: {
        Row: {
          has_paid_qa: boolean | null
          id: string
          joined_at: string
          left_at: string | null
          roda_id: string
          role: string
          user_id: string
        }
        Insert: {
          has_paid_qa?: boolean | null
          id?: string
          joined_at?: string
          left_at?: string | null
          roda_id: string
          role?: string
          user_id: string
        }
        Update: {
          has_paid_qa?: boolean | null
          id?: string
          joined_at?: string
          left_at?: string | null
          roda_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roda_participants_roda_id_fkey"
            columns: ["roda_id"]
            isOneToOne: false
            referencedRelation: "rodas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roda_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roda_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roda_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roda_recordings: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          expires_at: string | null
          file_size_bytes: number | null
          has_transcription: boolean
          id: string
          initiated_by: string
          palco_id: string
          retention_days: number | null
          roda_id: string
          started_at: string | null
          status: string
          storage_path: string | null
          transcription_text: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          has_transcription?: boolean
          id?: string
          initiated_by: string
          palco_id: string
          retention_days?: number | null
          roda_id: string
          started_at?: string | null
          status?: string
          storage_path?: string | null
          transcription_text?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          expires_at?: string | null
          file_size_bytes?: number | null
          has_transcription?: boolean
          id?: string
          initiated_by?: string
          palco_id?: string
          retention_days?: number | null
          roda_id?: string
          started_at?: string | null
          status?: string
          storage_path?: string | null
          transcription_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roda_recordings_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roda_recordings_roda_id_fkey"
            columns: ["roda_id"]
            isOneToOne: false
            referencedRelation: "rodas"
            referencedColumns: ["id"]
          },
        ]
      }
      rodas: {
        Row: {
          allow_custom_voice_text: boolean | null
          banda_id: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          ended_at: string | null
          featured: boolean | null
          id: string
          language: string | null
          livekit_room_name: string | null
          location: string | null
          max_voices: number | null
          max_voices_per_palco: number | null
          min_price: number | null
          organizer_id: string | null
          palco_id: string | null
          peak_viewers: number | null
          phase: string
          qa_start_at: string | null
          recording_completed_at: string | null
          recording_duration_seconds: number | null
          recording_enabled: boolean
          recording_started_at: string | null
          recording_status: string | null
          recording_url: string | null
          scheduled_at: string | null
          started_at: string | null
          tags: string[] | null
          theme: string | null
          title: string | null
          total_palcos: number | null
          total_voices: number | null
          updated_at: string
          viewer_count: number | null
          visibility: string | null
        }
        Insert: {
          allow_custom_voice_text?: boolean | null
          banda_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          featured?: boolean | null
          id?: string
          language?: string | null
          livekit_room_name?: string | null
          location?: string | null
          max_voices?: number | null
          max_voices_per_palco?: number | null
          min_price?: number | null
          organizer_id?: string | null
          palco_id?: string | null
          peak_viewers?: number | null
          phase?: string
          qa_start_at?: string | null
          recording_completed_at?: string | null
          recording_duration_seconds?: number | null
          recording_enabled?: boolean
          recording_started_at?: string | null
          recording_status?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          tags?: string[] | null
          theme?: string | null
          title?: string | null
          total_palcos?: number | null
          total_voices?: number | null
          updated_at?: string
          viewer_count?: number | null
          visibility?: string | null
        }
        Update: {
          allow_custom_voice_text?: boolean | null
          banda_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          ended_at?: string | null
          featured?: boolean | null
          id?: string
          language?: string | null
          livekit_room_name?: string | null
          location?: string | null
          max_voices?: number | null
          max_voices_per_palco?: number | null
          min_price?: number | null
          organizer_id?: string | null
          palco_id?: string | null
          peak_viewers?: number | null
          phase?: string
          qa_start_at?: string | null
          recording_completed_at?: string | null
          recording_duration_seconds?: number | null
          recording_enabled?: boolean
          recording_started_at?: string | null
          recording_status?: string | null
          recording_url?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          tags?: string[] | null
          theme?: string | null
          title?: string | null
          total_palcos?: number | null
          total_voices?: number | null
          updated_at?: string
          viewer_count?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rodas_banda_id_fkey"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rodas_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rodas_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rodas_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rodas_palco_id_fkey"
            columns: ["palco_id"]
            isOneToOne: false
            referencedRelation: "palcos"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_posts: {
        Row: {
          collection_name: string | null
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          collection_name?: string | null
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          collection_name?: string | null
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_call_invites: {
        Row: {
          created_at: string
          id: string
          reminder_sent: boolean
          rsvp_status: string
          scheduled_call_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reminder_sent?: boolean
          rsvp_status?: string
          scheduled_call_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reminder_sent?: boolean
          rsvp_status?: string
          scheduled_call_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_call_invites_scheduled_call_id_fkey"
            columns: ["scheduled_call_id"]
            isOneToOne: false
            referencedRelation: "scheduled_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_calls: {
        Row: {
          call_type: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          invite_link: string | null
          is_recurring: boolean
          organizer_id: string
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          scheduled_at: string
          status: string
          timezone: string
          title: string
          updated_at: string
          waiting_room_enabled: boolean
        }
        Insert: {
          call_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          invite_link?: string | null
          is_recurring?: boolean
          organizer_id: string
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at: string
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          waiting_room_enabled?: boolean
        }
        Update: {
          call_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          invite_link?: string | null
          is_recurring?: boolean
          organizer_id?: string
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          scheduled_at?: string
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          waiting_room_enabled?: boolean
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          is_recurring: boolean | null
          media_url: string | null
          message_type: string
          recurrence_pattern: string | null
          scheduled_for: string
          sender_id: string
          status: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          media_url?: string | null
          message_type?: string
          recurrence_pattern?: string | null
          scheduled_for: string
          sender_id: string
          status?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_recurring?: boolean | null
          media_url?: string | null
          message_type?: string
          recurrence_pattern?: string | null
          scheduled_for?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      starred_messages: {
        Row: {
          created_at: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "starred_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      status_reactions: {
        Row: {
          created_at: string
          id: string
          reaction_type: string
          status_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reaction_type: string
          status_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reaction_type?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_reactions_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      status_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          status_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          status_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          status_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_replies_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_views: {
        Row: {
          id: string
          status_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          status_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          status_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_views_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      statuses: {
        Row: {
          background: string | null
          caption: string | null
          content: string | null
          created_at: string
          expires_at: string
          id: string
          is_archived: boolean
          media_url: string | null
          music_title: string | null
          music_url: string | null
          privacy: string
          stickers: Json | null
          type: string
          user_id: string
        }
        Insert: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_archived?: boolean
          media_url?: string | null
          music_title?: string | null
          music_url?: string | null
          privacy?: string
          stickers?: Json | null
          type: string
          user_id: string
        }
        Update: {
          background?: string | null
          caption?: string | null
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_archived?: boolean
          media_url?: string | null
          music_title?: string | null
          music_url?: string | null
          privacy?: string
          stickers?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statuses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_packs: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_animated: boolean | null
          is_premium: boolean | null
          name: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_animated?: boolean | null
          is_premium?: boolean | null
          name: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_animated?: boolean | null
          is_premium?: boolean | null
          name?: string
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          display_order: number | null
          emoji: string | null
          id: string
          name: string | null
          pack_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          name?: string | null
          pack_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          emoji?: string | null
          id?: string
          name?: string | null
          pack_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      strike_thresholds: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          strike_count: number
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          is_active?: boolean
          strike_count: number
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          strike_count?: number
        }
        Relationships: []
      }
      subscription_purchases: {
        Row: {
          amount_kwanza: number
          created_at: string
          fulfilled_at: string | null
          id: string
          merchant_ref: string | null
          method: string | null
          months: number
          period: string
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_kwanza: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          merchant_ref?: string | null
          method?: string | null
          months?: number
          period?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_kwanza?: number
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          merchant_ref?: string | null
          method?: string | null
          months?: number
          period?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      theme_suggestions: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          id: string
          justification: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          status: string
          suggested_by: string
          suggested_name: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          justification?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope: string
          status?: string
          suggested_by: string
          suggested_name: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          id?: string
          justification?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          status?: string
          suggested_by?: string
          suggested_name?: string
        }
        Relationships: []
      }
      themes: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          scope: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          scope: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          scope?: string
        }
        Relationships: []
      }
      topic_suggestions: {
        Row: {
          created_at: string
          id: string
          name: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: string
          suggested_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: string
          suggested_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: string
          suggested_by?: string | null
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_bandas: {
        Row: {
          activated_at: string | null
          banda_id: string
          is_active: boolean
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          banda_id: string
          is_active?: boolean
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          banda_id?: string
          is_active?: boolean
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_bandas_banda_id_fkey"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_call_settings: {
        Row: {
          beauty_mode_enabled: boolean
          captions_enabled: boolean
          captions_font_size: number | null
          captions_language: string | null
          created_at: string
          data_saver_mode: boolean
          default_audio_on: boolean
          default_video_on: boolean
          echo_cancellation_enabled: boolean
          id: string
          low_light_enhancement: boolean
          noise_suppression_enabled: boolean
          preferred_background_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          beauty_mode_enabled?: boolean
          captions_enabled?: boolean
          captions_font_size?: number | null
          captions_language?: string | null
          created_at?: string
          data_saver_mode?: boolean
          default_audio_on?: boolean
          default_video_on?: boolean
          echo_cancellation_enabled?: boolean
          id?: string
          low_light_enhancement?: boolean
          noise_suppression_enabled?: boolean
          preferred_background_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          beauty_mode_enabled?: boolean
          captions_enabled?: boolean
          captions_font_size?: number | null
          captions_language?: string | null
          created_at?: string
          data_saver_mode?: boolean
          default_audio_on?: boolean
          default_video_on?: boolean
          echo_cancellation_enabled?: boolean
          id?: string
          low_light_enhancement?: boolean
          noise_suppression_enabled?: boolean
          preferred_background_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_call_settings_preferred_background_id_fkey"
            columns: ["preferred_background_id"]
            isOneToOne: false
            referencedRelation: "virtual_backgrounds"
            referencedColumns: ["id"]
          },
        ]
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
      user_settings: {
        Row: {
          auto_download_media: string | null
          call_vibration_enabled: boolean | null
          chat_wallpaper: string | null
          created_at: string
          data_saver_mode: boolean | null
          enter_to_send: boolean | null
          font_size: string | null
          id: string
          journey_visibility: string
          language: string | null
          language_variant: string | null
          media_visibility: boolean | null
          notification_sound: string | null
          notifications_enabled: boolean
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          ringtone_enabled: boolean | null
          ringtone_pattern: string | null
          ringtone_volume: number | null
          show_banda: string
          show_journey_calls: boolean | null
          show_journey_friends: boolean | null
          show_journey_messages: boolean | null
          show_journey_momambos: boolean | null
          show_journey_posts: boolean | null
          show_journey_reactions: boolean | null
          theme: string | null
          updated_at: string
          user_id: string
          vibration_enabled: boolean | null
        }
        Insert: {
          auto_download_media?: string | null
          call_vibration_enabled?: boolean | null
          chat_wallpaper?: string | null
          created_at?: string
          data_saver_mode?: boolean | null
          enter_to_send?: boolean | null
          font_size?: string | null
          id?: string
          journey_visibility?: string
          language?: string | null
          language_variant?: string | null
          media_visibility?: boolean | null
          notification_sound?: string | null
          notifications_enabled?: boolean
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          ringtone_enabled?: boolean | null
          ringtone_pattern?: string | null
          ringtone_volume?: number | null
          show_banda?: string
          show_journey_calls?: boolean | null
          show_journey_friends?: boolean | null
          show_journey_messages?: boolean | null
          show_journey_momambos?: boolean | null
          show_journey_posts?: boolean | null
          show_journey_reactions?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean | null
        }
        Update: {
          auto_download_media?: string | null
          call_vibration_enabled?: boolean | null
          chat_wallpaper?: string | null
          created_at?: string
          data_saver_mode?: boolean | null
          enter_to_send?: boolean | null
          font_size?: string | null
          id?: string
          journey_visibility?: string
          language?: string | null
          language_variant?: string | null
          media_visibility?: boolean | null
          notification_sound?: string | null
          notifications_enabled?: boolean
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          ringtone_enabled?: boolean | null
          ringtone_pattern?: string | null
          ringtone_volume?: number | null
          show_banda?: string
          show_journey_calls?: boolean | null
          show_journey_friends?: boolean | null
          show_journey_messages?: boolean | null
          show_journey_momambos?: boolean | null
          show_journey_posts?: boolean | null
          show_journey_reactions?: boolean | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sticker_favorites: {
        Row: {
          created_at: string
          id: string
          sticker_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sticker_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sticker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sticker_favorites_sticker_id_fkey"
            columns: ["sticker_id"]
            isOneToOne: false
            referencedRelation: "stickers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sticker_packs: {
        Row: {
          created_at: string
          id: string
          pack_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pack_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pack_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sticker_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_strikes: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string
          evidence_url: string | null
          expires_at: string | null
          id: string
          issued_by: string
          reason: string
          report_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          severity: number
          status: Database["public"]["Enums"]["strike_status"]
          updated_at: string
          user_id: string
          violation_category: Database["public"]["Enums"]["violation_category"]
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          issued_by: string
          reason: string
          report_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          severity?: number
          status?: Database["public"]["Enums"]["strike_status"]
          updated_at?: string
          user_id: string
          violation_category: Database["public"]["Enums"]["violation_category"]
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          evidence_url?: string | null
          expires_at?: string | null
          id?: string
          issued_by?: string
          reason?: string
          report_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          severity?: number
          status?: Database["public"]["Enums"]["strike_status"]
          updated_at?: string
          user_id?: string
          violation_category?: Database["public"]["Enums"]["violation_category"]
        }
        Relationships: [
          {
            foreignKeyName: "user_strikes_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "content_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_strikes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_codes: {
        Row: {
          attempts: number | null
          code: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          type: Database["public"]["Enums"]["verification_type"]
          verified: boolean | null
        }
        Insert: {
          attempts?: number | null
          code: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          type: Database["public"]["Enums"]["verification_type"]
          verified?: boolean | null
        }
        Update: {
          attempts?: number | null
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          type?: Database["public"]["Enums"]["verification_type"]
          verified?: boolean | null
        }
        Relationships: []
      }
      view_once_views: {
        Row: {
          id: string
          message_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "view_once_views_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      virtual_backgrounds: {
        Row: {
          blur_intensity: number | null
          created_at: string
          id: string
          is_premium: boolean
          is_preset: boolean
          name: string
          storage_path: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          blur_intensity?: number | null
          created_at?: string
          id?: string
          is_premium?: boolean
          is_preset?: boolean
          name: string
          storage_path?: string | null
          type?: string
          user_id?: string | null
        }
        Update: {
          blur_intensity?: number | null
          created_at?: string
          id?: string
          is_premium?: boolean
          is_preset?: boolean
          name?: string
          storage_path?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      voicemails: {
        Row: {
          audio_url: string
          call_id: string | null
          created_at: string
          duration_seconds: number
          from_user_id: string
          id: string
          is_listened: boolean
          listened_at: string | null
          to_user_id: string
        }
        Insert: {
          audio_url: string
          call_id?: string | null
          created_at?: string
          duration_seconds?: number
          from_user_id: string
          id?: string
          is_listened?: boolean
          listened_at?: string | null
          to_user_id: string
        }
        Update: {
          audio_url?: string
          call_id?: string | null
          created_at?: string
          duration_seconds?: number
          from_user_id?: string
          id?: string
          is_listened?: boolean
          listened_at?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voicemails_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      vozes: {
        Row: {
          amount_paid: number | null
          answer_audio_url: string | null
          answer_text: string | null
          answered_at: string | null
          created_at: string
          currency: string | null
          custom_text: string | null
          id: string
          payment_method: string | null
          payment_ref: string | null
          roda_id: string
          status: string
          updated_at: string
          user_id: string
          voice_type: string
        }
        Insert: {
          amount_paid?: number | null
          answer_audio_url?: string | null
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          currency?: string | null
          custom_text?: string | null
          id?: string
          payment_method?: string | null
          payment_ref?: string | null
          roda_id: string
          status?: string
          updated_at?: string
          user_id: string
          voice_type: string
        }
        Update: {
          amount_paid?: number | null
          answer_audio_url?: string | null
          answer_text?: string | null
          answered_at?: string | null
          created_at?: string
          currency?: string | null
          custom_text?: string | null
          id?: string
          payment_method?: string | null
          payment_ref?: string | null
          roda_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          voice_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vozes_roda_id_fkey"
            columns: ["roda_id"]
            isOneToOne: false
            referencedRelation: "rodas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vozes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vozes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vozes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_ranking_entries: {
        Row: {
          created_at: string
          id: string
          position: number
          ranking_id: string
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          ranking_id: string
          score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          ranking_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_ranking_entries_ranking_id_fkey"
            columns: ["ranking_id"]
            isOneToOne: false
            referencedRelation: "weekly_rankings"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_rankings: {
        Row: {
          banda_id: string
          created_at: string
          id: string
          week_end: string
          week_start: string
        }
        Insert: {
          banda_id: string
          created_at?: string
          id?: string
          week_end: string
          week_start: string
        }
        Update: {
          banda_id?: string
          created_at?: string
          id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_rankings_banda_id_fkey"
            columns: ["banda_id"]
            isOneToOne: false
            referencedRelation: "bandas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      visible_messages: {
        Row: Database["public"]["Tables"]["messages"]["Row"]
        Relationships: Database["public"]["Tables"]["messages"]["Relationships"]
      }
      public_profiles: {
        Row: {
          created_at: string | null
          updated_at: string | null
          is_verified: boolean | null
          is_creator: boolean | null
          founder_number: number | null
          profile_theme_color: string | null
          show_online_status: boolean | null
          show_last_seen: boolean | null
          show_read_receipts: boolean | null
          show_typing_indicators: boolean | null
          photos_visibility: Database["public"]["Enums"]["photos_visibility"] | null
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          id: string | null
          is_online: boolean | null
          last_seen: string | null
          level: string | null
          status_message: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          is_online?: boolean | null
          last_seen?: string | null
          level?: string | null
          status_message?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string | null
          is_online?: boolean | null
          last_seen?: string | null
          level?: string | null
          status_message?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      academia_save_mentor: { Args: { p_specialty: string; p_bio: string; p_experience: string; p_submit?: boolean }; Returns: Json }
      academia_manage_mentor: { Args: { p_user: string; p_action: string; p_reason: string }; Returns: Json }
      academia_admin_mentors: { Args: Record<PropertyKey, never>; Returns: Json }
      academia_confirm_attendance: { Args: { p_session: string; p_user: string }; Returns: Json }
      academia_can_review: { Args: { p_session: string }; Returns: boolean }
      academia_mentor_stats: { Args: { p_ids: string[] }; Returns: { mentor_id: string; rating: number; review_count: number }[] }

      recording_session: {
        Args: { p_call_id: string; p_action?: string; p_recording_id?: string; p_consent?: boolean; p_metadata?: Json };
        Returns: Json;
      };
      admin_topic_action: {
        Args: { p_action: string; p_id?: string; p_ids?: string[]; p_reason?: string }
        Returns: undefined
      }
      admin_topic_counts: {
        Args: Record<PropertyKey, never>
        Returns: { topic_id: string; post_count: number }[]
      }
      academia_community_action: { Args: { p_action: string; p_target?: string; p_payload?: Json }; Returns: string }
      academia_learning_progress: { Args: { p_goals: string[] }; Returns: { goal_id: string; total: number; approved: number }[] }
      academia_learning_action: { Args: { p_action: string; p_goal?: string; p_payload?: Json }; Returns: string }
      my_attributed_storage_usage: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      academia_manage_session: {
        Args: { p_session: string; p_action: string; p_reason?: string }
        Returns: Json
      }
      academia_my_notices: {
        Args: Record<PropertyKey, never>
        Returns: { session_id: string; title: string; reason: string; refunded: number }[]
      }

      create_chat_conversation: {
        Args: { p_participant_ids: string[]; p_group_name?: string | null; p_avatar_url?: string | null }
        Returns: Json
      }
      preview_chat_invite: {
        Args: { invite_code: string }
        Returns: Json
      }
      forward_chat_messages: {
        Args: { p_message_ids: string[]; p_conversation_ids: string[] }
        Returns: number
      }
      set_chat_history_cleared: {
        Args: { p_conversation_id: string; p_restore?: boolean }
        Returns: string | null
      }
      can_join_academia_room: { Args: { p_session: string }; Returns: Json }
      academia_set_live: { Args: { p_session: string; p_live: boolean }; Returns: Json }

      academia_cancel: { Args: { p_session: string }; Returns: Json }
      academia_complete: { Args: { p_session: string }; Returns: Json }
      academia_reserve: { Args: { p_session: string }; Returns: Json }
      active_banda_id: { Args: { p_user: string }; Returns: string }
      add_group_member: {
        Args: {
          _conversation_id: string
          _role?: Database["public"]["Enums"]["group_member_role"]
          _user_id: string
        }
        Returns: Json
      }
      admin_billing_overview: { Args: never; Returns: Json }
      admin_create_academia_session: {
        Args: {
          _description: string
          _format: string
          _mentor_id: string
          _price_coins: number
          _scheduled_at: string
          _spots: number
          _title: string
        }
        Returns: Json
      }
      admin_list_mentors: {
        Args: never
        Returns: {
          display_name: string
          is_verified_mentor: boolean
          specialty: string
          user_id: string
          username: string
        }[]
      }
      admin_list_pro_users: {
        Args: never
        Returns: {
          display_name: string
          id: string
          plan_expires_at: string
          username: string
        }[]
      }
      admin_set_billing_config: {
        Args: {
          p_currency?: string
          p_max_video_participants: number
          p_pro_annual: number
          p_pro_monthly: number
          p_video_enabled: boolean
          p_video_minutes_cap?: number
        }
        Returns: {
          academia_fee_percent: number
          currency: string
          id: number
          max_video_participants: number
          payout_daily_cap: number
          payout_hold_days: number
          payout_max_per_request: number
          payout_monthly_cap: number
          payout_require_kyc: boolean
          pro_annual: number
          pro_monthly: number
          updated_at: string
          updated_by: string | null
          video_enabled: boolean
          video_minutes_cap: number | null
        }
        SetofOptions: {
          from: "*"
          to: "billing_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_kumbu_available: {
        Args: { _amount: number; _user_id: string }
        Returns: Json
      }
      admin_set_kyc_verified: {
        Args: { p_user: string; p_verified: boolean }
        Returns: Json
      }
      admin_set_mentor_verified: {
        Args: { p_user: string; p_verified: boolean }
        Returns: Json
      }
      admin_set_user_plan: {
        Args: { p_months?: number; p_plan: string; p_user_id: string }
        Returns: Json
      }
      afroloc_b36zz: { Args: { n: number }; Returns: string }
      afroloc_nom: {
        Args: {
          p_cc: string
          p_lat: number
          p_lng: number
          p_mun: string
          p_prov: string
          p_zona: string
        }
        Returns: string
      }
      approve_mvp_candidate: { Args: { p_candidate_id: string }; Returns: Json }
      are_friends: { Args: { a: string; b: string }; Returns: boolean }
      banda_residency: { Args: { p_user?: string }; Returns: Json }
      can_join_live_room: { Args: { p_room: string }; Returns: Json }
      can_join_mokubico_room: { Args: { p_room: string }; Returns: Json }
      can_view_post: {
        Args: { p_owner: string; p_viewer: string; p_visibility: string }
        Returns: boolean
      }
      change_banda: {
        Args: {
          p_city: string
          p_country?: string
          p_lat?: number
          p_lng?: number
          p_name: string
          p_neighborhood?: string
        }
        Returns: Json
      }
      cleanup_old_signals: { Args: never; Returns: number }
      cleanup_stuck_calls: { Args: never; Returns: number }
      compute_weekly_ranking: { Args: never; Returns: Json }
      consume_mvp_access_code: {
        Args: { p_code: string; p_user_id: string }
        Returns: boolean
      }
      claim_direct_call: {
        Args: { p_call_id: string }
        Returns: boolean
      }
      account_current_session_id: { Args: never; Returns: string }
      finish_direct_call: {
        Args: { p_call_id: string; p_outcome: string }
        Returns: boolean
      }
      create_livekit_call: {
        Args: { p_call_type?: string; p_callee_id: string; p_conversation_id?: string }
        Returns: string
      }
      create_call: {
        Args: {
          p_call_type?: string
          p_callee_id: string
          p_conversation_id?: string
        }
        Returns: string
      }
      fulfill_credit_purchase: {
        Args: { p_provider_ref?: string; p_purchase_id: string }
        Returns: Json
      }
      fulfill_kumbu_purchase: {
        Args: { p_provider_ref?: string; p_purchase_id: string }
        Returns: Json
      }
      fulfill_pro_subscription: {
        Args: { p_provider_ref?: string; p_purchase_id: string }
        Returns: Json
      }
      generate_afroloc_code: { Args: { p_user_id: string }; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      generate_mvp_access_code: { Args: never; Returns: string }
      get_my_profile: {
        Args: never
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"] | null
          afroloc_certification_status: string
          afroloc_certified_at: string | null
          afroloc_certified_by: string | null
          afroloc_code: string | null
          app_tour_completed: boolean | null
          avatar_url: string | null
          bio: string | null
          birthday: string | null
          city: string | null
          contacts_synced: boolean | null
          country_code: string | null
          created_at: string
          display_name: string
          email: string | null
          founder_number: number | null
          gender: Database["public"]["Enums"]["gender"] | null
          id: string
          is_creator: boolean
          is_online: boolean | null
          is_verified: boolean | null
          kumbu_available: number
          kumbu_earned: number
          kumbu_lifetime: number
          kyc_verified: boolean
          last_seen: string | null
          latitude: number | null
          level: string
          longitude: number | null
          neighborhood: string | null
          onboarding_completed: boolean | null
          partner_user_id: string | null
          phone_number: string | null
          photos_visibility:
            | Database["public"]["Enums"]["photos_visibility"]
            | null
          plan: string
          plan_expires_at: string | null
          profile_theme_color: string | null
          show_last_seen: boolean | null
          show_online_status: boolean | null
          show_read_receipts: boolean | null
          show_typing_indicators: boolean | null
          status_message: string | null
          suspended_until: string | null
          suspension_reason: string | null
          two_factor_enabled: boolean | null
          updated_at: string
          username: string
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_public_profile: { Args: { p_username: string }; Returns: Json }
      get_public_profiles_by_ids: {
        Args: { p_ids: string[] }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          id: string
          is_online: boolean
          last_seen: string
          level: string
          status_message: string
          username: string
        }[]
      }
      get_public_table_columns: {
        Args: { _table: string }
        Returns: {
          column_name: string
          data_type: string
          ordinal_position: number
        }[]
      }
      get_ritmo_reaction_counts: { Args: { p_ritmo_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_live_guest: {
        Args: { p_session: string; p_user: string }
        Returns: boolean
      }
      is_brada: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      is_call_initiator: {
        Args: { p_call_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_call_participant: {
        Args: { p_call_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      is_kamba: {
        Args: { p_owner: string; p_viewer: string }
        Returns: boolean
      }
      is_moderator_or_admin: { Args: { p_user_id: string }; Returns: boolean }
      is_pro: { Args: { p_user?: string }; Returns: boolean }
      is_profile_owner: { Args: { profile_id: string }; Returns: boolean }
      join_banda_by_location: {
        Args: { p_city: string; p_country?: string; p_name: string }
        Returns: string
      }
      kumbu_award: {
        Args: {
          p_action_type: string
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_source?: string
          p_user_id: string
        }
        Returns: Json
      }
      kumbu_refund: {
        Args: {
          p_description?: string
          p_reference_id: string
          p_source?: string
        }
        Returns: Json
      }
      kumbu_spend: {
        Args: {
          p_action_type?: string
          p_amount: number
          p_description?: string
          p_reference_id?: string
          p_source?: string
        }
        Returns: Json
      }
      kumbu_topup: {
        Args: { _amount: number; _package?: string }
        Returns: Json
      }
      live_accept_invite: { Args: { p_session: string }; Returns: Json }
      live_decline_invite: { Args: { p_session: string }; Returns: Json }
      live_invite: {
        Args: { p_session: string; p_user_ids: string[] }
        Returns: Json
      }
      live_session_access_info: {
        Args: { p_session_id: string }
        Returns: Json
      }
      live_session_host_id: { Args: { p_session: string }; Returns: string }
      mark_message_read: { Args: { p_message_id: string }; Returns: undefined }
      mokubico_conversa_host: { Args: { p_conversa: string }; Returns: string }
      mokubico_is_guest: {
        Args: { p_conversa: string; p_user: string }
        Returns: boolean
      }
      podp_check_in: {
        Args: { p_accuracy?: number; p_lat: number; p_lng: number }
        Returns: Json
      }
      podp_haversine_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      podp_streak: { Args: { p_user: string }; Returns: number }
      process_payout: {
        Args: { p_action: string; p_payout_id: string; p_reason?: string }
        Returns: Json
      }
      reject_mvp_candidate: {
        Args: { p_candidate_id: string; p_reason?: string }
        Returns: Json
      }
      remove_group_member: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: Json
      }
      request_afroloc_certification: { Args: never; Returns: Json }
      request_payout: { Args: { p_amount_kumbu: number }; Returns: Json }
      revoke_other_sessions: {
        Args: { current_session_id?: string }
        Returns: undefined
      }
      set_afroloc_certification: {
        Args: { p_certified: boolean; p_user_id: string }
        Returns: Json
      }
      set_member_role: {
        Args: {
          _conversation_id: string
          _role: Database["public"]["Enums"]["group_member_role"]
          _user_id: string
        }
        Returns: Json
      }
      update_group_info: {
        Args: { _avatar_url?: string; _conversation_id: string; _name?: string }
        Returns: Json
      }
      use_group_invite: { Args: { invite_code: string }; Returns: Json }
      user_is_participant: { Args: { conv_id: string }; Returns: boolean }
      users_share_device: { Args: { a: string; b: string }; Returns: boolean }
      validate_mvp_access_code: { Args: { p_code: string }; Returns: Json }
    }
    Enums: {
      account_status: "active" | "suspended" | "deleted" | "pending" | "banned"
      ad_status:
        | "draft"
        | "pending_review"
        | "active"
        | "paused"
        | "completed"
        | "rejected"
      ad_type: "promoted_post" | "business_profile" | "sponsored_story"
      app_role: "admin" | "moderator" | "user"
      appeal_status: "pending" | "under_review" | "approved" | "rejected"
      artistic_category: "singer" | "comedian" | "performer" | "influencer"
      credit_transaction_type:
        | "purchase"
        | "spend"
        | "refund"
        | "bonus"
        | "adjustment"
      friend_request_status: "pending" | "accepted" | "rejected" | "blocked"
      gender: "male" | "female" | "other" | "prefer_not_to_say"
      group_member_role: "admin" | "member"
      moderation_action_type:
        | "hide_post"
        | "unhide_post"
        | "delete_post"
        | "hide_comment"
        | "unhide_comment"
        | "delete_comment"
        | "warn_user"
        | "suspend_user"
        | "unsuspend_user"
        | "ban_user"
        | "unban_user"
        | "dismiss_report"
        | "resolve_report"
      palco_type: "standard" | "premium"
      photos_visibility: "everyone" | "friends" | "nobody"
      report_category:
        | "spam"
        | "harassment"
        | "hate_speech"
        | "nudity"
        | "violence"
        | "misinformation"
        | "impersonation"
        | "other"
      report_status: "pending" | "reviewing" | "resolved" | "dismissed"
      ritmo_reaction_type: "sankofa" | "ubuntu" | "djembe" | "shango" | "eish"
      strike_status: "active" | "expired" | "appealed" | "revoked"
      verification_type: "phone" | "email"
      violation_category:
        | "hate_speech"
        | "bullying"
        | "harassment"
        | "nudity"
        | "sexual_content"
        | "violence"
        | "graphic_violence"
        | "spam"
        | "scam"
        | "misinformation"
        | "impersonation"
        | "intellectual_property"
        | "self_harm"
        | "illegal_activity"
        | "other"
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
      account_status: ["active", "suspended", "deleted", "pending", "banned"],
      ad_status: [
        "draft",
        "pending_review",
        "active",
        "paused",
        "completed",
        "rejected",
      ],
      ad_type: ["promoted_post", "business_profile", "sponsored_story"],
      app_role: ["admin", "moderator", "user"],
      appeal_status: ["pending", "under_review", "approved", "rejected"],
      artistic_category: ["singer", "comedian", "performer", "influencer"],
      credit_transaction_type: [
        "purchase",
        "spend",
        "refund",
        "bonus",
        "adjustment",
      ],
      friend_request_status: ["pending", "accepted", "rejected", "blocked"],
      gender: ["male", "female", "other", "prefer_not_to_say"],
      group_member_role: ["admin", "member"],
      moderation_action_type: [
        "hide_post",
        "unhide_post",
        "delete_post",
        "hide_comment",
        "unhide_comment",
        "delete_comment",
        "warn_user",
        "suspend_user",
        "unsuspend_user",
        "ban_user",
        "unban_user",
        "dismiss_report",
        "resolve_report",
      ],
      palco_type: ["standard", "premium"],
      photos_visibility: ["everyone", "friends", "nobody"],
      report_category: [
        "spam",
        "harassment",
        "hate_speech",
        "nudity",
        "violence",
        "misinformation",
        "impersonation",
        "other",
      ],
      report_status: ["pending", "reviewing", "resolved", "dismissed"],
      ritmo_reaction_type: ["sankofa", "ubuntu", "djembe", "shango", "eish"],
      strike_status: ["active", "expired", "appealed", "revoked"],
      verification_type: ["phone", "email"],
      violation_category: [
        "hate_speech",
        "bullying",
        "harassment",
        "nudity",
        "sexual_content",
        "violence",
        "graphic_violence",
        "spam",
        "scam",
        "misinformation",
        "impersonation",
        "intellectual_property",
        "self_harm",
        "illegal_activity",
        "other",
      ],
    },
  },
} as const

