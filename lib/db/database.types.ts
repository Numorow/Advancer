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
      audit_log: {
        Row: {
          action: string
          actor: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          event_id: string | null
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          event_id?: string | null
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          event_id?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          sort: number
          version_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          sort?: number
          version_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          sort?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_version_id_budget_versions_id_fk"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "budget_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_inc_gst_cents: number
          approval_status: Database["public"]["Enums"]["approval_status"]
          category_id: string
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          insurance: string | null
          item: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          quote_link: string | null
          quoted_ex_gst_cents: number
          rfq_no: string | null
          sort: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          actual_inc_gst_cents?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category_id: string
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          insurance?: string | null
          item: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          quote_link?: string | null
          quoted_ex_gst_cents?: number
          rfq_no?: string | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_inc_gst_cents?: number
          approval_status?: Database["public"]["Enums"]["approval_status"]
          category_id?: string
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          insurance?: string | null
          item?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          quote_link?: string | null
          quoted_ex_gst_cents?: number
          rfq_no?: string | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_category_id_budget_categories_id_fk"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          is_active: boolean
          label: string
          locked: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          is_active?: boolean
          label: string
          locked?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          is_active?: boolean
          label?: string
          locked?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          event_id: string
          field: string
          id: string
          item_id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          event_id: string
          field: string
          id?: string
          item_id: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          event_id?: string
          field?: string
          id?: string
          item_id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_status_history_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_status_history_item_id_checklist_items_id_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          booking_status: Database["public"]["Enums"]["booking_status"]
          budget_item_id: string | null
          created_at: string
          deleted_at: string | null
          details: string | null
          due_date: string | null
          event_id: string
          id: string
          item: string
          notes: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          priority: Database["public"]["Enums"]["priority"]
          responsible: string | null
          rfq_status: Database["public"]["Enums"]["rfq_status"]
          schedule_entry_id: string | null
          section_id: string
          sort: number
          status: Database["public"]["Enums"]["progress_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          booking_status?: Database["public"]["Enums"]["booking_status"]
          budget_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string | null
          due_date?: string | null
          event_id: string
          id?: string
          item: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: Database["public"]["Enums"]["priority"]
          responsible?: string | null
          rfq_status?: Database["public"]["Enums"]["rfq_status"]
          schedule_entry_id?: string | null
          section_id: string
          sort?: number
          status?: Database["public"]["Enums"]["progress_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_status?: Database["public"]["Enums"]["booking_status"]
          budget_item_id?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
          item?: string
          notes?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          priority?: Database["public"]["Enums"]["priority"]
          responsible?: string | null
          rfq_status?: Database["public"]["Enums"]["rfq_status"]
          schedule_entry_id?: string | null
          section_id?: string
          sort?: number
          status?: Database["public"]["Enums"]["progress_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_budget_item_fk"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_schedule_entry_fk"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_section_id_checklist_sections_id_fk"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "checklist_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sections: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          sort: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          sort?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sections_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_roles: {
        Row: {
          created_at: string
          default_rate_cents: number | null
          id: string
          name: string
          org_id: string
          sort: number
        }
        Insert: {
          created_at?: string
          default_rate_cents?: number | null
          id?: string
          name: string
          org_id: string
          sort?: number
        }
        Update: {
          created_at?: string
          default_rate_cents?: number | null
          id?: string
          name?: string
          org_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "crew_roles_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_shifts: {
        Row: {
          actual_hours: number | null
          created_at: string
          day_label: string | null
          deleted_at: string | null
          event_id: string
          finish_time: string | null
          id: string
          notes: string | null
          person: string | null
          rate_cents: number | null
          role_id: string | null
          role_name: string | null
          scheduled_hours: number | null
          shift_date: string | null
          sort: number
          start_time: string | null
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          created_at?: string
          day_label?: string | null
          deleted_at?: string | null
          event_id: string
          finish_time?: string | null
          id?: string
          notes?: string | null
          person?: string | null
          rate_cents?: number | null
          role_id?: string | null
          role_name?: string | null
          scheduled_hours?: number | null
          shift_date?: string | null
          sort?: number
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          created_at?: string
          day_label?: string | null
          deleted_at?: string | null
          event_id?: string
          finish_time?: string | null
          id?: string
          notes?: string | null
          person?: string | null
          rate_cents?: number | null
          role_id?: string | null
          role_name?: string | null
          scheduled_hours?: number | null
          shift_date?: string | null
          sort?: number
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_shifts_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crew_shifts_role_id_crew_roles_id_fk"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "crew_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_billing_profiles: {
        Row: {
          abn: string | null
          address: string | null
          approver: string | null
          billing_entity: string | null
          created_at: string
          event_id: string
          id: string
          notes: string | null
          responsible: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          address?: string | null
          approver?: string | null
          billing_entity?: string | null
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          responsible?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          address?: string | null
          approver?: string | null
          billing_entity?: string | null
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          responsible?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_billing_profiles_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          event_id: string
          id: string
          mobile: string | null
          name: string | null
          position: string | null
          sort: number
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          mobile?: string | null
          name?: string | null
          position?: string | null
          sort?: number
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          mobile?: string | null
          name?: string | null
          position?: string | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_contacts_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_site_maps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          label: string | null
          url: string | null
          version: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          label?: string | null
          url?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          label?: string | null
          url?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_site_maps_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          end_date: string | null
          id: string
          name: string
          org_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["event_status"]
          timezone: string
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name: string
          org_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          name?: string
          org_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          timezone?: string
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_clients_id_fk"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_venues_id_fk"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      fencing_requirements: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          fence_type: string | null
          id: string
          length_m: number | null
          location: string | null
          mitigation_m: number | null
          notes: string | null
          sort: number
          supplier_id: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_id: string
          fence_type?: string | null
          id?: string
          length_m?: number | null
          location?: string | null
          mitigation_m?: number | null
          notes?: string | null
          sort?: number
          supplier_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          fence_type?: string | null
          id?: string
          length_m?: number | null
          location?: string | null
          mitigation_m?: number | null
          notes?: string | null
          sort?: number
          supplier_id?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fencing_requirements_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fencing_requirements_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      furniture_distribution: {
        Row: {
          asset: string | null
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          location: string | null
          notes: string | null
          quantity: number | null
          sort: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          asset?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          asset?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "furniture_distribution_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "furniture_distribution_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_job_rows: {
        Row: {
          created_at: string
          id: string
          job_id: string
          mapped_table: string | null
          raw: Json | null
          row_ref: string | null
          sheet: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          mapped_table?: string | null
          raw?: Json | null
          row_ref?: string | null
          sheet: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          mapped_table?: string | null
          raw?: Json | null
          row_ref?: string | null
          sheet?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_job_rows_job_id_import_jobs_id_fk"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string | null
          filename: string
          id: string
          org_id: string
          report: Json | null
          status: Database["public"]["Enums"]["import_status"]
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filename: string
          id?: string
          org_id: string
          report?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          filename?: string
          id?: string
          org_id?: string
          report?: Json | null
          status?: Database["public"]["Enums"]["import_status"]
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_tasks: {
        Row: {
          completed: boolean
          created_at: string
          deleted_at: string | null
          event_id: string
          hours: number | null
          id: string
          rate_cents: number | null
          role: string | null
          sort: number
          task: string | null
          task_no: number | null
          updated_at: string
          week_date: string | null
          week_label: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          deleted_at?: string | null
          event_id: string
          hours?: number | null
          id?: string
          rate_cents?: number | null
          role?: string | null
          sort?: number
          task?: string | null
          task_no?: number | null
          updated_at?: string
          week_date?: string | null
          week_label?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          hours?: number | null
          id?: string
          rate_cents?: number | null
          role?: string | null
          sort?: number
          task?: string | null
          task_no?: number | null
          updated_at?: string
          week_date?: string | null
          week_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "management_tasks_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      power_requirements: {
        Row: {
          category: string | null
          collection_date: string | null
          created_at: string
          deleted_at: string | null
          delivery_date: string | null
          event_id: string
          id: string
          item: string | null
          location: string | null
          notes: string | null
          quantity: number | null
          sort: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          collection_date?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string | null
          event_id: string
          id?: string
          item?: string | null
          location?: string | null
          notes?: string | null
          quantity?: number | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          collection_date?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_date?: string | null
          event_id?: string
          id?: string
          item?: string | null
          location?: string | null
          notes?: string | null
          quantity?: number | null
          sort?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "power_requirements_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "power_requirements_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          activity: string | null
          created_at: string
          deleted_at: string | null
          event_id: string
          finish_time: string | null
          id: string
          item_date: string | null
          notes: string | null
          sort: number
          start_time: string | null
          updated_at: string
        }
        Insert: {
          activity?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id: string
          finish_time?: string | null
          id?: string
          item_date?: string | null
          notes?: string | null
          sort?: number
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          activity?: string | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          finish_time?: string | null
          id?: string
          item_date?: string | null
          notes?: string | null
          sort?: number
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_items_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reference_values: {
        Row: {
          category: string
          created_at: string
          id: string
          label: string | null
          org_id: string
          sort: number
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          label?: string | null
          org_id: string
          sort?: number
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          label?: string | null
          org_id?: string
          sort?: number
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_values_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          file_path: string
          id: string
          label: string | null
          rfq_recipient_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          file_path: string
          id?: string
          label?: string | null
          rfq_recipient_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          file_path?: string
          id?: string
          label?: string | null
          rfq_recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_attachments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_attachments_rfq_recipient_id_fkey"
            columns: ["rfq_recipient_id"]
            isOneToOne: false
            referencedRelation: "rfq_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_items: {
        Row: {
          created_at: string
          description: string
          event_id: string
          id: string
          quantity: string | null
          rfq_id: string
          sort: number
          unit: string | null
        }
        Insert: {
          created_at?: string
          description: string
          event_id: string
          id?: string
          quantity?: string | null
          rfq_id: string
          sort?: number
          unit?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          event_id?: string
          id?: string
          quantity?: string | null
          rfq_id?: string
          sort?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rfq_items_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_items_rfq_id_rfqs_id_fk"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_quotes: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          line_total_cents: number | null
          notes: string | null
          rfq_item_id: string
          rfq_recipient_id: string
          unit_price_cents: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          line_total_cents?: number | null
          notes?: string | null
          rfq_item_id: string
          rfq_recipient_id: string
          unit_price_cents?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          line_total_cents?: number | null
          notes?: string | null
          rfq_item_id?: string
          rfq_recipient_id?: string
          unit_price_cents?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quotes_rfq_item_id_fkey"
            columns: ["rfq_item_id"]
            isOneToOne: false
            referencedRelation: "rfq_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_quotes_rfq_recipient_id_fkey"
            columns: ["rfq_recipient_id"]
            isOneToOne: false
            referencedRelation: "rfq_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      rfq_recipients: {
        Row: {
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          notes: string | null
          quote_link: string | null
          quoted_ex_gst_cents: number | null
          responded_at: string | null
          rfq_id: string
          sent_at: string | null
          status: Database["public"]["Enums"]["rfq_recipient_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          quote_link?: string | null
          quoted_ex_gst_cents?: number | null
          responded_at?: string | null
          rfq_id: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["rfq_recipient_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          quote_link?: string | null
          quoted_ex_gst_cents?: number | null
          responded_at?: string | null
          rfq_id?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["rfq_recipient_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfq_recipients_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_recipients_rfq_id_rfqs_id_fk"
            columns: ["rfq_id"]
            isOneToOne: false
            referencedRelation: "rfqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfq_recipients_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      rfqs: {
        Row: {
          awarded_recipient_id: string | null
          budget_category_id: string | null
          budget_item_id: string | null
          checklist_item_id: string | null
          collection_date: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_date: string | null
          event_id: string
          id: string
          location: string | null
          notes: string | null
          org_id: string
          response_due_date: string | null
          rfq_no: string | null
          status: Database["public"]["Enums"]["rfq_workflow_status"]
          title: string
          updated_at: string
        }
        Insert: {
          awarded_recipient_id?: string | null
          budget_category_id?: string | null
          budget_item_id?: string | null
          checklist_item_id?: string | null
          collection_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          event_id: string
          id?: string
          location?: string | null
          notes?: string | null
          org_id: string
          response_due_date?: string | null
          rfq_no?: string | null
          status?: Database["public"]["Enums"]["rfq_workflow_status"]
          title: string
          updated_at?: string
        }
        Update: {
          awarded_recipient_id?: string | null
          budget_category_id?: string | null
          budget_item_id?: string | null
          checklist_item_id?: string | null
          collection_date?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          event_id?: string
          id?: string
          location?: string | null
          notes?: string | null
          org_id?: string
          response_due_date?: string | null
          rfq_no?: string | null
          status?: Database["public"]["Enums"]["rfq_workflow_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rfqs_awarded_recipient_fk"
            columns: ["awarded_recipient_id"]
            isOneToOne: false
            referencedRelation: "rfq_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_budget_category_id_budget_categories_id_fk"
            columns: ["budget_category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_budget_item_fk"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_checklist_item_fk"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rfqs_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_entries: {
        Row: {
          action: string | null
          budget_item_id: string | null
          checklist_item_id: string | null
          completed: boolean
          created_at: string
          critical_path: boolean
          deleted_at: string | null
          event_date: string | null
          event_id: string
          finish_time: string | null
          id: string
          location: string | null
          notes: string | null
          site_poc: string | null
          sort: number
          start_time: string | null
          supplier_id: string | null
          supplier_text: string | null
          type: Database["public"]["Enums"]["schedule_type"] | null
          updated_at: string
        }
        Insert: {
          action?: string | null
          budget_item_id?: string | null
          checklist_item_id?: string | null
          completed?: boolean
          created_at?: string
          critical_path?: boolean
          deleted_at?: string | null
          event_date?: string | null
          event_id: string
          finish_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          site_poc?: string | null
          sort?: number
          start_time?: string | null
          supplier_id?: string | null
          supplier_text?: string | null
          type?: Database["public"]["Enums"]["schedule_type"] | null
          updated_at?: string
        }
        Update: {
          action?: string | null
          budget_item_id?: string | null
          checklist_item_id?: string | null
          completed?: boolean
          created_at?: string
          critical_path?: boolean
          deleted_at?: string | null
          event_date?: string | null
          event_id?: string
          finish_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          site_poc?: string | null
          sort?: number
          start_time?: string | null
          supplier_id?: string | null
          supplier_text?: string | null
          type?: Database["public"]["Enums"]["schedule_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_entries_budget_item_fk"
            columns: ["budget_item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_checklist_item_fk"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_entries_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      site_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          photo_path: string | null
          resolved: boolean
          schedule_entry_id: string | null
          severity: Database["public"]["Enums"]["site_note_severity"]
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          photo_path?: string | null
          resolved?: boolean
          schedule_entry_id?: string | null
          severity?: Database["public"]["Enums"]["site_note_severity"]
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          photo_path?: string | null
          resolved?: boolean
          schedule_entry_id?: string | null
          severity?: Database["public"]["Enums"]["site_note_severity"]
        }
        Relationships: [
          {
            foreignKeyName: "site_notes_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_notes_schedule_entry_id_schedule_entries_id_fk"
            columns: ["schedule_entry_id"]
            isOneToOne: false
            referencedRelation: "schedule_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      structures: {
        Row: {
          created_at: string
          deleted_at: string | null
          docs_received: boolean
          engineer_signoff: boolean
          event_id: string
          id: string
          length_m: number | null
          lighting: boolean
          link: string | null
          name: string | null
          notes: string | null
          pegged: boolean
          responsible: string | null
          sort: number
          supplier_id: string | null
          type: string | null
          updated_at: string
          walls: string | null
          weighted: boolean
          width_m: number | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          docs_received?: boolean
          engineer_signoff?: boolean
          event_id: string
          id?: string
          length_m?: number | null
          lighting?: boolean
          link?: string | null
          name?: string | null
          notes?: string | null
          pegged?: boolean
          responsible?: string | null
          sort?: number
          supplier_id?: string | null
          type?: string | null
          updated_at?: string
          walls?: string | null
          weighted?: boolean
          width_m?: number | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          docs_received?: boolean
          engineer_signoff?: boolean
          event_id?: string
          id?: string
          length_m?: number | null
          lighting?: boolean
          link?: string | null
          name?: string | null
          notes?: string | null
          pegged?: boolean
          responsible?: string | null
          sort?: number
          supplier_id?: string | null
          type?: string | null
          updated_at?: string
          walls?: string | null
          weighted?: boolean
          width_m?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "structures_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "structures_supplier_id_suppliers_id_fk"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_contacts: {
        Row: {
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          org_id: string
          phone: string | null
          role: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          org_id: string
          phone?: string | null
          role?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          org_id?: string
          phone?: string | null
          role?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_type: string | null
          file_path: string
          id: string
          label: string | null
          org_id: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_type?: string | null
          file_path: string
          id?: string
          label?: string | null
          org_id: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_type?: string | null
          file_path?: string
          id?: string
          label?: string | null
          org_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          abn: string | null
          contact_name: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          insurance: boolean
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          preferred: boolean
          service_categories: string[] | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          insurance?: boolean
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          preferred?: boolean
          service_categories?: string[] | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          contact_name?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          insurance?: boolean
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          preferred?: boolean
          service_categories?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      toilet_calculations: {
        Row: {
          area: string | null
          capacity: number | null
          created_at: string
          deleted_at: string | null
          event_id: string
          id: string
          pans: number | null
          quantity: number | null
          ratio_target: number | null
          sort: number
          toilet_type: string | null
          updated_at: string
        }
        Insert: {
          area?: string | null
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          event_id: string
          id?: string
          pans?: number | null
          quantity?: number | null
          ratio_target?: number | null
          sort?: number
          toilet_type?: string | null
          updated_at?: string
        }
        Update: {
          area?: string | null
          capacity?: number | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          id?: string
          pans?: number | null
          quantity?: number | null
          ratio_target?: number | null
          sort?: number
          toilet_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "toilet_calculations_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_movements: {
        Row: {
          contact_person: string | null
          created_at: string
          deleted_at: string | null
          direction: string | null
          doors_facing: string | null
          event_id: string
          from_to: string | null
          gate_entry: string | null
          id: string
          item: string | null
          move_date: string | null
          move_time: string | null
          notes: string | null
          sort: number
          truck_type: string | null
          updated_at: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          doors_facing?: string | null
          event_id: string
          from_to?: string | null
          gate_entry?: string | null
          id?: string
          item?: string | null
          move_date?: string | null
          move_time?: string | null
          notes?: string | null
          sort?: number
          truck_type?: string | null
          updated_at?: string
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          direction?: string | null
          doors_facing?: string | null
          event_id?: string
          from_to?: string | null
          gate_entry?: string | null
          id?: string
          item?: string | null
          move_date?: string | null
          move_time?: string | null
          notes?: string | null
          sort?: number
          truck_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_movements_event_id_events_id_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_org_id_organisations_id_fk"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_kyron_owner: { Args: never; Returns: string }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      booking_status: "not_booked" | "tentative" | "booked" | "cancelled"
      event_status: "planning" | "active" | "delivered" | "archived"
      import_status:
        | "uploaded"
        | "parsed"
        | "previewed"
        | "committed"
        | "failed"
      org_role:
        | "owner"
        | "admin"
        | "event_manager"
        | "operations_manager"
        | "accounts"
        | "site_manager"
        | "viewer"
      payment_status: "unpaid" | "partial" | "paid"
      priority: "low" | "normal" | "high" | "critical"
      progress_status: "not_started" | "in_progress" | "blocked" | "done"
      rfq_recipient_status: "pending" | "sent" | "responded" | "declined"
      rfq_status: "not_sent" | "sent" | "responded" | "declined"
      rfq_workflow_status:
        | "draft"
        | "sent"
        | "responded"
        | "awarded"
        | "declined"
        | "cancelled"
      schedule_type:
        | "ON_SITE"
        | "INSTALL"
        | "COLLECTION"
        | "DELIVERY"
        | "SHOW_TIME"
        | "BUMP_OUT"
        | "DROP_OFF"
        | "PICK_UP"
        | "SECURITY"
      site_note_severity: "info" | "issue" | "urgent"
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
      approval_status: ["pending", "approved", "rejected"],
      booking_status: ["not_booked", "tentative", "booked", "cancelled"],
      event_status: ["planning", "active", "delivered", "archived"],
      import_status: ["uploaded", "parsed", "previewed", "committed", "failed"],
      org_role: [
        "owner",
        "admin",
        "event_manager",
        "operations_manager",
        "accounts",
        "site_manager",
        "viewer",
      ],
      payment_status: ["unpaid", "partial", "paid"],
      priority: ["low", "normal", "high", "critical"],
      progress_status: ["not_started", "in_progress", "blocked", "done"],
      rfq_recipient_status: ["pending", "sent", "responded", "declined"],
      rfq_status: ["not_sent", "sent", "responded", "declined"],
      rfq_workflow_status: [
        "draft",
        "sent",
        "responded",
        "awarded",
        "declined",
        "cancelled",
      ],
      schedule_type: [
        "ON_SITE",
        "INSTALL",
        "COLLECTION",
        "DELIVERY",
        "SHOW_TIME",
        "BUMP_OUT",
        "DROP_OFF",
        "PICK_UP",
        "SECURITY",
      ],
      site_note_severity: ["info", "issue", "urgent"],
    },
  },
} as const
