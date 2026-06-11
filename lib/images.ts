/**
 * Browser-displayable image gate. iPhones shoot HEIC by default, which no
 * browser can render in an <img> — uploads must be limited to formats that
 * actually display. Listing explicit types in the file input's `accept` (not
 * `image/*`) also makes iOS transparently convert HEIC→JPEG on pick, so
 * iPhone users never hit the error in practice.
 */

export const DISPLAYABLE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

/** For <input type="file" accept={…}> on photo pickers. */
export const IMAGE_ACCEPT = DISPLAYABLE_IMAGE_TYPES.join(",");

const HEIC_RE = /\.(heic|heif)$/i;

/**
 * Returns a user-facing error when the file can't be shown by browsers,
 * or null when it's fine. Checks the extension as well as the MIME type —
 * some platforms report HEIC files with an empty type.
 */
export function displayableImageError(file: { type: string; name: string }): string | null {
  const isHeic = /^image\/hei[cf]$/i.test(file.type) || HEIC_RE.test(file.name);
  if (isHeic) {
    return "HEIC photos can't be shown by web browsers — please upload a JPG or PNG.";
  }
  if (!(DISPLAYABLE_IMAGE_TYPES as readonly string[]).includes(file.type.toLowerCase())) {
    return "Please choose a JPG, PNG, WebP, GIF or AVIF image.";
  }
  return null;
}
