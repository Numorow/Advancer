import type { SupabaseClient } from "@supabase/supabase-js";
import { ADVANCER_MARK } from "./brand-mark";

export { ADVANCER_MARK };

export interface PdfBranding {
  /** Advancer mark as a data URI (always present). */
  mark: string;
  /** Event cover image as a data URI, or null (no image / unsupported format / fetch failed). */
  eventImage: string | null;
}

// react-pdf's image decoder reliably handles only JPEG + PNG — skip webp/avif/gif
// (the PDF still renders, just without the event thumbnail) rather than risk a throw.
const PDF_SAFE: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/**
 * Download an event cover image from the private event-images bucket and return
 * it as a base64 data URI a server-side react-pdf <Image src> can embed. Returns
 * null (graceful) when there's no image, the format isn't PDF-safe, or the
 * download fails — the PDF then renders with the mark only.
 */
export async function loadEventImage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  imagePath: string | null | undefined,
): Promise<string | null> {
  if (!imagePath) return null;
  const mime = PDF_SAFE[imagePath.split(".").pop()?.toLowerCase() ?? ""];
  if (!mime) return null;
  try {
    const { data, error } = await supabase.storage.from("event-images").download(imagePath);
    if (error || !data) return null;
    const base64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}
