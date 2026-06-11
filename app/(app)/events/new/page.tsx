import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { NewEventForm } from "./new-event-form";

export default async function NewEventPage() {
  await requireContext();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
        <Link href="/" className="hover:underline">
          Events
        </Link>
        <span>/</span>
        <span className="text-[var(--foreground)]">New event</span>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create new event</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Pick a template for the event type — greenfield builds and venue shows
          start with different checklists and budget areas. Set the bump-in,
          event and bump-out dates to build the master schedule automatically,
          and add any extra entries below.
        </p>
      </div>
      <NewEventForm />
    </div>
  );
}
