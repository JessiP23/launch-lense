/** Spreadsheet ID from raw ID or Google Sheets URL */
export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{25,}$/.test(trimmed) && !trimmed.includes('/')) return trimmed;
  const m = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

export async function fetchSheetRowsAsRecords(accessToken: string, spreadsheetId: string): Promise<{
  sheetTitle: string;
  rows: Record<string, string>[];
}> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(title))`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Sheets metadata ${metaRes.status}`);
  }
  const meta = (await metaRes.json()) as { sheets?: { properties?: { title?: string } }[] };
  const sheetTitle = meta.sheets?.[0]?.properties?.title ?? 'Sheet1';

  const range = encodeURIComponent(`${sheetTitle}!A1:Z50000`);
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!valuesRes.ok) {
    const err = await valuesRes.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `Sheets values ${valuesRes.status}`);
  }
  const vs = (await valuesRes.json()) as { values?: string[][] };
  const values = vs.values ?? [];
  if (values.length === 0) return { sheetTitle, rows: [] };

  const headers = values[0].map((h) => String(h ?? '').trim());
  const rows = values.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = String(cells[i] ?? '').trim();
    });
    return row;
  });
  return { sheetTitle, rows };
}
