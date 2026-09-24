import type { CoverageReport, TacticCoverage } from "../coverage/calculator.js";
import { bold, dim, fgTrueColor, shouldUseColor, type AnsiOptions } from "./ansi.js";
import { STATUS } from "./palette.js";

const COVERED_GLYPH = "█";
const BLIND_GLYPH = "░";
const DEFAULT_WIDTH = 80;
const DEFAULT_BLIND_SPOTS_SHOWN_PER_TACTIC = 6;

export interface TerminalRenderOptions extends AnsiOptions {
  /** Terminal width to wrap the coverage grid to. Defaults to process.stdout.columns or 80. */
  width?: number;
  /** Show every blind-spot technique per tactic instead of a truncated preview. */
  full?: boolean;
}

function wrapGlyphs(glyphs: string[], width: number, indent: number): string[] {
  const perLine = Math.max(1, width - indent);
  const lines: string[] = [];
  for (let i = 0; i < glyphs.length; i += perLine) {
    lines.push(glyphs.slice(i, i + perLine).join(""));
  }
  return lines.length > 0 ? lines : [""];
}

function renderTacticGrid(tactic: TacticCoverage, color: boolean, width: number): string {
  const label = `  ${tactic.tacticName}`;
  const stats = `${tactic.covered}/${tactic.total} (${tactic.coveragePct}%)`;
  const glyphs = tactic.techniques.map((t) =>
    t.covered
      ? fgTrueColor(STATUS.good, COVERED_GLYPH, color)
      : fgTrueColor(STATUS.critical, BLIND_GLYPH, color),
  );
  const lines = wrapGlyphs(glyphs, width - 4, 4);
  const header = `${bold(label, color)}  ${dim(stats, color)}`;
  const body = lines.map((l) => `    ${l}`).join("\n");
  return `${header}\n${body}`;
}

function renderBlindSpotList(
  tactic: TacticCoverage,
  color: boolean,
  full: boolean,
): string | null {
  const blind = tactic.techniques.filter((t) => !t.covered);
  if (blind.length === 0) return null;
  const shown = full ? blind : blind.slice(0, DEFAULT_BLIND_SPOTS_SHOWN_PER_TACTIC);
  const lines = shown.map(
    (t) => `      ${fgTrueColor(STATUS.critical, "x", color)} ${t.techniqueId}  ${t.name}`,
  );
  const remaining = blind.length - shown.length;
  const heading = `  ${bold(tactic.tacticName, color)} (${blind.length} blind spot${blind.length === 1 ? "" : "s"})`;
  const tail =
    remaining > 0
      ? `\n      ${dim(`... and ${remaining} more (use --full, or see the HTML report)`, color)}`
      : "";
  return `${heading}\n${lines.join("\n")}${tail}`;
}

export function renderTerminalReport(
  report: CoverageReport,
  opts: TerminalRenderOptions = {},
): string {
  const width = opts.width ?? process.stdout?.columns ?? DEFAULT_WIDTH;
  const color = shouldUseColor(process.stdout, opts);
  const out: string[] = [];

  out.push(bold("LogBlindSpot — ATT&CK Visibility Coverage", color));
  out.push(
    dim(
      `Dataset: ${report.dataset.sourceName} (snapshot fetched ${report.dataset.fetchedAt})`,
      color,
    ),
  );
  out.push(
    dim(
      `${report.totalTechniques} techniques across ${report.tactics.length} tactics — ` +
        `sources configured: ${report.sourceNames.length > 0 ? report.sourceNames.join(", ") : "(none)"}`,
      color,
    ),
  );
  out.push("");
  out.push(
    `${bold("Overall visibility:", color)} ${report.totalCovered}/${report.totalTechniques} techniques ` +
      `(${bold(`${report.overallCoveragePct}%`, color)})`,
  );
  out.push(
    `  ${fgTrueColor(STATUS.good, COVERED_GLYPH, color)} = covered by >=1 configured source   ` +
      `${fgTrueColor(STATUS.critical, BLIND_GLYPH, color)} = blind spot (zero configured sources)`,
  );
  out.push("");

  for (const tactic of report.tactics) {
    out.push(renderTacticGrid(tactic, color, width));
    out.push("");
  }

  if (report.unknownTechniqueReferences.length > 0) {
    out.push(bold("Warnings — unrecognized technique IDs in your log-sources.yaml:", color));
    for (const ref of report.unknownTechniqueReferences) {
      out.push(`  ${fgTrueColor(STATUS.critical, "!", color)} ${ref.sourceName}: "${ref.techniqueId}" is not a known ATT&CK technique ID (typo?)`);
    }
    out.push("");
  }

  const blindSections = report.tactics
    .map((t) => renderBlindSpotList(t, color, opts.full ?? false))
    .filter((s): s is string => s !== null);

  if (blindSections.length > 0) {
    out.push(bold("Blind spots by tactic (prioritize onboarding a log source for these):", color));
    out.push("");
    out.push(blindSections.join("\n\n"));
    out.push("");
  } else {
    out.push(fgTrueColor(STATUS.good, "No blind spots — every technique has at least one configured source.", color));
  }

  return out.join("\n");
}
