import { describe, expect, it } from "vitest";
import { displayableImageError, IMAGE_ACCEPT } from "../images";

describe("displayableImageError", () => {
  it("accepts the formats browsers render", () => {
    expect(displayableImageError({ type: "image/jpeg", name: "me.jpg" })).toBeNull();
    expect(displayableImageError({ type: "image/png", name: "me.png" })).toBeNull();
    expect(displayableImageError({ type: "image/webp", name: "me.webp" })).toBeNull();
  });

  it("rejects HEIC by MIME type with the specific message", () => {
    expect(displayableImageError({ type: "image/heic", name: "IMG_0001.heic" })).toMatch(/HEIC/);
    expect(displayableImageError({ type: "image/heif", name: "IMG_0001.heif" })).toMatch(/HEIC/);
  });

  it("rejects HEIC by extension when the platform reports no/odd MIME", () => {
    expect(displayableImageError({ type: "", name: "IMG_0001.HEIC" })).toMatch(/HEIC/);
    expect(displayableImageError({ type: "application/octet-stream", name: "x.heif" })).toMatch(/HEIC/);
  });

  it("rejects other non-displayable types generically", () => {
    expect(displayableImageError({ type: "image/tiff", name: "scan.tif" })).toMatch(/JPG, PNG/);
    expect(displayableImageError({ type: "application/pdf", name: "doc.pdf" })).toMatch(/JPG, PNG/);
  });

  it("accept attribute excludes HEIC so iOS auto-converts on pick", () => {
    expect(IMAGE_ACCEPT).not.toMatch(/hei[cf]/);
    expect(IMAGE_ACCEPT).toContain("image/jpeg");
  });
});
