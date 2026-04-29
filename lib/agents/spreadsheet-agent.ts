/**
 * SpreadsheetAgent — validates and prepares contacts from sheet-like rows.
 * No network I/O here; callers pass parsed rows from Sheets API or CSV.
 */

import type {
  GenomeAgentOutput,
  SpreadsheetAgentOutput,
  SpreadsheetContactRow,
} from '@/lib/agents/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '_');
}

function scoreHeader(norm: string): { email?: boolean; first?: boolean; company?: boolean; role?: boolean } {
  return {
    email: /email|e-mail|mail/.test(norm),
    first: /^(first|given|fname|first_name)$/.test(norm) || /^first/.test(norm),
    company: /company|organization|org|account/.test(norm),
    role: /role|title|job|position/.test(norm),
  };
}

export function detectColumns(headers: string[]): {
  email?: string;
  first?: string;
  company?: string;
  role?: string;
} {
  const normMap = new Map(headers.map((h) => [normalizeHeader(h), h]));
  let email: string | undefined;
  let first: string | undefined;
  let company: string | undefined;
  let role: string | undefined;

  for (const h of headers) {
    const n = normalizeHeader(h);
    const s = scoreHeader(n);
    if (s.email && !email) email = h;
    if (s.first && !first) first = h;
    if (s.company && !company) company = h;
    if (s.role && !role) role = h;
  }

  // Fallback: any column containing "email"
  if (!email) {
    for (const h of headers) {
      if (/email/i.test(h)) {
        email = h;
        break;
      }
    }
  }

  void normMap;
  return { email, first, company, role };
}

function rowValue(row: Record<string, string>, key?: string): string {
  if (!key) return '';
  const v = row[key];
  return typeof v === 'string' ? v.trim() : '';
}

export interface PrepareSheetInput {
  sheetName?: string;
  /** Each object keyed by header label from first row */
  rows: Record<string, string>[];
  icpFilter?: boolean;
  genome?: GenomeAgentOutput | null;
}

function icpKeywordsFromGenome(genome?: GenomeAgentOutput | null): string[] {
  if (!genome?.icp) return [];
  const words = genome.icp.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length >= 4);
  return [...new Set(words)].slice(0, 24);
}

function passesIcpFilter(
  contact: SpreadsheetContactRow,
  keywords: string[],
): boolean {
  if (!keywords.length) return true;
  const hay = `${contact.role ?? ''} ${contact.company ?? ''}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

export function runSpreadsheetAgent(input: PrepareSheetInput): SpreadsheetAgentOutput & { warnings: string[] } {
  const warnings: string[] = [];
  const rawRows = input.rows ?? [];
  const headers =
    rawRows.length > 0
      ? Object.keys(rawRows[0])
      : [];

  const cols = detectColumns(headers);
  if (!cols.email) {
    return {
      source: `Google Sheets · ${input.sheetName ?? 'sheet'}`,
      totalRows: rawRows.length,
      validContacts: 0,
      skippedInvalidEmail: 0,
      skippedNoEmail: rawRows.length,
      icpFilterApplied: false,
      filteredCount: 0,
      contacts: [],
      warnings: ['No email column detected. Add a column whose header contains “email”.'],
    };
  }

  const keywords = input.icpFilter ? icpKeywordsFromGenome(input.genome) : [];
  let skippedInvalidEmail = 0;
  let skippedNoEmail = 0;
  let filteredCount = 0;

  const seen = new Set<string>();
  const contacts: SpreadsheetContactRow[] = [];

  for (const row of rawRows) {
    const emailRaw = rowValue(row, cols.email);
    if (!emailRaw) {
      skippedNoEmail += 1;
      continue;
    }
    const email = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(email)) {
      skippedInvalidEmail += 1;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);

    let firstName = rowValue(row, cols.first) || null;
    if (firstName === '') firstName = null;

    const company = rowValue(row, cols.company) || null;
    const role = rowValue(row, cols.role) || null;

    const contact: SpreadsheetContactRow = {
      email,
      firstName,
      company: company || null,
      role: role || null,
    };

    if (input.icpFilter && keywords.length) {
      if (!passesIcpFilter(contact, keywords)) {
        filteredCount += 1;
        continue;
      }
    }

    contacts.push(contact);
  }

  const totalRows = rawRows.length;
  const validContacts = contacts.length;

  if (validContacts > 0 && validContacts < 5) {
    warnings.push(
      validContacts === 1
        ? 'Only one valid contact row — add more rows or paste a larger CSV export before outreach.'
        : `Only ${validContacts} valid contacts — consider adding more rows before outreach.`,
    );
  }
  if (validContacts > 2000) {
    warnings.push(`List has ${validContacts} contacts — confirm batch send before proceeding.`);
  }

  return {
    source: `Google Sheets · ${input.sheetName ?? 'sheet'}`,
    totalRows,
    validContacts,
    skippedInvalidEmail,
    skippedNoEmail,
    icpFilterApplied: Boolean(input.icpFilter && keywords.length > 0),
    filteredCount,
    contacts,
    warnings,
  };
}
