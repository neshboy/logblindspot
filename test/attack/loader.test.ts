import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAttackDataset,
  DEFAULT_DATASET_PATH,
  AttackDatasetError,
  indexTechniquesById,
  indexTacticsById,
} from "../../src/attack/loader.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.join(__dirname, "..", "fixtures", "attack-fixture.json");

describe("loadAttackDataset — real, committed MITRE ATT&CK Enterprise snapshot", () => {
  it("loads the default data/attack-enterprise.json snapshot from disk", async () => {
    const dataset = await loadAttackDataset(DEFAULT_DATASET_PATH);
    expect(dataset.domain).toBe("enterprise-attack");
    expect(dataset.techniques.length).toBeGreaterThan(100);
    expect(dataset.tactics.length).toBeGreaterThan(5);
    // The snapshot must actually be sourced from the real, public MITRE CTI repo.
    expect(dataset.sourceUrl).toBe(
      "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json",
    );
  });

  it("parses real, well-known ATT&CK technique IDs with their correct real names", async () => {
    const dataset = await loadAttackDataset(DEFAULT_DATASET_PATH);
    const byId = indexTechniquesById(dataset);

    // A handful of long-standing, unmistakable real ATT&CK techniques - hand
    // verified against public ATT&CK documentation, not invented.
    expect(byId.get("T1055")?.name).toBe("Process Injection");
    expect(byId.get("T1059")?.name).toBe("Command and Scripting Interpreter");
    expect(byId.get("T1059.001")?.name).toBe("PowerShell");
    expect(byId.get("T1003")?.name).toBe("OS Credential Dumping");
    expect(byId.get("T1071")?.name).toBe("Application Layer Protocol");
    expect(byId.get("T1078")?.name).toBe("Valid Accounts");
  });

  it("parses real ATT&CK tactics and preserves the official matrix ordering", async () => {
    const dataset = await loadAttackDataset(DEFAULT_DATASET_PATH);
    const byId = indexTacticsById(dataset);

    expect(byId.get("initial-access")?.name).toBe("Initial Access");
    expect(byId.get("execution")?.name).toBe("Execution");
    expect(byId.get("persistence")?.name).toBe("Persistence");

    // Real ATT&CK Enterprise matrix order starts with reconnaissance and
    // resource-development ahead of initial-access.
    const order = dataset.tactics.map((t) => t.id);
    expect(order.indexOf("reconnaissance")).toBeLessThan(order.indexOf("initial-access"));
    expect(order.indexOf("initial-access")).toBeLessThan(order.indexOf("execution"));
  });

  it("marks sub-techniques with a resolvable parent technique ID", async () => {
    const dataset = await loadAttackDataset(DEFAULT_DATASET_PATH);
    const byId = indexTechniquesById(dataset);
    const subtechnique = byId.get("T1055.001");
    expect(subtechnique?.isSubtechnique).toBe(true);
    expect(subtechnique?.parentId).toBe("T1055");
    expect(byId.has(subtechnique!.parentId!)).toBe(true);
  });

  it("every technique belongs to at least one known real tactic", async () => {
    const dataset = await loadAttackDataset(DEFAULT_DATASET_PATH);
    const tacticIds = new Set(dataset.tactics.map((t) => t.id));
    for (const technique of dataset.techniques) {
      expect(technique.tactics.length).toBeGreaterThan(0);
      for (const tacticId of technique.tactics) {
        expect(tacticIds.has(tacticId)).toBe(true);
      }
    }
  });

  it("also loads a smaller curated fixture dataset (subset of real techniques)", async () => {
    const dataset = await loadAttackDataset(FIXTURE_PATH);
    expect(dataset.techniques.map((t) => t.id).sort()).toEqual(
      ["T1053.005", "T1059", "T1059.001", "T1078", "T1078.003", "T1136"].sort(),
    );
  });

  it("throws AttackDatasetError for a missing file", async () => {
    await expect(loadAttackDataset(path.join(__dirname, "does-not-exist.json"))).rejects.toThrow(
      AttackDatasetError,
    );
  });

  it("throws AttackDatasetError for malformed JSON shape", async () => {
    const badPath = path.join(__dirname, "..", "fixtures", "log-sources.fixture.yaml");
    await expect(loadAttackDataset(badPath)).rejects.toThrow(AttackDatasetError);
  });
});
