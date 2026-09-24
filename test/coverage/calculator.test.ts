import { describe, expect, it, beforeAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAttackDataset } from "../../src/attack/loader.js";
import { loadLogSourceConfig } from "../../src/coverage/logSources.js";
import { computeCoverage, type CoverageReport } from "../../src/coverage/calculator.js";
import type { AttackDataset } from "../../src/attack/types.js";
import type { LogSourceConfig } from "../../src/coverage/logSources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ATTACK_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "attack-fixture.json");
const LOG_SOURCES_FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "log-sources.fixture.yaml");

describe("computeCoverage", () => {
  let dataset: AttackDataset;
  let config: LogSourceConfig;
  let report: CoverageReport;

  beforeAll(async () => {
    dataset = await loadAttackDataset(ATTACK_FIXTURE_PATH);
    config = await loadLogSourceConfig(LOG_SOURCES_FIXTURE_PATH);
    report = computeCoverage(dataset, config);
  });

  it("marks a technique covered when >=1 configured source lists it", () => {
    const t1078 = report.tactics
      .flatMap((t) => t.techniques)
      .find((t) => t.techniqueId === "T1078");
    expect(t1078?.covered).toBe(true);
    expect(t1078?.coveringSources.sort()).toEqual(["FixtureSourceA", "FixtureSourceB"]);
  });

  it("marks a technique as a blind spot when zero configured sources list it", () => {
    const byId = (id: string) =>
      report.tactics.flatMap((t) => t.techniques).find((t) => t.techniqueId === id);
    expect(byId("T1078.003")?.covered).toBe(false);
    expect(byId("T1078.003")?.coveringSources).toEqual([]);
    expect(byId("T1136")?.covered).toBe(false);
  });

  it("treats a sub-technique's coverage independently of its parent technique", () => {
    const byId = (id: string) =>
      report.tactics.flatMap((t) => t.techniques).find((t) => t.techniqueId === id);
    // T1059 (parent) is NOT configured anywhere, but T1059.001 (its sub-technique) is.
    expect(byId("T1059")?.covered).toBe(false);
    expect(byId("T1059.001")?.covered).toBe(true);
  });

  it("computes correct total/covered/percentage per tactic", () => {
    const initialAccess = report.tactics.find((t) => t.tacticId === "initial-access")!;
    expect(initialAccess.total).toBe(2); // T1078, T1078.003
    expect(initialAccess.covered).toBe(1); // only T1078
    expect(initialAccess.coveragePct).toBe(50);

    const execution = report.tactics.find((t) => t.tacticId === "execution")!;
    expect(execution.total).toBe(3); // T1059, T1059.001, T1053.005
    expect(execution.covered).toBe(1); // only T1059.001
    expect(Math.round(execution.coveragePct * 10) / 10).toBeCloseTo(33.3, 1);

    const persistence = report.tactics.find((t) => t.tacticId === "persistence")!;
    expect(persistence.total).toBe(4); // T1078, T1078.003, T1053.005, T1136
    expect(persistence.covered).toBe(1); // only T1078
    expect(persistence.coveragePct).toBe(25);
  });

  it("computes correct overall totals across the whole (deduplicated) technique set", () => {
    expect(report.totalTechniques).toBe(6);
    expect(report.totalCovered).toBe(2); // T1078 and T1059.001, each counted once
    expect(Math.round(report.overallCoveragePct * 10) / 10).toBeCloseTo(33.3, 1);
  });

  it("surfaces unknown/typo'd technique IDs referenced by a source instead of silently dropping them", () => {
    expect(report.unknownTechniqueReferences).toEqual([
      { sourceName: "FixtureSourceB", techniqueId: "T9999" },
    ]);
  });

  it("lists the configured source names on the report", () => {
    expect(report.sourceNames).toEqual(["FixtureSourceA", "FixtureSourceB"]);
  });

  it("reports 0% coverage and every technique as a blind spot when no sources are configured", () => {
    const empty = computeCoverage(dataset, { version: 1, sources: [] });
    expect(empty.totalCovered).toBe(0);
    expect(empty.overallCoveragePct).toBe(0);
    expect(empty.tactics.every((t) => t.covered === 0)).toBe(true);
    expect(empty.tactics.flatMap((t) => t.techniques).every((t) => !t.covered)).toBe(true);
  });

  it("reports 100% coverage when every real technique in the fixture is configured", () => {
    const full = computeCoverage(dataset, {
      version: 1,
      sources: [{ name: "Everything", techniques: dataset.techniques.map((t) => t.id) }],
    });
    expect(full.totalCovered).toBe(full.totalTechniques);
    expect(full.overallCoveragePct).toBe(100);
    expect(full.tactics.every((t) => t.coveragePct === 100)).toBe(true);
  });
});
