// Simple client-side CSV export (no external library).

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  // Quote if the cell contains a comma, quote or newline; escape inner quotes.
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// downloadCSV('members.csv', ['Name','Phone'], [['Ram','99...'], ...])
export function downloadCSV(filename, headers, rows) {
  const lines = [];
  if (headers && headers.length) lines.push(headers.map(escapeCell).join(','));
  rows.forEach((r) => lines.push(r.map(escapeCell).join(',')));
  // Prepend BOM so Excel opens UTF-8 (Hindi) correctly.
  const csv = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

// Generic blob download (used for JSON backup too)
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
