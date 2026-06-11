"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  eventTopic,
  isOwnChange,
  REFRESH_DEBOUNCE_MS,
  type ChangePayload,
} from "@/lib/realtime/live";

/**
 * Invisible per-event subscriber: joins the private `event:<id>` broadcast
 * topic (fed by DB triggers) and debounces router.refresh() when someone ELSE
 * writes to this event. Own writes are skipped — revalidatePath already
 * refreshed this client. While the tab is hidden the refresh is deferred to
 * the next visibilitychange so background tabs don't churn the server.
 */
export function LiveRefresh({ eventId, selfId }: { eventId: string; selfId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let hiddenDirty = false;

    const refresh = () => {
      if (document.hidden) {
        hiddenDirty = true;
        return;
      }
      router.refresh();
    };

    const channel = supabase
      .channel(eventTopic(eventId), { config: { private: true } })
      .on("broadcast", { event: "change" }, ({ payload }) => {
        if (isOwnChange((payload ?? {}) as ChangePayload, selfId)) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
      });

    // Private channels need the user JWT on the realtime socket; setAuth()
    // pulls the current session before the join is attempted.
    void supabase.realtime.setAuth().then(() => channel.subscribe());

    const onVisibility = () => {
      if (!document.hidden && hiddenDirty) {
        hiddenDirty = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [eventId, selfId, router]);

  return null;
}
