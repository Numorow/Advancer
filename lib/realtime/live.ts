/**
 * Live-update plumbing (M19). Database triggers broadcast a poke on the
 * private Realtime topic `event:<eventId>` for every write to an event-scoped
 * table; clients subscribe and debounce a router refresh. Pure helpers live
 * here so they're unit-testable.
 */

export type ChangePayload = {
  table?: string;
  op?: string;
  /** auth.uid() of the actor; null when the write didn't come through a user session. */
  by?: string | null;
};

/** Quiet window after the last poke before refreshing (batches bursts/imports). */
export const REFRESH_DEBOUNCE_MS = 400;

export function eventTopic(eventId: string): string {
  return `event:${eventId}`;
}

/**
 * Own writes are already reflected optimistically + via revalidatePath, so the
 * originating client skips the extra refresh. An unknown actor (null) must
 * refresh — imports, SQL fixes and other users all look like that.
 */
export function isOwnChange(payload: ChangePayload, selfId: string): boolean {
  return payload.by != null && payload.by === selfId;
}
