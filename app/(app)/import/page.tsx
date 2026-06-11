import { redirect } from "next/navigation";

/** The importer moved into Settings (M22); keep old links/bookmarks working. */
export default function ImportRedirect() {
  redirect("/settings/import");
}
