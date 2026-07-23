// Minimal CSV parser: handles quoted fields, embedded commas/newlines, and
// doubled-quote escaping. Returns { header: string[], rows: object[] }.
export function parseCSV(text) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;

  // Normalize newlines so \r\n and \r behave like \n.
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field); field = "";
    } else if (ch === "\n") {
      record.push(field); field = "";
      records.push(record); record = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/record (file may not end with newline).
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  if (records.length === 0) return { header: [], rows: [] };

  const header = records[0].map((h) => h.trim());
  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    // Skip fully blank trailing lines.
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const obj = {};
    header.forEach((key, c) => { obj[key] = cells[c] !== undefined ? cells[c] : ""; });
    rows.push(obj);
  }
  return { header, rows };
}
