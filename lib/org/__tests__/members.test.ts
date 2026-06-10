import { describe, it, expect } from "vitest";
import { wouldOrphanOwners, isAdminRole, isWriterRole } from "../members";

const members = [
  { userId: "u1", role: "owner" },
  { userId: "u2", role: "admin" },
  { userId: "u3", role: "viewer" },
];

describe("wouldOrphanOwners", () => {
  it("blocks demoting the last owner", () => {
    expect(wouldOrphanOwners(members, "u1", "admin")).toBe(true);
    expect(wouldOrphanOwners(members, "u1", null)).toBe(true); // remove
  });
  it("allows demoting an owner when another owner remains", () => {
    const two = [...members, { userId: "u4", role: "owner" }];
    expect(wouldOrphanOwners(two, "u1", "admin")).toBe(false);
  });
  it("never blocks changing a non-owner", () => {
    expect(wouldOrphanOwners(members, "u2", "viewer")).toBe(false);
    expect(wouldOrphanOwners(members, "u3", null)).toBe(false);
  });
  it("allows an owner staying an owner", () => {
    expect(wouldOrphanOwners(members, "u1", "owner")).toBe(false);
  });
});

describe("role predicates", () => {
  it("identifies admin roles", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("event_manager")).toBe(false);
  });
  it("identifies writer roles", () => {
    expect(isWriterRole("event_manager")).toBe(true);
    expect(isWriterRole("viewer")).toBe(false);
    expect(isWriterRole("none")).toBe(false);
  });
});
