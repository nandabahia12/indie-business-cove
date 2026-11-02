import { describe, it, expect } from "vitest";
import { redact } from "@/lib/logger";
import { fromDbError } from "@/lib/errors";
import { orgFilePath } from "@/lib/storage";

describe("foundation", () => {
  it("redacts sensitive keys", () => {
    expect(redact({ password: "x", token: "y", orgId: "1" })).toEqual({ password: "[redacted]", token: "[redacted]", orgId: "1" });
  });
  it("maps RLS denial to forbidden", () => {
    expect(fromDbError({ code: "42501" }).code).toBe("forbidden");
  });
  it("hides unknown db error details", () => {
    expect(fromDbError({ code: "XX000", message: "secret internals" }).message).not.toContain("secret");
  });
  it("file paths start with the organization id", () => {
    expect(orgFilePath("org-1", "docs", "a b.pdf").startsWith("org-1/docs/")).toBe(true);
  });
});
