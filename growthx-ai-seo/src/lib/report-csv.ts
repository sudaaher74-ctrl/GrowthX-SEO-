export interface CsvSection {
  title: string;
  headers: string[];
  rows: Array<Array<string | number | null | undefined>>;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvDocument(sections: CsvSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (lines.length > 0) lines.push("");
    lines.push(escapeCsvCell(`=== ${section.title} ===`));
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
