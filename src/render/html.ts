import type { CoverageReport, TacticCoverage, TechniqueCoverage } from "../coverage/calculator.js";
import { INK, STATUS, SURFACE } from "./palette.js";

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cellHtml(t: TechniqueCoverage): string {
  const status = t.covered ? "covered" : "blind";
  const icon = t.covered ? "✓" : "×"; // check / multiplication sign (x)
  const sourcesNote = t.covered
    ? `covered by: ${t.coveringSources.join(", ")}`
    : "blind spot - no configured source claims visibility";
  const title = `${t.techniqueId} — ${t.name} — ${sourcesNote}`;
  return (
    `<a class="cell ${status}" href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer" ` +
    `data-technique-id="${escapeHtml(t.techniqueId)}" data-status="${status}" title="${escapeHtml(title)}">` +
    `<span class="cell-icon" aria-hidden="true">${icon}</span>` +
    `<span class="cell-id">${escapeHtml(t.techniqueId)}</span>` +
    `</a>`
  );
}

function tacticSectionHtml(tactic: TacticCoverage): string {
  const cells = tactic.techniques.map(cellHtml).join("");
  return (
    `<section class="tactic" data-tactic-id="${escapeHtml(tactic.tacticId)}">` +
    `<h2>${escapeHtml(tactic.tacticName)} ` +
    `<span class="tactic-stats">${tactic.covered}/${tactic.total} covered (${tactic.coveragePct}%)</span>` +
    `</h2>` +
    `<div class="grid">${cells}</div>` +
    `</section>`
  );
}

