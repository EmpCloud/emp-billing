"use strict";
// ============================================================================
// CSV UTILITY
// Lightweight CSV parse/serialize — no external deps.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSV = parseCSV;
exports.toCSV = toCSV;
/** Parse a CSV string into an array of objects using the header row as keys */
function parseCSV(csvString) {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2)
        return [];
    const headers = parseLine(lines[0]);
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h.trim()] = (values[idx] ?? "").trim(); });
        rows.push(row);
    }
    return rows;
}
/** Serialize an array of objects to a CSV string */
function toCSV(data, columns) {
    const headerRow = columns.map(c => escapeField(c.header)).join(",");
    const dataRows = data.map(row => columns.map(c => escapeField(String(row[c.key] ?? ""))).join(","));
    return [headerRow, ...dataRows].join("\n");
}
function parseLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            }
            else if (ch === '"') {
                inQuotes = false;
            }
            else {
                current += ch;
            }
        }
        else {
            if (ch === '"') {
                inQuotes = true;
            }
            else if (ch === ",") {
                result.push(current);
                current = "";
            }
            else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}
function escapeField(value) {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
//# sourceMappingURL=csv.js.map