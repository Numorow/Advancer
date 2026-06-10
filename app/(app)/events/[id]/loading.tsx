import { PageSkeleton } from "@/components/skeleton";

/** Streams inside the event layout, so the sidebar stays put while the
 *  section content loads. */
export default function Loading() {
  return <PageSkeleton />;
}
