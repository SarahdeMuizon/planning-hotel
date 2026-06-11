/**
 * Opens a new window with print-ready HTML and triggers window.print().
 * Colors are preserved via print-color-adjust: exact.
 *
 * @param compact  true = mode portrait A4 compact (timeline mobile — une seule page)
 */
export function openPrintWindow(
  title: string,
  subtitle: string,
  bodyHtml: string,
  landscape = true,
  compact = false,
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    @page {
      size: A4 ${compact ? 'portrait' : landscape ? 'landscape' : 'portrait'};
      margin: ${compact ? '0.6cm 0.5cm' : '1.2cm 1cm'};
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${compact ? '7px' : '10px'};
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
      font-size: ${compact ? '7px' : '9px'};
      table-layout: ${compact ? 'fixed' : 'auto'};
    }
    thead th {
      background-color: #1e293b;
      color: #ffffff;
      padding: ${compact ? '2px 1px' : '5px 3px'};
      font-weight: 600;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
    }
    thead th.th-name { text-align: left; padding-left: ${compact ? '4px' : '8px'}; }
    thead th.th-weekend { background-color: #334155; }
    thead th.th-today   { background-color: #1d4ed8; }

    tbody td {
      border: 1px solid #e2e8f0;
      padding: ${compact ? '0 1px' : '3px 2px'};
      text-align: center;
      vertical-align: middle;
      height: ${compact ? 'auto' : '22px'};
      overflow: hidden;
    }
    tbody td.td-name {
      text-align: left;
      padding-left: ${compact ? '4px' : '6px'};
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    tbody tr:nth-child(even) td { background-color: #f8fafc; }
    tbody tr:nth-child(even) td.td-name { background-color: #f8fafc; }

    /* specific cell types */
    .cell-rest   { background-color: #f1f5f9; color: #94a3b8; }
    .cell-off    { color: #94a3b8; font-size: ${compact ? '6px' : '8px'}; }
    .cell-total  { font-weight: 700; background-color: #f8fafc !important; }
    .cell-count  { font-weight: 700; background-color: #f8fafc !important; font-size: ${compact ? '7px' : '9px'}; }

    tfoot td {
      border: 1px solid #e2e8f0;
      border-top: 2px solid #94a3b8;
      padding: ${compact ? '1px' : '3px 2px'};
      text-align: center;
      font-weight: 600;
      background-color: #f8fafc;
      font-size: ${compact ? '7px' : '9px'};
    }
    tfoot td.td-name { text-align: left; padding-left: ${compact ? '4px' : '6px'}; }

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
