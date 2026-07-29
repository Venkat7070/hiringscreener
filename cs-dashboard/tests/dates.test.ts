import { describe, expect, it } from "vitest";
import { parseDate, parseNumber } from "@/lib/parse";

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2026-07-20")).toBe("2026-07-20");
    expect(parseDate("2026-01-05T10:00:00Z")).toBe("2026-01-05");
  });

  it("parses dd/mm/yyyy dates", () => {
    expect(parseDate("20/07/2026")).toBe("2026-07-20");
    expect(parseDate("5/1/2026")).toBe("2026-01-05");
  });

  it("parses dd-mm-yyyy dates", () => {
    expect(parseDate("20-07-2026")).toBe("2026-07-20");
  });

  it("returns null for empty/unparseable values", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate(null)).toBeNull();
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("32/13/2026")).toBeNull();
  });

  it("rejects invalid calendar dates", () => {
    expect(parseDate("2026-02-30")).toBeNull();
    expect(parseDate("31/04/2026")).toBeNull();
  });
});

describe("parseNumber", () => {
  it("strips currency symbols, commas and spaces", () => {
    expect(parseNumber("$120,000")).toBe(120000);
    expect(parseNumber(" 1 234 ")).toBe(1234);
  });

  it("strips percent signs", () => {
    expect(parseNumber("76%")).toBe(76);
  });

  it("handles accounting-style negatives", () => {
    expect(parseNumber("(1,200)")).toBe(-1200);
  });

  it("defaults to 0 for empty/garbage input", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
    expect(parseNumber("n/a")).toBe(0);
  });
});
