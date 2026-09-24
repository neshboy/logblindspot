import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAttackDataset } from "../../src/attack/loader.js";
import { loadLogSourceConfig } from "../../src/coverage/logSources.js";
import { computeCoverage } from "../../src/coverage/calculator.js";
import { renderHtmlReport } from "../../src/render/html.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATTACK_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "attack-fixture.json");
const LOG_SOURCES_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "log-sources.fixture.yaml");

function countTag(html: string, tag: string): { open: number; close: number } {
  const open = (html.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length;
  const close = (html.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
  return { open, close };
}

describe("renderHtmlReport", () => {
  let html: string;

  beforeAll(async () => {
    const dataset = await loadAttackDataset(ATTACK_FIXTURE_PATH);
    const config = await loadLogSourceConfig(LOG_SOURCES_FIXTURE_PATH);
    const report = computeCoverage(dataset, config);
    html = renderHtmlReport(report);
  });

  it("emits a well-formed HTML5 document", () => {
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
    for (const tag of ["html", "head", "body", "header", "main", "footer", "div", "table", "tr", "td", "a", "span", "section", "h2"]) {
      const { open, close } = countTag(html, tag);
      expect(open, `<${tag}> open/close mismatch`).toBe(close);
    }
  });

  it("contains the real technique IDs from the fixture dataset", () => {
    for (const id of ["T1078", "T1078.003", "T1059", "T1059.001", "T1053.005", "T1136"]) {
      expect(html).toContain(id);
    }
  });

  it("marks covered techniques with the covered status/class and blind ones with blind", () => {
    expect(html).toContain('data-technique-id="T1078" data-status="covered"');
    expect(html).toContain('class="cell covered"');
    expect(html).toContain('data-technique-id="T1078.003" data-status="blind"');
    expect(html).toContain('class="cell blind"');
  });

  it("reflects the same coverage numbers computed by computeCoverage", async () => {
    const dataset = await loadAttackDataset(ATTACK_FIXTURE_PATH);
    const config = await loadLogSourceConfig(LOG_SOURCES_FIXTURE_PATH);
    const report = computeCoverage(dataset, config);
    expect(html).toContain(`${report.overallCoveragePct}%`);
    expect(html).toContain(`${report.totalCovered}/${report.totalTechniques} techniques covered`);
  });

  it("surfaces unknown/typo'd technique references from the source config", () => {
    expect(html).toContain("T9999");
    expect(html).toContain("FixtureSourceB");
    expect(html).toContain("Unrecognized technique IDs");
  });

  it("escapes HTML-significant characters so technique names cannot break the markup", () => {
    // Sanity check the escaper directly against a hostile technique name by
    // rendering a one-off report with an adversarial dataset/config pair.
    const hostileDataset = {
      schemaVersion: 1,
      sourceName: "hostile",
      sourceUrl: "https://example.invalid",
      fetchedAt: "2026-01-01T00:00:00.000Z",
      domain: "enterprise-attack",
      tacticCount: 1,
      techniqueCount: 1,
      tactics: [{ id: "execution", name: "Execution" }],
      techniques: [
        {
          id: "T9001",
          name: `<script>alert("xss")</script> & "quotes"`,
          tactics: ["execution"],
          isSubtechnique: false,
          parentId: null,
          platforms: [],
          url: "https://attack.mitre.org/techniques/T9001",
        },
      ],
    };
    const hostileReport = computeCoverage(hostileDataset as any, { version: 1, sources: [] });
    const hostileHtml = renderHtmlReport(hostileReport);
    expect(hostileHtml).not.toContain("<script>alert(");
    expect(hostileHtml).toContain("&lt;script&gt;");
  });
});
