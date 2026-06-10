import { createClient } from "@/lib/supabase/server";
import { DocumentsView, type DocRow } from "./documents-view";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: docs }, { data: suppliers }, { data: rfqs }] = await Promise.all([
    supabase
      .from("event_documents")
      .select(
        "id, title, category, file_path, external_url, supplier_id, rfq_id, created_at, suppliers(name), rfqs(rfq_no, title)",
      )
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name").is("deleted_at", null).order("name"),
    supabase
      .from("rfqs")
      .select("id, rfq_no, title")
      .eq("event_id", id)
      .is("deleted_at", null)
      .order("rfq_no", { ascending: true, nullsFirst: false }),
  ]);

  // Signed URLs for file-backed docs (private bucket — same as supplier docs / site photos).
  const signed = new Map<string, string>();
  const paths = (docs ?? []).map((d) => d.file_path).filter((p): p is string => Boolean(p));
  if (paths.length) {
    const { data: urls } = await supabase.storage.from("event-docs").createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }

  const rows: DocRow[] = (docs ?? []).map((d) => {
    const r = d.rfqs as unknown as { rfq_no: string | null; title: string } | null;
    return {
      id: d.id,
      title: d.title,
      category: d.category,
      kind: d.file_path ? "file" : "link",
      url: d.file_path ? signed.get(d.file_path) ?? null : d.external_url,
      supplierId: d.supplier_id,
      rfqId: d.rfq_id,
      supplierName: (d.suppliers as unknown as { name: string } | null)?.name ?? null,
      rfqLabel: r ? r.rfq_no ?? r.title : null,
      createdAt: d.created_at,
    };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Upload files or link to externally-hosted documents, and tie each to a supplier or RFQ.
        </p>
      </div>
      <DocumentsView
        eventId={id}
        documents={rows}
        suppliers={suppliers ?? []}
        rfqs={(rfqs ?? []).map((r) => ({ id: r.id, label: r.rfq_no ?? r.title }))}
      />
    </div>
  );
}
