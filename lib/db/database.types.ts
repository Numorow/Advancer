// Generated from the Supabase "Advancer" project (lzjxkfonvdsxkfzfmvph).
// Regenerate after schema changes via the Supabase MCP generate_typescript_types.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          rfq_no?: string | null
          status?: Database["public"]["Enums"]["rfq_workflow_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_event: { Args: { ev: string }; Returns: boolean }
      can_write_event: { Args: { ev: string }; Returns: boolean }
      claim_kyron_owner: { Args: Record<PropertyKey, never>; Returns: string }
      is_org_admin: { Args: { org: string }; Returns: boolean }
      is_org_member: { Args: { org: string }; Returns: boolean }
      is_org_writer: { Args: { org: string }; Returns: boolean }
      shares_org: { Args: { other: string }; Returns: boolean }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      booking_status: "not_booked" | "tentative" | "booked" | "cancelled"
      event_status: "planning" | "active" | "delivered" | "archived"
      import_status: "uploaded" | "parsed" | "previewed" | "committed" | "failed"
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
      rfq_status: "not_sent" | "sent" | "responded" | "declined"
      rfq_recipient_status: "pending" | "sent" | "responded" | "declined"
      site_note_severity: "info" | "issue" | "urgent"
      rfq_workflow_status:
        | "draft"
        | "sent"
        | "responded"
        | "awarded"
        | "declined"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> =
  DefaultSchema["Enums"][T]
