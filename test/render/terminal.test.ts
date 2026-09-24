import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAttackDataset } from "../../src/attack/loader.js";
import { loadLogSourceConfig } from "../../src/coverage/logSources.js";
import { computeCoverage, type CoverageReport } from "../../src/coverage/calculator.js";
import { renderTerminalReport } from "../../src/render/terminal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATTACK_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "attack-fixture.json");
const LOG_SOURCES_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "log-sources.fixture.yaml");

describe("renderTerminalReport", () => {
  let report: CoverageReport;

  beforeAll(async () => {
    const dataset = await loadAttackDataset(ATTACK_FIXTURE_PATH);
    const config = await loadLogSourceConfig(LOG_SOURCES_FIXTURE_PATH);
    report = computeCoverage(dataset, config);
  });

  it("renders without color and contains the tactic names and overall percentage", () => {
    const text = renderTerminalReport(report, { color: false, width: 80 });
    expect(text).toContain("Initial Access");
    expect(text).toContain("Execution");
    expect(text).toContain("Persistence");
    expect(text).toContain(`${report.overallCoveragePct}%`);
    expect(text).not.toContain("\x1b["); // no ANSI escapes when color disabled
  });

  it("emits ANSI escape sequences when color is forced on", () => {
    const text = renderTerminalReport(report, { color: true, width: 80 });
    expect(text).toContain("\x1b[");
  });

  it("lists blind-spot technique IDs and names by tactic", () => {
    const text = renderTerminalReport(report, { color: false, width: 80, full: true });
    expect(text).toContain("T1078.003");
    expect(text).toContain("Local Accounts");
    expect(text).toContain("T1136");
    expect(text).toContain("Create Account");
  });

  it("surfaces the unknown technique reference warning", () => {
    const text = renderTerminalReport(report, { color: false, width: 80 });
    expect(text).toContain("T9999");
    expect(text).toContain("FixtureSourceB");
  });
});
