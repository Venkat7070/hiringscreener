import { google } from "googleapis";

export interface SheetTable {
  header: string[];
  rows: string[][];
}

/**
 * Reads the configured tab of the private Google Sheet using a service-account
 * JWT. The sheet must be shared with GOOGLE_SERVICE_ACCOUNT_EMAIL as Viewer.
 */
export async function fetchSheetRows(): Promise<SheetTable> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.SHEET_ID;
  const tab = process.env.SHEET_TAB || "Data";

  if (!email || !rawKey || !sheetId) {
    throw new Error(
      "Missing Google Sheets credentials: set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, and SHEET_ID."
    );
  }

  const privateKey = rawKey.replace(/\\n/g, "\n");

  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tab,
  });

  const values = res.data.values ?? [];
  const [header, ...rows] = values;
  return {
    header: (header ?? []).map((c) => String(c ?? "")),
    rows: rows.map((row) => row.map((c) => String(c ?? ""))),
  };
}
