// Reusable helper: opens a new window with given HTML content and triggers print
// (user can "Save as PDF" from the browser's print dialog)
export function printHTML(title, bodyHtml) {
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #1f2937; }
          h2 { margin-bottom: 4px; }
          h3 { margin-top: 0; color: #1e3a5f; }
          p.muted { color: #6b7280; font-size: 13px; margin-top: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 18px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 13px; }
          th { background: #f3f4f6; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; color: #fff; }
          .section-title { margin-top: 22px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <h2>Galaxy Educational and Social Welfare Trust</h2>
        ${bodyHtml}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
