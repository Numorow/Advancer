"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createEvent } from "./actions";

export function CreateEventForm({ size = "default" }: { size?: "default" | "lg" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setError(null);
    startTransition(async () => {
      try {
        const { eventId } = await createEvent({ name: n });
        router.push(`/events/${eventId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create event");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-1">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New event name"
          className={`${size === "lg" ? "h-11 w-72 text-base" : "h-9 w-60 text-sm"} rounded-md border bg-[var(--card)] px-3 outline-none focus:ring-2 focus:ring-[var(--ring)]`}
        />
        <Button type="submit" size={size === "lg" ? "lg" : "default"} disabled={pending}>
          {pending ? "Creating…" : "Create new event"}
        </Button>
      </div>
      {error && <p className="text-sm text-[var(--destructive)]">{error}</p>}
    </form>
  );
}
