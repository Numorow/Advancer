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
          Set the bump-in, event and bump-out dates — these build the master
          schedule automatically. Add any extra entries below. The event also
          starts with the standard checklist, budget and toilet templates.
        </p>
      </div>
      <NewEventForm />
    </div>
  );
}
