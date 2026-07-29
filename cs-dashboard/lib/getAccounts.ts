import { Account, AccountsResponse, ParseDiagnostics } from "./types";
import { buildAccounts, loadSampleAccounts } from "./sampleData";
import { fetchSheetRows } from "./sheets";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  accounts: Account[];
  diagnostics: ParseDiagnostics;
  fetchedAt: number;
}

// Module-scope cache: lives for the life of the server process (persists across
// requests on a warm Vercel serverless instance, reset on cold start).
let cache: CacheEntry | null = null;

function shouldUseSampleData(): boolean {
  return process.env.USE_SAMPLE_DATA === "true" || !process.env.SHEET_ID;
}

export async function getAccounts(opts: { fresh?: boolean } = {}): Promise<AccountsResponse> {
  const now = Date.now();

  if (shouldUseSampleData()) {
    const { accounts, diagnostics } = loadSampleAccounts();
    return {
      accounts,
      diagnostics,
      source: "sample",
      fetchedAt: new Date(now).toISOString(),
    };
  }

  const sheetId = process.env.SHEET_ID;
  const sheetTab = process.env.SHEET_TAB || "Data";

  if (!opts.fresh && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return {
      accounts: cache.accounts,
      diagnostics: cache.diagnostics,
      source: "sheet",
      fetchedAt: new Date(cache.fetchedAt).toISOString(),
      sheetId,
      sheetTab,
    };
  }

  try {
    const { header, rows } = await fetchSheetRows();
    const { accounts, diagnostics } = buildAccounts(header, rows);
    cache = { accounts, diagnostics, fetchedAt: now };
    return {
      accounts,
      diagnostics,
      source: "sheet",
      fetchedAt: new Date(now).toISOString(),
      sheetId,
      sheetTab,
    };
  } catch (err) {
    const staleReason = err instanceof Error ? err.message : "Unknown error fetching sheet";
    if (cache) {
      return {
        accounts: cache.accounts,
        diagnostics: cache.diagnostics,
        source: "stale-cache",
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        stale: true,
        staleReason,
        sheetId,
        sheetTab,
      };
    }
    throw new Error(staleReason);
  }
}
