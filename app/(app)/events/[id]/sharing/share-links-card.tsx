"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, Link2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createShareLink, revokeShareLink } from "./actions";

export interface ShareLinkRow {
  id: string;
  kind: "client" | "supplier";
  supplierName: string | null;
  token: string;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

export function ShareLinksCard({
  eventId,
  links,
  suppliers,
}: {
  eventId: string;
  links: ShareLinkRow[];
  suppliers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState<"client" | "supplier" | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    const kind = creating!;
    startTransition(async () => {
      try {
        await createShareLink({
          eventId,
          kind,
          supplierId: kind === "supplier" ? supplierId || null : null,
          label: label.trim() || null,
          expiresAt: null,
        });
        setCreating(null);
        setSupplierId("");
        setLabel("");
        router.refresh();
      } catch {
        /* surfaced on next load */
      }
    });
  }

  function revoke(linkId: string) {
    startTransition(async () => {
      try {
        await revokeShareLink({ linkId, eventId });
        router.refresh();
      } catch {
        /* surfaced on next load */
      }
    });
  }

  async function copy(link: ShareLinkRow) {
    const url = `${window.location.origin}/portal/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(link.id);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Portal links
        </CardTitle>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setCreating("client")} disabled={pending}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Client link
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCreating("supplier")}
            disabled={pending || suppliers.length === 0}
            title={suppliers.length === 0 ? "Add a supplier first" : undefined}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Supplier link
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {creating && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-[var(--muted)]/40 p-2">
            <span className="text-xs font-medium capitalize">{creating} portal</span>
            {creating === "supplier" && (
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="h-8 rounded-md border bg-[var(--card)] px-2 text-sm"
              >
                <option value="">Choose supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. Venue team)"
              className="h-8 flex-1 rounded-md border bg-[var(--card)] px-2 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <Button size="sm" onClick={create} disabled={pending || (creating === "supplier" && !supplierId)}>
              Create
            </Button>
            <button
              type="button"
              onClick={() => setCreating(null)}
              className="rounded p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {links.length === 0 && !creating && (
          <p className="text-xs text-[var(--muted-foreground)]">
            Share a read-only portal with the client/venue, or a scoped view with a supplier. Links
            can be revoked at any time.
          </p>
        )}

        {links.map((l) => {
          const dead = Boolean(l.revokedAt) || (l.expiresAt ? l.expiresAt <= new Date().toISOString() : false);
          return (
            <div key={l.id} className={`flex items-center gap-2 rounded-md border p-2 ${dead ? "opacity-60" : ""}`}>
              <Badge tone={l.kind === "client" ? "info" : "muted"}>{l.kind}</Badge>
              <span className="min-w-0 flex-1 truncate">
                {l.label || l.supplierName || "Read-only portal"}
                {l.supplierName && l.label ? (
                  <span className="text-[var(--muted-foreground)]"> · {l.supplierName}</span>
                ) : null}
              </span>
              {dead ? (
                <Badge tone="danger">revoked</Badge>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => copy(l)}
                    title="Copy portal URL"
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    {copied === l.id ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={`/portal/${l.token}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open portal"
                    className="rounded p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => revoke(l.id)}
                    disabled={pending}
                    className="rounded px-1.5 py-1 text-xs text-[var(--destructive)] hover:bg-[var(--destructive)]/10"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
