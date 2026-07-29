import { describe, expect, it } from "vitest";
import { computeAccount, computeConsumptionPct, computeHealthScore } from "@/lib/health";
import { AccountRaw } from "@/lib/types";

function baseRaw(overrides: Partial<AccountRaw> = {}): AccountRaw {
  return {
    accountId: "ACC-1",
    accountName: "Acme Corp",
    region: "NA",
    industry: "Retail",
    tier: "Enterprise",
    aoOwner: "Jane Doe",
    fdePod: "Pod Alpha",
    arr: 200000,
    contractStart: "2025-01-01",
    renewalDate: "2026-12-01",
    lastEbrDate: "2026-05-01",
    actionDueDate: "2026-08-01",
    renewalStatus: "Committed",
    paymentStatus: "Current",
    paymentLate: false,
    committedConversations: 100000,
    consumedConversations: 90000,
    containmentPct: 85,
    botCsat: 90,
    liveUseCases: 4,
    contractedUseCases: 4,
    channelsLive: 3,
    primaryUseCase: "WhatsApp Support Bot",
    championStatus: "Active",
    execSponsorEngaged: true,
    keyStakeholders: "Jane, VP Ops",
    healthReason: "",
    internalBlockers: "",
    externalBlockers: "",
    nextAction: "",
    actionOwner: "",
    blockerType: "None",
    manualHealth: null,
    expansionStage: "None",
    expansionValue: 0,
    rowIndex: 2,
    ...overrides,
  };
}

describe("computeConsumptionPct", () => {
  it("computes consumed/committed as a percentage", () => {
    expect(computeConsumptionPct({ committedConversations: 100, consumedConversations: 50 })).toBe(50);
  });

  it("treats zero commitment with zero consumption as 0%, not a divide-by-zero crash", () => {
    expect(computeConsumptionPct({ committedConversations: 0, consumedConversations: 0 })).toBe(0);
  });

  it("treats zero commitment with nonzero consumption as 100%", () => {
    expect(computeConsumptionPct({ committedConversations: 0, consumedConversations: 10 })).toBe(100);
  });
});

describe("computeHealthScore", () => {
  it("scores a healthy account as Green", () => {
    const raw = baseRaw();
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Green");
  });

  it("hard-overrides to Red when consumption < 40%, even with good other metrics", () => {
    const raw = baseRaw({ consumedConversations: 30000 }); // 30% of 100000
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Red");
  });

  it("hard-overrides to Red when containment < 40%", () => {
    const raw = baseRaw({ containmentPct: 25 });
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Red");
  });

  it("hard-overrides to Red when champion has departed, regardless of score", () => {
    const raw = baseRaw({ championStatus: "Departed" });
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Red");
  });

  it("scores a mediocre account as Amber", () => {
    const raw = baseRaw({
      consumedConversations: 55000, // 55%
      containmentPct: 60,
      botCsat: 65,
      renewalStatus: "In Negotiation",
    });
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Amber");
  });

  it("scores a poor (but not hard-overridden) account as Red", () => {
    const raw = baseRaw({
      consumedConversations: 45000, // 45%, above the 40% hard-override floor
      containmentPct: 45,
      botCsat: 40,
      paymentLate: true,
      renewalStatus: "At Risk",
      championStatus: "At Risk",
      execSponsorEngaged: false,
    });
    const { health } = computeHealthScore(raw, computeConsumptionPct(raw));
    expect(health).toBe("Red");
  });
});

describe("computeAccount", () => {
  const now = new Date("2026-07-20T00:00:00Z");

  it("computes daysToRenewal and renewal windows", () => {
    const raw = baseRaw({ renewalDate: "2026-09-01" }); // 43 days out
    const account = computeAccount(raw, now);
    expect(account.daysToRenewal).toBe(43);
    expect(account.isRenewal90).toBe(true);
    expect(account.isRenewal180).toBe(true);
  });

  it("marks renewals beyond 180 days as neither window", () => {
    const raw = baseRaw({ renewalDate: "2027-06-01" });
    const account = computeAccount(raw, now);
    expect(account.isRenewal90).toBe(false);
    expect(account.isRenewal180).toBe(false);
  });

  it("handles a null renewal date", () => {
    const raw = baseRaw({ renewalDate: null });
    const account = computeAccount(raw, now);
    expect(account.daysToRenewal).toBeNull();
    expect(account.isRenewal90).toBe(false);
  });

  it("flags healthOverridden when manual health differs from computed", () => {
    const raw = baseRaw({ manualHealth: "Red" }); // computed should be Green
    const account = computeAccount(raw, now);
    expect(account.computedHealth).toBe("Green");
    expect(account.healthOverridden).toBe(true);
  });

  it("does not flag healthOverridden when manual health matches computed", () => {
    const raw = baseRaw({ manualHealth: "Green" });
    const account = computeAccount(raw, now);
    expect(account.healthOverridden).toBe(false);
  });

  it("does not flag healthOverridden when manual health is absent", () => {
    const raw = baseRaw({ manualHealth: null });
    const account = computeAccount(raw, now);
    expect(account.healthOverridden).toBe(false);
  });
});
