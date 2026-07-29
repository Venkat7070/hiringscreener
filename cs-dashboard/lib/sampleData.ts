import fs from "fs";
import path from "path";
import { parseCsv } from "./csv";
import { mapRows } from "./mapRow";
import { computeAccount } from "./health";
import { Account, ParseDiagnostics } from "./types";

const SAMPLE_DATA_PATH = path.join(process.cwd(), "sample-data.csv");

export interface LoadedAccounts {
  accounts: Account[];
  diagnostics: ParseDiagnostics;
}

export function loadSampleAccounts(): LoadedAccounts {
  const text = fs.readFileSync(SAMPLE_DATA_PATH, "utf-8");
  const table = parseCsv(text);
  const [header, ...dataRows] = table;
  return buildAccounts(header ?? [], dataRows);
}

export function buildAccounts(header: string[], dataRows: string[][]): LoadedAccounts {
  const { rows, skippedCount, skippedReasons } = mapRows(header, dataRows);
  const accounts = rows.map((r) => computeAccount(r));
  const diagnostics: ParseDiagnostics = {
    totalRows: dataRows.length,
    parsedRows: rows.length,
    skippedRows: skippedCount,
    skippedReasons,
  };
  return { accounts, diagnostics };
}
