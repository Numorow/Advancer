/**
 * Build an email-ready RFQ — a plain-text subject + body addressed to a supplier,
 * ready to drop into a mail client (mailto:) or copy to the clipboard. Pure and
 * testable: no DB, no formatting libraries. The same shape feeds the RFQ PDF.
 */
export interface RfqDocItem {
  description: string;
  quantity: string | null;
  unit: string | null;
}

export interface RfqDocHeader {
  rfqNo: string | null;
  title: string;
  deliveryDate: string | null;
  collectionDate: string | null;
  responseDueDate: string | null;
  location: string | null;
  notes: string | null;
}

export interface RfqEmailInput {
  rfq: RfqDocHeader;
  items: RfqDocItem[];
  /** The supplier this copy is addressed to (optional — falls back to a generic greeting). */
  recipient?: { supplierName: string; contactName?: string | null } | null;
  orgName: string;
  eventName: string;
  /** Who's sending — defaults to the org name. */
  senderName?: string | null;
}

/** Format one item line: "3 × pallets — Staging decks" (parts omitted when absent). */
export function formatItemLine(item: RfqDocItem): string {
  const qty = item.quantity?.trim();
  const unit = item.unit?.trim();
  const measure = [qty, unit].filter(Boolean).join(" ");
  return measure ? `${measure} — ${item.description}` : item.description;
}

export function buildRfqEmail(input: RfqEmailInput): { subject: string; body: string } {
  const { rfq, items, recipient, orgName, eventName, senderName } = input;
  const ref = rfq.rfqNo ? `RFQ ${rfq.rfqNo}` : "RFQ";
  const subject = `${ref} — ${rfq.title} (${eventName})`;

  const greetingName = recipient?.contactName?.trim() || recipient?.supplierName?.trim() || "there";

  const lines: string[] = [];
  lines.push(`Hi ${greetingName},`);
  lines.push("");
  lines.push(`We're requesting a quote for the following for ${eventName}:`);
  lines.push("");

  if (items.length > 0) {
    lines.push("Items:");
    for (const it of items) lines.push(`  • ${formatItemLine(it)}`);
  } else {
    lines.push("Items: (see attached / to be confirmed)");
  }
  lines.push("");

  lines.push(`Delivery date: ${rfq.deliveryDate ?? "TBC"}`);
  lines.push(`Collection date: ${rfq.collectionDate ?? "TBC"}`);
  if (rfq.location?.trim()) lines.push(`Location: ${rfq.location.trim()}`);
  if (rfq.notes?.trim()) {
    lines.push("");
    lines.push(`Notes: ${rfq.notes.trim()}`);
  }
  lines.push("");

  const by = rfq.responseDueDate ? `by ${rfq.responseDueDate}` : "at your earliest convenience";
  lines.push(`Please send your quote (ex-GST) ${by}.`);
  lines.push("");
  lines.push("Thanks,");
  lines.push(senderName?.trim() || orgName);
  if (senderName?.trim() && senderName.trim() !== orgName) lines.push(orgName);

  return { subject, body: lines.join("\n") };
}
