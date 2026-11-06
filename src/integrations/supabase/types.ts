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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: number
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_channels: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          is_primary: boolean
          label: string
          norm: string | null
          organization_id: string
          type: string
          value: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          norm?: string | null
          organization_id: string
          type: string
          value: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          label?: string
          norm?: string | null
          organization_id?: string
          type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_channels_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_private: {
        Row: {
          contact_id: string
          doc: string | null
          doc_digits: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          doc?: string | null
          doc_digits?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          doc?: string | null
          doc_digits?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_private_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: true
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_private_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contact_tags: {
        Row: {
          contact_id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          organization_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          archived_at: string | null
          category: string | null
          created_at: string
          created_by: string | null
          email: string | null
          email_norm: string | null
          id: string
          kind: string
          merged_into_id: string | null
          name: string
          notes: string | null
          organization_id: string
          owner_id: string | null
          phone: string | null
          phone_digits: string | null
          pj_contact_email: string | null
          pj_contact_name: string | null
          pj_contact_phone: string | null
          pj_contact_role: string | null
          preferences: string | null
          relationship: string
          source: string | null
          trade_name: string | null
          updated_at: string
          whatsapp: string | null
          whatsapp_digits: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_norm?: string | null
          id?: string
          kind?: string
          merged_into_id?: string | null
          name: string
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          phone?: string | null
          phone_digits?: string | null
          pj_contact_email?: string | null
          pj_contact_name?: string | null
          pj_contact_phone?: string | null
          pj_contact_role?: string | null
          preferences?: string | null
          relationship?: string
          source?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_digits?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          archived_at?: string | null
          category?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_norm?: string | null
          id?: string
          kind?: string
          merged_into_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          phone?: string | null
          phone_digits?: string | null
          pj_contact_email?: string | null
          pj_contact_name?: string | null
          pj_contact_phone?: string | null
          pj_contact_role?: string | null
          preferences?: string | null
          relationship?: string
          source?: string | null
          trade_name?: string | null
          updated_at?: string
          whatsapp?: string | null
          whatsapp_digits?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          lost_at: string | null
          lost_reason: string | null
          notes: string | null
          organization_id: string
          owner_id: string | null
          stage_id: string
          title: string
          updated_at: string
          value_cents: number | null
          won_at: string | null
          won_by: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organization_id: string
          owner_id?: string | null
          stage_id: string
          title: string
          updated_at?: string
          value_cents?: number | null
          won_at?: string | null
          won_by?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          lost_at?: string | null
          lost_reason?: string | null
          notes?: string | null
          organization_id?: string
          owner_id?: string | null
          stage_id?: string
          title?: string
          updated_at?: string
          value_cents?: number | null
          won_at?: string | null
          won_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_duplicate_dismissals: {
        Row: {
          contact_a: string
          contact_b: string
          created_at: string
          created_by: string | null
          organization_id: string
        }
        Insert: {
          contact_a: string
          contact_b: string
          created_at?: string
          created_by?: string | null
          organization_id: string
        }
        Update: {
          contact_a?: string
          contact_b?: string
          created_at?: string
          created_by?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_duplicate_dismissals_contact_a_fkey"
            columns: ["contact_a"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_duplicate_dismissals_contact_b_fkey"
            columns: ["contact_b"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_duplicate_dismissals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_intake_log: {
        Row: {
          contact_id: string | null
          errors: string[]
          id: string
          organization_id: string
          payload: Json
          received_at: string
          received_by: string | null
          result: string
          source: string
        }
        Insert: {
          contact_id?: string | null
          errors?: string[]
          id?: string
          organization_id: string
          payload?: Json
          received_at?: string
          received_by?: string | null
          result: string
          source: string
        }
        Update: {
          contact_id?: string | null
          errors?: string[]
          id?: string
          organization_id?: string
          payload?: Json
          received_at?: string
          received_by?: string | null
          result?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_intake_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_intake_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          author_id: string | null
          body: string | null
          contact_id: string
          created_at: string
          deal_id: string | null
          event: string | null
          id: string
          kind: string
          metadata: Json
          occurred_at: string
          organization_id: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          contact_id: string
          created_at?: string
          deal_id?: string | null
          event?: string | null
          id?: string
          kind: string
          metadata?: Json
          occurred_at?: string
          organization_id: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          event?: string | null
          id?: string
          kind?: string
          metadata?: Json
          occurred_at?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipeline_stages: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          organization_id: string
          position: number
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          organization_id: string
          position?: number
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          organization_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_reminders: {
        Row: {
          assignee_id: string | null
          canceled_at: string | null
          contact_id: string
          created_at: string
          created_by: string | null
          deal_id: string | null
          description: string | null
          done_at: string | null
          done_by: string | null
          due_date: string
          due_time: string | null
          id: string
          is_auto: boolean
          organization_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          canceled_at?: string | null
          contact_id: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date: string
          due_time?: string | null
          id?: string
          is_auto?: boolean
          organization_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          canceled_at?: string | null
          contact_id?: string
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          description?: string | null
          done_at?: string | null
          done_by?: string | null
          due_date?: string
          due_time?: string | null
          id?: string
          is_auto?: boolean
          organization_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reminders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_reminders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          client_user_id: string | null
          created_at: string
          crm_contact_id: string | null
          id: string
          mime_type: string | null
          module_key: string | null
          name: string
          organization_id: string
          path: string
          size_bytes: number | null
          uploaded_by: string | null
        }
        Insert: {
          bucket?: string
          client_user_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          id?: string
          mime_type?: string | null
          module_key?: string | null
          name: string
          organization_id: string
          path: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Update: {
          bucket?: string
          client_user_id?: string | null
          created_at?: string
          crm_contact_id?: string | null
          id?: string
          mime_type?: string | null
          module_key?: string | null
          name?: string
          organization_id?: string
          path?: string
          size_bytes?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_crm_contact_id_fkey"
            columns: ["crm_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_dependencies: {
        Row: {
          depends_on: string
          module_key: string
        }
        Insert: {
          depends_on: string
          module_key: string
        }
        Update: {
          depends_on?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_dependencies_depends_on_fkey"
            columns: ["depends_on"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "module_dependencies_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          description: string | null
          is_available: boolean
          is_core: boolean
          key: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          is_available?: boolean
          is_core?: boolean
          key: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          is_available?: boolean
          is_core?: boolean
          key?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["org_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["org_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_roles: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_roles_organization_id_user_id_fkey"
            columns: ["organization_id", "user_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["organization_id", "user_id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_modules: {
        Row: {
          enabled: boolean
          module_key: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          module_key: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          module_key?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_onboarding: {
        Row: {
          admin_needs: string[]
          audience: string[]
          billing_models: string[]
          business_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          current_step: number
          decisions: Json | null
          finance_needs: string[]
          main_activity: string | null
          marketing_needs: string[]
          organization_id: string
          pains: string[]
          recommendation: Json | null
          segment_key: string | null
          services: string[]
          status: string
          team_size: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_needs?: string[]
          audience?: string[]
          billing_models?: string[]
          business_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          current_step?: number
          decisions?: Json | null
          finance_needs?: string[]
          main_activity?: string | null
          marketing_needs?: string[]
          organization_id: string
          pains?: string[]
          recommendation?: Json | null
          segment_key?: string | null
          services?: string[]
          status?: string
          team_size?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_needs?: string[]
          audience?: string[]
          billing_models?: string[]
          business_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          current_step?: number
          decisions?: Json | null
          finance_needs?: string[]
          main_activity?: string | null
          marketing_needs?: string[]
          organization_id?: string
          pains?: string[]
          recommendation?: Json | null
          segment_key?: string | null
          services?: string[]
          status?: string
          team_size?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_onboarding_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_onboarding_segment_key_fkey"
            columns: ["segment_key"]
            isOneToOne: false
            referencedRelation: "segment_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      organization_presets: {
        Row: {
          created_at: string
          key: string
          name: string
          organization_id: string | null
          segment_key: string | null
          settings: Json
        }
        Insert: {
          created_at?: string
          key: string
          name: string
          organization_id?: string | null
          segment_key?: string | null
          settings?: Json
        }
        Update: {
          created_at?: string
          key?: string
          name?: string
          organization_id?: string | null
          segment_key?: string | null
          settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_presets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_presets_segment_key_fkey"
            columns: ["segment_key"]
            isOneToOne: false
            referencedRelation: "segment_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      organization_settings: {
        Row: {
          key: string
          organization_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          organization_id: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          segment: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          segment?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          segment?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string
          description: string | null
          key: string
          module_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          module_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          module_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
        ]
      }
      plan_modules: {
        Row: {
          module_key: string
          plan_id: string
        }
        Insert: {
          module_key: string
          plan_id: string
        }
        Update: {
          module_key?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_modules_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          ai_monthly_quota: number | null
          billing_interval: string
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          max_members: number | null
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          ai_monthly_quota?: number | null
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          max_members?: number | null
          name: string
          price_cents?: number
          updated_at?: string
        }
        Update: {
          ai_monthly_quota?: number | null
          billing_interval?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          max_members?: number | null
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          locale: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          locale?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Insert: {
          permission_key: string
          role: Database["public"]["Enums"]["org_role"]
        }
        Update: {
          permission_key?: string
          role?: Database["public"]["Enums"]["org_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      segment_templates: {
        Row: {
          billing_suggestions: string[]
          created_at: string
          description: string | null
          flows: Json
          future_modules: string[]
          key: string
          modules: string[]
          name: string
          privacy_notice: string | null
          sensitive_data: boolean
          sort_order: number
        }
        Insert: {
          billing_suggestions?: string[]
          created_at?: string
          description?: string | null
          flows?: Json
          future_modules?: string[]
          key: string
          modules?: string[]
          name: string
          privacy_notice?: string | null
          sensitive_data?: boolean
          sort_order?: number
        }
        Update: {
          billing_suggestions?: string[]
          created_at?: string
          description?: string | null
          flows?: Json
          future_modules?: string[]
          key?: string
          modules?: string[]
          name?: string
          privacy_notice?: string | null
          sensitive_data?: boolean
          sort_order?: number
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string
          plan_id: string
          provider: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id: string
          plan_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          cancel_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          organization_id: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          organization_id: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          organization_id?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_dashboard_layouts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      complete_onboarding: {
        Args: {
          _business_name: string
          _decisions: Json
          _interests: string[]
          _modules: string[]
          _org: string
          _segment: string
          _settings: Json
        }
        Returns: undefined
      }
      create_invitation: {
        Args: {
          _email: string
          _org: string
          _role: Database["public"]["Enums"]["org_role"]
        }
        Returns: string
      }
      create_organization: {
        Args: { _name: string; _segment?: string; _slug: string }
        Returns: string
      }
      crm_archive_stage: {
        Args: { _org: string; _stage: string; _target: string }
        Returns: number
      }
      crm_duplicate_pairs: {
        Args: { _org: string }
        Returns: {
          a: string
          b: string
          reason: string
        }[]
      }
      crm_email_norm: { Args: { _t: string }; Returns: string }
      crm_find_duplicates: {
        Args: {
          _doc: string
          _email: string
          _exclude?: string
          _org: string
          _phone: string
          _whatsapp: string
        }
        Returns: {
          archived: boolean
          email: string
          id: string
          kind: string
          name: string
          phone: string
          reason: string
        }[]
      }
      crm_intake: {
        Args: { _org: string; _payload: Json; _source: string }
        Returns: Json
      }
      crm_log: {
        Args: {
          _body: string
          _contact: string
          _deal: string
          _event: string
          _meta?: Json
          _org: string
        }
        Returns: undefined
      }
      crm_merge_contacts: {
        Args: { _drop: string; _keep: string; _org: string }
        Returns: undefined
      }
      crm_phone_norm: { Args: { _t: string }; Returns: string }
      crm_reorder_stages: {
        Args: { _ids: string[]; _org: string }
        Returns: undefined
      }
      crm_seed_stages: { Args: { _org: string }; Returns: undefined }
      crm_valid_doc: { Args: { _d: string }; Returns: boolean }
      get_org_preset: { Args: { _org: string }; Returns: Json }
      has_org_permission: {
        Args: { _org: string; _permission: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string }; Returns: boolean }
      my_org_permissions: { Args: { _org: string }; Returns: string[] }
      remove_member: {
        Args: { _org: string; _user: string }
        Returns: undefined
      }
      revoke_invitation: { Args: { _id: string }; Returns: undefined }
      set_member_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["org_role"]
          _user: string
        }
        Returns: undefined
      }
      shares_org_with: { Args: { _user: string }; Returns: boolean }
      storage_org_permission: {
        Args: { _name: string; _op: string }
        Returns: boolean
      }
      write_audit: {
        Args: {
          _action: string
          _id: string
          _meta?: Json
          _org: string
          _type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      member_status: "invited" | "active" | "suspended"
      org_role:
        | "owner"
        | "admin"
        | "member"
        | "viewer"
        | "manager"
        | "collaborator"
        | "freelancer"
        | "client"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
      member_status: ["invited", "active", "suspended"],
      org_role: [
        "owner",
        "admin",
        "member",
        "viewer",
        "manager",
        "collaborator",
        "freelancer",
        "client",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const
