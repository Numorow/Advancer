import { describe, it, expect } from "vitest";
import {
  avatarHue,
  displayName,
  initialsFor,
  orderMembers,
  splitOverflow,
  type PresenceMember,
} from "../avatars";

const member = (userId: string, name: string | null, email = `${userId}@x.test`): PresenceMember => ({
  userId,
  name,
  email,
  role: "admin",
  avatarUrl: null,
});

describe("initialsFor", () => {
  it("takes first + last name initials", () => {
    expect(initialsFor("Kyle Bailey", null)).toBe("KB");
    expect(initialsFor("Mary Jane Watson-Parker", null)).toBe("MW");
  });
  it("single names use the first two letters", () => {
    expect(initialsFor("Kyron", null)).toBe("KY");
  });
  it("falls back to the email local part, then ?", () => {
    expect(initialsFor(null, "kyle.bailey@kyronevents.com")).toBe("KY");
    expect(initialsFor("", "ops@kyron.com")).toBe("OP");
    expect(initialsFor(null, null)).toBe("?");
  });
});

describe("avatarHue", () => {
  it("is deterministic and within 0–359", () => {
    const id = "125937db-aaee-4550-84bd-53f78a2c5fd1";
    expect(avatarHue(id)).toBe(avatarHue(id));
    expect(avatarHue(id)).toBeGreaterThanOrEqual(0);
    expect(avatarHue(id)).toBeLessThan(360);
    expect(avatarHue("a")).not.toBe(avatarHue("b"));
  });
});

describe("orderMembers", () => {
  it("puts self first, then online A→Z, then offline A→Z", () => {
    const members = [
      member("u1", "Zara"),
      member("u2", "Adam"),
      member("u3", "Kyle"),
      member("u4", "Bec"),
    ];
    const ordered = orderMembers(members, new Set(["u1", "u4"]), "u3");
    expect(ordered.map((m) => m.name)).toEqual(["Kyle", "Bec", "Zara", "Adam"]);
  });
  it("displayName falls back name → email → id", () => {
    expect(displayName({ name: null, email: "a@b.c", userId: "u" })).toBe("a@b.c");
    expect(displayName({ name: null, email: null, userId: "12345678abc" })).toBe("12345678");
  });
});

describe("splitOverflow", () => {
  it("collapses anything beyond max into a hidden count", () => {
    expect(splitOverflow([1, 2, 3], 5)).toEqual({ visible: [1, 2, 3], hidden: 0 });
    expect(splitOverflow([1, 2, 3, 4, 5, 6, 7], 5)).toEqual({ visible: [1, 2, 3, 4, 5], hidden: 2 });
  });
});
