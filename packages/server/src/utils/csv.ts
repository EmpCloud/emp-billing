// ============================================================================
// CSV UTILITY
// Lightweight CSV parse/serialize — no external deps.
// ============================================================================

/** Parse a CSV string into an array of objects using the header row as keys */
export function parseCSV(csvString: string): Record<string, string>[] {
  const lines = csvString.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? "").trim(); });
    rows.push(row);
  }

  return rows;
}

/** Serialize an array of objects to a CSV string */
export function toCSV(data: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const headerRow = columns.map(c => escapeField(c.header)).join(",");
  const dataRows = data.map(row =>
    columns.map(c => escapeField(String(row[c.key] ?? ""))).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function escapeField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
