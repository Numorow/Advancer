import { describe, expect, it } from "vitest";
import { eventTopic, isOwnChange } from "../live";

describe("eventTopic", () => {
  it("namespaces the event id", () => {
    expect(eventTopic("733fe269-7c10-4829-923e-3c4c7718c7b8")).toBe(
      "event:733fe269-7c10-4829-923e-3c4c7718c7b8",
    );
  });
});

describe("isOwnChange", () => {
  const self = "11111111-1111-1111-1111-111111111111";

  it("matches the actor id", () => {
    expect(isOwnChange({ table: "checklist_items", op: "UPDATE", by: self }, self)).toBe(true);
  });

  it("treats other actors as foreign", () => {
    expect(isOwnChange({ by: "22222222-2222-2222-2222-222222222222" }, self)).toBe(false);
  });

  it("treats a null/missing actor as foreign (imports, SQL fixes)", () => {
    expect(isOwnChange({ by: null }, self)).toBe(false);
    expect(isOwnChange({}, self)).toBe(false);
  });
});
