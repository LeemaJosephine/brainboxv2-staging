/**
 * Parse CSV string with support for quoted fields (handles commas inside quotes).
 * Returns array of rows, each row is array of cell strings.
 */
export function parseCsv(csvText: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      current.push(cell.trim());
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      current.push(cell.trim());
      cell = "";
      if (current.some((c) => c !== "")) rows.push(current);
      current = [];
      continue;
    }

    cell += ch;
  }

  current.push(cell.trim());
  if (current.some((c) => c !== "")) rows.push(current);
  return rows;
}

export interface ParsedMcqRow {
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
}

/**
 * Parse CSV rows (first row = header) into MCQ format.
 * Expected columns: Question, option A, option B, option C, option D, correct answer
 * Correct answer: 0-based index (0,1,2,3) or letter (A,B,C,D).
 */
export function csvRowsToMcq(rows: string[][]): ParsedMcqRow[] {
  if (rows.length < 2) return [];
  const dataRows = rows.slice(1);
  const result: ParsedMcqRow[] = [];

  for (const row of dataRows) {
    if (row.length < 2) continue;
    const questionText = (row[0] ?? "").trim();
    if (!questionText) continue;

    // Options: columns 1 to 4 (option A, B, C, D); allow fewer columns
    const options = [row[1], row[2], row[3], row[4]]
      .filter((c) => c !== undefined && c !== null)
      .map((c) => String(c).trim())
      .filter((c) => c !== "");

    if (options.length === 0) continue;

    // Last column or column 5 = correct answer (0-based index or A/B/C/D)
    const correctRaw = (row[5] ?? row[row.length - 1] ?? "").toString().trim().toUpperCase();
    let correctAnswerIndex = 0;
    if (/^[0-9]+$/.test(correctRaw)) {
      correctAnswerIndex = Math.max(0, Math.min(parseInt(correctRaw, 10), options.length - 1));
    } else if (/^[A-D]$/.test(correctRaw)) {
      correctAnswerIndex = Math.min(correctRaw.charCodeAt(0) - 65, options.length - 1);
    }

    const paddedOptions = [...options];
    while (paddedOptions.length < 4) paddedOptions.push("");
    result.push({
      questionText,
      options: paddedOptions,
      correctAnswerIndex,
    });
  }

  return result;
}

export interface ParsedMemberRow {
  name: string;
  email: string;
  teamName?: string;
}

/**
 * Parse CSV rows (first row = header) into member invite format.
 * Expected columns: name, email, team name (team name optional for team manager).
 */
export function csvRowsToMembers(rows: string[][]): ParsedMemberRow[] {
  if (rows.length < 2) return [];
  const dataRows = rows.slice(1);
  const result: ParsedMemberRow[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const row of dataRows) {
    const name = (row[0] ?? "").trim();
    const email = (row[1] ?? "").trim().toLowerCase();
    const teamName = (row[2] ?? "").trim() || undefined;
    if (!name || !email) continue;
    if (!emailRegex.test(email)) continue;
    result.push({ name, email, teamName: teamName || undefined });
  }

  return result;
}