function blindSpotTableHtml(tactic: TacticCoverage): string {
  const blind = tactic.techniques.filter((t) => !t.covered);
  if (blind.length === 0) return "";
  const rows = blind
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.techniqueId)}</td><td>${escapeHtml(t.name)}</td>` +
        `<td><a href="${escapeHtml(t.url)}" target="_blank" rel="noopener noreferrer">attack.mitre.org</a></td></tr>`,
    )
    .join("");
  return (
    `<details class="blind-spot-group"><summary>${escapeHtml(tactic.tacticName)} ` +
    `(${blind.length} blind spot${blind.length === 1 ? "" : "s"})</summary>` +
    `<table><thead><tr><th>ID</th><th>Technique</th><th>Reference</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></details>`
  );
}

function unknownRefsHtml(report: CoverageReport): string {
  if (report.unknownTechniqueReferences.length === 0) return "";
  const items = report.unknownTechniqueReferences
    .map(
      (r) =>
        `<li><code>${escapeHtml(r.techniqueId)}</code> referenced by <strong>${escapeHtml(r.sourceName)}</strong></li>`,
    )
    .join("");
  return (
    `<section class="unknown-refs"><h2>Unrecognized technique IDs</h2>` +
    `<p>These IDs appeared in your log-sources.yaml but do not match any technique in the ` +
    `loaded ATT&CK dataset (likely a typo) - they were ignored when computing coverage.</p>` +
    `<ul>${items}</ul></section>`
  );
}

const STYLE = `
  :root {
    color-scheme: light dark;
    --surface: ${SURFACE.light};
    --ink-primary: ${INK.primaryLight};
    --ink-secondary: ${INK.secondaryLight};
    --ink-muted: ${INK.muted};
    --accent: ${INK.accent};
    --good: ${STATUS.good};
    --critical: ${STATUS.critical};
    --border: rgba(11,11,11,0.10);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --surface: ${SURFACE.dark};
      --ink-primary: ${INK.primaryDark};
      --ink-secondary: ${INK.secondaryDark};
      --border: rgba(255,255,255,0.10);
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--surface);
    color: var(--ink-primary);
  }
  header.report-header {
    padding: 24px 32px;
    border-bottom: 1px solid var(--border);
  }
  h1 { margin: 0 0 8px; font-size: 1.5rem; }
  p.meta { margin: 2px 0; color: var(--ink-secondary); font-size: 0.9rem; }
  .stat-tile { margin-top: 16px; }
  .stat-value { font-size: 2.25rem; font-weight: 700; font-variant-numeric: tabular-nums; margin-right: 10px; }
  .stat-label { color: var(--ink-secondary); }
  .legend { margin-top: 14px; display: flex; gap: 20px; font-size: 0.9rem; color: var(--ink-secondary); }
  .legend-item { display: inline-flex; align-items: center; gap: 6px; }
  .swatch { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; font-weight: 700; color: #fff; }
  .swatch.covered { background: var(--good); }
  .swatch.blind { background: var(--critical); }
  main { padding: 8px 32px 32px; }
  section.tactic { margin-top: 28px; }
  section.tactic h2 { font-size: 1.05rem; margin: 0 0 10px; display: flex; align-items: baseline; gap: 10px; }
  .tactic-stats { font-size: 0.85rem; color: var(--ink-secondary); font-weight: 400; font-variant-numeric: tabular-nums; }
  .grid { display: flex; flex-wrap: wrap; gap: 4px; }
  .cell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
    text-decoration: none;
    color: #fff;
    min-width: 64px;
  }
  .cell.covered { background: var(--good); }
  .cell.blind { background: var(--critical); }
  .cell:focus-visible, .cell:hover { outline: 2px solid var(--accent); outline-offset: 1px; }
  .cell-icon { font-weight: 700; }
  section.unknown-refs, section.blind-spot-summary {
    margin-top: 36px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
  details.blind-spot-group { margin: 10px 0; }
  details.blind-spot-group summary { cursor: pointer; font-weight: 600; }
  table { border-collapse: collapse; margin: 10px 0 20px; width: 100%; max-width: 720px; }
  th, td { text-align: left; padding: 4px 10px; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
  footer {
    padding: 20px 32px 40px;
    color: var(--ink-muted);
    font-size: 0.8rem;
    border-top: 1px solid var(--border);
  }
  footer a { color: var(--accent); }
`;

export function renderHtmlReport(report: CoverageReport): string {
  const sourcesList =
    report.sourceNames.length > 0 ? report.sourceNames.map(escapeHtml).join(", ") : "(none configured)";
  const blindSpotTables = report.tactics.map(blindSpotTableHtml).filter(Boolean).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LogBlindSpot Coverage Report</title>
<style>${STYLE}</style>
</head>
<body>
<header class="report-header">
  <h1>LogBlindSpot &mdash; ATT&amp;CK Visibility Coverage</h1>
  <p class="meta">Dataset: ${escapeHtml(report.dataset.sourceName)} (snapshot fetched ${escapeHtml(report.dataset.fetchedAt)})</p>
  <p class="meta">Report generated ${escapeHtml(report.generatedAt)}</p>
  <p class="meta">Sources configured: ${sourcesList}</p>
  <div class="stat-tile">
    <span class="stat-value">${report.overallCoveragePct}%</span>
    <span class="stat-label">overall visibility &mdash; ${report.totalCovered}/${report.totalTechniques} techniques covered</span>
  </div>
  <div class="legend">
    <span class="legend-item"><span class="swatch covered">&#10003;</span> covered by &ge;1 configured source</span>
    <span class="legend-item"><span class="swatch blind">&#215;</span> blind spot &mdash; zero configured sources</span>
  </div>
</header>
<main>
${report.tactics.map(tacticSectionHtml).join("\n")}
${unknownRefsHtml(report)}
<section class="blind-spot-summary">
  <h2>Blind spots by tactic (full list)</h2>
  ${blindSpotTables || "<p>No blind spots &mdash; every technique has at least one configured source.</p>"}
</section>
</main>
<footer>
  <p>LogBlindSpot reports raw telemetry <em>visibility</em>, not detection rule correctness &mdash;
  a covered technique means at least one configured log source could plausibly support detecting it,
  not that a working detection rule exists or fires. Source dataset:
  <a href="${escapeHtml(report.dataset.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(report.dataset.sourceUrl)}</a>.</p>
</footer>
</body>
</html>
`;
}
