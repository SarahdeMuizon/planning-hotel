/**
 * Opens a new window with print-ready HTML and triggers window.print().
 * Colors are preserved via print-color-adjust: exact.
 */
export function openPrintWindow(
  title: string,
  subtitle: string,
  bodyHtml: string,
  landscape = true
) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Veuillez autoriser les popups dans votre navigateur pour exporter en PDF.');
    return;
  }

  const today = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${landscape ? 'landscape' : 'portrait'};
      margin: 1.2cm 1cm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      color: #1e293b;
      margin: 0;
    }

    /* ── Header ── */
    .ph-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 8px;
      margin-bottom: 14px;
    }
    .ph-header h1 { font-size: 15px; font-weight: 700; margin: 0 0 3px; }
    .ph-header .sub { font-size: 10px; color: #64748b; margin: 0; }
    .ph-header .stamp { font-size: 9px; color: #94a3b8; white-space: nowrap; }

    /* ── Table base ── */
    table {
      border-collapse: collapse;
      width: 100%;
      font-size: 9px;
    }
    thead th {
      background-color: #1e293b;
      color: #ffffff;
      padding: 5px 3px;
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
    }
    thead th.th-name { text-align: left; padding-left: 8px; }
    thead th.th-weekend { background-color: #334155; }
    thead th.th-today   { background-color: #1d4ed8; }

    tbody td {
      border: 1px solid #e2e8f0;
      padding: 3px 2px;
      text-align: center;
      vertical-align: middle;
      height: 22px;
    }
    tbody td.td-name {
      text-align: left;
      padding-left: 6px;
      font-weight: 600;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) td { background-color: #f8fafc; }
    tbody tr:nth-child(even) td.td-name { background-color: #f8fafc; }

    /* specific cell types */
    .cell-rest   { background-color: #f1f5f9; color: #94a3b8; }
    .cell-off    { color: #94a3b8; font-size: 8px; }
    .cell-total  { font-weight: 700; background-color: #f8fafc !important; }
    .cell-count  { font-weight: 700; background-color: #f8fafc !important; font-size: 9px; }

    tfoot td {
      border: 1px solid #e2e8f0;
      border-top: 2px solid #94a3b8;
      padding: 3px 2px;
      text-align: center;
      font-weight: 600;
      background-color: #f8fafc;
      font-size: 9px;
    }
    tfoot td.td-name { text-align: left; padding-left: 6px; }

    /* ── Footer ── */
    .ph-footer {
      margin-top: 10px;
      font-size: 8px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }

    /* hide browser print UI artifacts */
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="ph-header">
    <div>
      <h1>${title}</h1>
      <p class="sub">${subtitle}</p>
    </div>
    <span class="stamp">Imprimé le ${today}</span>
  </div>

  ${bodyHtml}

  <div class="ph-footer">
    <span>Planning Hôtel</span>
    <span>${title} — ${subtitle}</span>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 300);
    };
  </script>
</body>
</html>`);

  win.document.close();
}
