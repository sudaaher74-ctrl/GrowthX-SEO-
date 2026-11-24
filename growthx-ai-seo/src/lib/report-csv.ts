export interface CsvSection {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

/**
 * Matches spreadsheet formula/injection prefixes, including leading whitespace
 * or ASCII control characters before `=`, `+`, `-`, `@`, as well as leading
 * tab (`\t`) or carriage return (`\r`).
 */
const FORMULA_PREFIX_RE = /^[\t\r]|^[\s\u0000-\u001f]*[=+\-@]/;

/**
 * Shared spreadsheet-safe CSV cell encoder.
 *
 * - Preserves finite JavaScript numbers (including negative values like `-12.5`)
 *   as unprefixed numeric cells so spreadsheet math/charts remain intact.
 * - Neutralizes externally sourced text cells that could be evaluated as
 *   spreadsheet formulas (`=`, `+`, `-`, `@`, `\t`, `\r`, with or without
 *   leading whitespace/control chars) by prefixing `'`.
 * - Applies standard RFC 4180 quoting for commas, quotes, and newlines.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  const raw = String(value);
  const safe = FORMULA_PREFIX_RE.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function buildCsvRows(
  headers: string[],
  rows: Array<Array<unknown>>,
  lineEnding: "\r\n" | "\n" = "\r\n",
): string {
  return [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ].join(lineEnding);
}

export function buildCsvDocument(sections: CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (lines.length > 0) lines.push("");
    lines.push(escapeCsvCell(`Section: ${section.title}`));
    lines.push(section.headers.map(escapeCsvCell).join(","));
    for (const row of section.rows) {
      lines.push(row.map(escapeCsvCell).join(","));
    }
  }
  return lines.join("\r\n");
}

export function downloadCsvFile(filename: string, sections: CsvSection[]): void {
  if (typeof window === "undefined") return;
  const csv = buildCsvDocument(sections);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
