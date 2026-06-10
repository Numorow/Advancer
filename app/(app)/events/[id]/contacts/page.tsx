import { createClient } from "@/lib/supabase/server";
import { ContactsView, type BillingProfile, type ContactRow } from "./contacts-view";

export default async function ContactsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contacts }, { data: billing }] = await Promise.all([
    supabase
      .from("event_contacts")
      .select("id, position, name, company, mobile, email, sort")
      .eq("event_id", id)
      .order("sort", { ascending: true }),
    supabase
      .from("event_billing_profiles")
      .select("approver, responsible, billing_entity, abn, address, notes")
      .eq("event_id", id)
      .maybeSingle(),
  ]);

  const rows: ContactRow[] = (contacts ?? []).map((c) => ({
    id: c.id,
    position: c.position,
    name: c.name,
    company: c.company,
    mobile: c.mobile,
    email: c.email,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Contacts &amp; billing</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Key stakeholder contacts for this event, and the billing profile used on client paperwork.
        </p>
      </div>
      <ContactsView eventId={id} contacts={rows} billing={(billing ?? null) as BillingProfile | null} />
    </div>
  );
}
