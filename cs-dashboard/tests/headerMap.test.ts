import { describe, expect, it } from "vitest";
import { mapHeaders, normalizeHeader } from "@/lib/headerMap";
import { mapRows } from "@/lib/mapRow";

describe("normalizeHeader", () => {
  it("lowercases and strips punctuation/spaces", () => {
    expect(normalizeHeader("ARR ($)")).toBe("arr");
    expect(normalizeHeader("CSM Owner")).toBe("csmowner");
    expect(normalizeHeader("Containment %")).toBe("containment");
    expect(normalizeHeader("  Account   Name ")).toBe("accountname");
  });
});

describe("mapHeaders", () => {
  it("maps known aliases regardless of case/punctuation", () => {
    const headers = ["Account ID", "Account Name", "ARR ($)", "CSM Owner", "Containment %"];
    const map = mapHeaders(headers);
    expect(map.accountId).toBe(0);
    expect(map.accountName).toBe(1);
    expect(map.arr).toBe(2);
    expect(map.aoOwner).toBe(3);
    expect(map.containmentPct).toBe(4);
  });

  it("ignores unknown headers", () => {
    const map = mapHeaders(["Some Random Column"]);
    expect(Object.keys(map)).toHaveLength(0);
  });
});

describe("mapRows", () => {
  const headers = ["Account ID", "Account Name", "ARR ($)", "Tier", "Renewal Status"];

  it("falls back accountId to accountName when accountId column is blank", () => {
    const { rows } = mapRows(headers, [["", "Acme Corp", "$120,000", "Growth", "Committed"]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.accountId).toBe("Acme Corp");
    expect(rows[0]?.arr).toBe(120000);
  });

  it("skips rows missing both accountId and accountName, counting them", () => {
    const { rows, skippedCount, skippedReasons } = mapRows(headers, [
      ["", "", "$1,000", "Growth", "Committed"],
      ["ACC-1", "Acme", "$1,000", "Growth", "Committed"],
    ]);
    expect(rows).toHaveLength(1);
    expect(skippedCount).toBe(1);
    expect(skippedReasons[0]).toMatch(/Row 2/);
  });

  it("skips fully blank rows without counting them as diagnostics", () => {
    const { rows, skippedCount } = mapRows(headers, [
      ["", "", "", "", ""],
      ["ACC-1", "Acme", "$1,000", "Growth", "Committed"],
    ]);
    expect(rows).toHaveLength(1);
    expect(skippedCount).toBe(0);
  });

  it("defaults unparseable enum values to a sensible fallback", () => {
    const { rows } = mapRows(headers, [["ACC-1", "Acme", "$1,000", "Bogus Tier", "Bogus Status"]]);
    expect(rows[0]?.tier).toBe("Growth");
    expect(rows[0]?.renewalStatus).toBe("Likely");
  });

  it("flags payment status matching /late/i", () => {
    const withPayment = ["Account ID", "Account Name", "Payment Status"];
    const { rows } = mapRows(withPayment, [["ACC-1", "Acme", "Late - 45 days"]]);
    expect(rows[0]?.paymentLate).toBe(true);
  });
});
