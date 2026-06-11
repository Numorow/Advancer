import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { THEME_BOOT, THEME_BOOT_HASH } from "../theme-boot";

describe("theme-boot CSP hash", () => {
  // If THEME_BOOT changes, its hash must change too or a strict CSP will block
  // the script (dark-mode flash). This recomputes it the way a browser does.
  it("THEME_BOOT_HASH matches the sha256 of THEME_BOOT", () => {
    const hash = "sha256-" + createHash("sha256").update(THEME_BOOT, "utf8").digest("base64");
    expect(THEME_BOOT_HASH).toBe(hash);
  });
});
